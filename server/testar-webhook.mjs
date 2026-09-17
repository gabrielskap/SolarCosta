// Teste do webhook da uazapi, SEM número conectado.
//
//   npm run build && node testar-webhook.mjs
//
// POR QUE ISTO EXISTE SEPARADO DO testar-fluxo.mjs: aquele é interativo, faz
// login e exercita o funil. Este não tem sessão nenhuma — o webhook autentica
// por segredo na URL e token no corpo, então dá para bater nele direto.
//
// O PULO DO GATO: o token do corpo tem de casar com `token_cifrado`, que só a
// API sabe decifrar. Então o script importa o próprio `cifrar` do build e grava
// um token conhecido na linha da instância, guardando o original para devolver
// no fim. É isso que torna o recebimento testável antes de existir um WhatsApp
// conectado — que é exatamente quando se quer testar.
//
// O que ele verifica:
//   1. mensagem de texto cria conversa e mensagem;
//   2. o MESMO evento duas vezes não duplica (UNIQUE de mensagem_id);
//   3. corpo irreconhecível responde 200 e não grava nada;
//   4. segredo errado responde 404 (e não 401);
//   5. token errado no corpo responde 404;
//   6. messages_update avança enviada -> entregue -> lida e NÃO regride;
//   7. mensagem com anexo grava a linha e deixa a mídia pendente.

import pg from 'pg';
import { config } from './dist/config.js';
import { cifrar } from './dist/services/segredos.js';

const API = process.env.API_URL ?? `http://localhost:${config.PORT}`;
const TOKEN_TESTE = 'token-de-teste-do-webhook';
const CHATID = '5531900000001@s.whatsapp.net';

const cor = {
  ok: (t) => `\x1b[32m${t}\x1b[0m`,
  erro: (t) => `\x1b[31m${t}\x1b[0m`,
  info: (t) => `\x1b[36m${t}\x1b[0m`,
  fraco: (t) => `\x1b[90m${t}\x1b[0m`,
};

let passou = 0;
let falhou = 0;

function checar(descricao, condicao, detalhe = '') {
  if (condicao) {
    console.log(`  ${cor.ok('✓')} ${descricao}`);
    passou += 1;
  } else {
    console.log(`  ${cor.erro('✗')} ${descricao} ${cor.fraco(detalhe)}`);
    falhou += 1;
  }
}

/** POST no webhook. Devolve só o status — o corpo é sempre {ok:true}. */
async function enviarEvento(segredo, corpo) {
  const r = await fetch(`${API}/api/webhooks/whatsapp/${segredo}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(corpo),
  });
  return r.status;
}

/**
 * Formato do evento como o presumimos hoje.
 *
 * Se o payload real vier diferente, é AQUI que se ajusta para reproduzir o que
 * chegou — e o parser (services/eventosWhatsapp.ts) tem de passar a aceitar.
 */
function eventoMensagem({ id, texto, timestamp, midia, deMim = false }) {
  return {
    EventType: 'messages',
    token: TOKEN_TESTE,
    data: {
      chatid: CHATID,
      messageid: id,
      fromMe: deMim,
      pushName: 'Cliente de Teste',
      messageType: midia ? 'image' : 'conversation',
      text: texto,
      messageTimestamp: timestamp ?? Math.floor(Date.now() / 1000),
      ...(midia ? { mediaUrl: midia, mimetype: 'image/jpeg', fileName: 'foto.jpg' } : {}),
    },
  };
}

function eventoStatus(id, status) {
  return {
    EventType: 'messages_update',
    token: TOKEN_TESTE,
    data: { messageid: id, status },
  };
}

/** Dá tempo para o handler terminar de escrever antes de consultarmos. */
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  console.log(cor.info(`\nTestando o webhook em ${API}\n`));

  const pool = new pg.Pool({
    connectionString: config.DATABASE_URL,
    ssl: config.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
    max: 2,
  });

  const { rows: instancias } = await pool.query(
    `SELECT id, webhook_segredo, token_cifrado FROM "SolarCosta_WhatsAppInstancia" WHERE registro_unico`,
  );
  if (instancias.length === 0) {
    console.error(cor.erro('Não há linha em SolarCosta_WhatsAppInstancia. Rode `npm run migrate`.'));
    await pool.end();
    process.exit(1);
  }

  const instancia = instancias[0];
  const segredo = instancia.webhook_segredo;
  const tokenOriginal = instancia.token_cifrado;

  console.log(cor.fraco(`  instância ${instancia.id}`));
  console.log(cor.fraco(`  gravando token de teste (o original volta no fim)\n`));

  await pool.query(
    `UPDATE "SolarCosta_WhatsAppInstancia" SET token_cifrado = $2 WHERE id = $1`,
    [instancia.id, cifrar(TOKEN_TESTE)],
  );

  try {
    /* ------------------------------------------------ 1. texto recebido -- */
    console.log(cor.info('1. Mensagem de texto'));
    const id1 = `TESTE-${Date.now()}-A`;
    const s1 = await enviarEvento(segredo, eventoMensagem({ id: id1, texto: 'Olá, quero um orçamento' }));
    checar('responde 200', s1 === 200, `status ${s1}`);
    await esperar(300);

    const { rows: m1 } = await pool.query(
      `SELECT m.id, m.texto, m.de_mim, m.tipo, c.chatid, c.nao_lidas, c.nome_exibicao,
              c.ultima_mensagem_texto
         FROM "SolarCosta_WhatsAppMensagens" m
         JOIN "SolarCosta_WhatsAppConversas" c ON c.id = m.conversa_id
        WHERE m.mensagem_id = $1`,
      [id1],
    );
    checar('gravou a mensagem', m1.length === 1);
    checar('ligou na conversa certa', m1[0]?.chatid === CHATID, m1[0]?.chatid);
    checar('de_mim é falso', m1[0]?.de_mim === false);
    checar('tipo é texto', m1[0]?.tipo === 'texto', m1[0]?.tipo);
    checar('guardou o push name', m1[0]?.nome_exibicao === 'Cliente de Teste');
    checar('contou como não lida', m1[0]?.nao_lidas >= 1, String(m1[0]?.nao_lidas));
    checar(
      'gravou a prévia',
      m1[0]?.ultima_mensagem_texto === 'Olá, quero um orçamento',
      m1[0]?.ultima_mensagem_texto,
    );

    /* -------------------------------------------- 2. idempotência (retry) -- */
    console.log(cor.info('\n2. Mesmo evento reentregue'));
    const naoLidasAntes = m1[0]?.nao_lidas;
    const s2 = await enviarEvento(segredo, eventoMensagem({ id: id1, texto: 'Olá, quero um orçamento' }));
    checar('responde 200', s2 === 200, `status ${s2}`);
    await esperar(300);

    const { rows: dup } = await pool.query(
      `SELECT count(*)::int AS n FROM "SolarCosta_WhatsAppMensagens" WHERE mensagem_id = $1`,
      [id1],
    );
    checar('não duplicou a mensagem', dup[0].n === 1, `${dup[0].n} linhas`);

    const { rows: cont } = await pool.query(
      `SELECT nao_lidas FROM "SolarCosta_WhatsAppConversas" WHERE chatid = $1`,
      [CHATID],
    );
    checar(
      'não inflou o contador de não lidas',
      cont[0].nao_lidas === naoLidasAntes,
      `era ${naoLidasAntes}, ficou ${cont[0].nao_lidas}`,
    );

    /* ------------------------------------------------- 3. corpo estranho -- */
    console.log(cor.info('\n3. Corpo irreconhecível'));
    const s3 = await enviarEvento(segredo, {
      EventType: 'messages',
      token: TOKEN_TESTE,
      data: { alguma_coisa: 'sem chatid nem id' },
    });
    checar('responde 200 (não 4xx, que geraria retry)', s3 === 200, `status ${s3}`);
    console.log(cor.fraco('     → confira no log da API: "payload não reconhecido"'));

    /* ---------------------------------------------------- 4. segredo errado -- */
    console.log(cor.info('\n4. Autenticação'));
    const s4 = await enviarEvento('segredo-errado-de-proposito', eventoMensagem({ id: 'X', texto: 'oi' }));
    checar('segredo errado responde 404 (não 401)', s4 === 404, `status ${s4}`);

    const r5 = await fetch(`${API}/api/webhooks/whatsapp/${segredo}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ EventType: 'messages', token: 'token-errado', data: { chatid: CHATID, messageid: 'Y' } }),
    });
    checar('token errado no corpo responde 404', r5.status === 404, `status ${r5.status}`);

    /* ------------------------------------------------------- 5. status -- */
    console.log(cor.info('\n5. messages_update — status só avança'));

    // Precisa de uma mensagem NOSSA: o UPDATE tem `AND de_mim`.
    const idSaida = `TESTE-${Date.now()}-SAIDA`;
    const { rows: conversa } = await pool.query(
      `SELECT id FROM "SolarCosta_WhatsAppConversas" WHERE chatid = $1`,
      [CHATID],
    );
    await pool.query(
      `INSERT INTO "SolarCosta_WhatsAppMensagens"
          (conversa_id, mensagem_id, de_mim, tipo, texto, status)
       VALUES ($1, $2, true, 'texto', 'resposta de teste', 'enviada')`,
      [conversa[0].id, idSaida],
    );

    const lerStatus = async () => {
      const { rows } = await pool.query(
        `SELECT status FROM "SolarCosta_WhatsAppMensagens" WHERE mensagem_id = $1`,
        [idSaida],
      );
      return rows[0]?.status;
    };

    await enviarEvento(segredo, eventoStatus(idSaida, 'Delivered'));
    await esperar(250);
    checar('enviada -> entregue', (await lerStatus()) === 'entregue', await lerStatus());

    await enviarEvento(segredo, eventoStatus(idSaida, 'Read'));
    await esperar(250);
    checar('entregue -> lida', (await lerStatus()) === 'lida', await lerStatus());

    await enviarEvento(segredo, eventoStatus(idSaida, 'Delivered'));
    await esperar(250);
    checar('lida NÃO volta para entregue', (await lerStatus()) === 'lida', await lerStatus());

    await enviarEvento(segredo, eventoStatus(idSaida, 'Failed'));
    await esperar(250);
    checar('lida NÃO vira falhou (estado terminal real não regride)', (await lerStatus()) === 'lida', await lerStatus());

    /* -------------------------------------------------------- 6. anexo -- */
    console.log(cor.info('\n6. Mensagem com anexo'));
    const id6 = `TESTE-${Date.now()}-MIDIA`;
    // URL de host não permitido de propósito: a checagem anti-SSRF tem de
    // recusar, e a mensagem tem de ficar com `erro` preenchido em vez de a
    // API sair buscando um endereço arbitrário da internet.
    const s6 = await enviarEvento(
      segredo,
      eventoMensagem({ id: id6, texto: null, midia: 'https://exemplo-nao-permitido.test/foto.jpg' }),
    );
    checar('responde 200', s6 === 200, `status ${s6}`);
    await esperar(1200);

    const { rows: m6 } = await pool.query(
      `SELECT tipo, midia_id, erro, nome_arquivo, mime_type
         FROM "SolarCosta_WhatsAppMensagens" WHERE mensagem_id = $1`,
      [id6],
    );
    checar('gravou a mensagem de imagem', m6.length === 1);
    checar('tipo é imagem', m6[0]?.tipo === 'imagem', m6[0]?.tipo);
    checar('guardou o nome do arquivo', m6[0]?.nome_arquivo === 'foto.jpg', m6[0]?.nome_arquivo);
    checar('recusou o host e explicou na mensagem', !!m6[0]?.erro, m6[0]?.erro ?? 'erro vazio');
    checar('não ligou mídia nenhuma', m6[0]?.midia_id === null);

    /* ------------------------------------------------------- limpeza -- */
    console.log(cor.info('\nLimpando'));
    const { rowCount } = await pool.query(
      `DELETE FROM "SolarCosta_WhatsAppConversas" WHERE chatid = $1`,
      [CHATID],
    );
    // As mensagens vão junto: FK com ON DELETE CASCADE.
    checar('removeu a conversa de teste', rowCount === 1);
  } finally {
    await pool.query(
      `UPDATE "SolarCosta_WhatsAppInstancia" SET token_cifrado = $2 WHERE id = $1`,
      [instancia.id, tokenOriginal],
    );
    console.log(cor.fraco('  token original restaurado'));
    await pool.end();
  }

  console.log(
    `\n${falhou === 0 ? cor.ok(`Tudo passou (${passou})`) : cor.erro(`${falhou} falha(s), ${passou} ok`)}\n`,
  );
  process.exit(falhou === 0 ? 0 : 1);
}

main().catch((erro) => {
  console.error(cor.erro(`\nFalhou: ${erro?.message ?? erro}\n`));
  process.exit(1);
});
