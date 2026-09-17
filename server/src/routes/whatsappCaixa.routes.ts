// WhatsApp — caixa de entrada: conversas, thread, mídia e resposta.
//
// Montado no MESMO prefixo /api/whatsapp do whatsapp.routes.ts. A divisão é por
// tamanho: aquele arquivo já tem ~530 linhas e cobre conexão, modelos e envio
// de documento; somar estas sete rotas passaria de mil, e num arquivo desse
// porte ninguém acha nada. Não há colisão de caminho — lá são `/instancia*`,
// `/modelos` e `/enviar`; aqui, `/conversas*` e `/midia/:id`.
//
// TODAS as rotas exigem `usar_whatsapp` e nada mais. `gerenciar_usuarios`
// continua valendo só para conectar e desconectar o número: quem atende cliente
// precisa ler e responder, não precisa poder derrubar o canal da empresa.
//
// O router precisa do seu PRÓPRIO exigirLogin — o `use` do outro router não
// alcança este, mesmo montados no mesmo caminho.

import { Router } from 'express';
import { z } from 'zod';
import { consultar, consultarUm, emTransacao } from '../db.js';
import { asyncHandler, AppError, naoEncontrado } from '../errors.js';
import { ator, exigirLogin, exigirPermissao, type RequestAutenticado } from '../auth/middleware.js';
import { enviarERegistrar } from '../services/envioWhatsapp.js';
import { registrarNaTimeline } from '../services/whatsappConversas.js';
import {
  carregarInstancia,
  comRegistroDeErro,
  exigirConectada,
  exigirToken,
} from '../services/whatsappInstancia.js';

export const whatsappCaixaRouter = Router();
whatsappCaixaRouter.use(exigirLogin);

const podeUsar = exigirPermissao('usar_whatsapp');

/* =========================================================== CONVERSAS == */

/**
 * Lista fechada de colunas, e nunca `SELECT *`.
 *
 * Não é preciosismo: `SolarCosta_WhatsAppMidia.conteudo` é `bytea`, e um
 * `SELECT *` que um dia passe por um JOIN com ela devolveria megabytes dentro
 * de um JSON. O comentário está na própria migration (V009).
 */
const COLUNAS_CONVERSA = `
  c.id, c.chatid, c.telefone, c.nome_exibicao, c.e_grupo, c.nao_lidas,
  c.ultima_mensagem_texto, c.ultima_mensagem_em, c.arquivada,
  l.id AS lead_id, l.numero AS lead_numero, l.nome AS lead_nome, l.etapa::text AS lead_etapa`;

const DE_CONVERSA = `
  FROM "SolarCosta_WhatsAppConversas" c
  LEFT JOIN "SolarCosta_Leads" l ON l.id = c.lead_id AND l.excluido_em IS NULL`;

interface LinhaConversa {
  id: string;
  chatid: string;
  telefone: string | null;
  nome_exibicao: string | null;
  e_grupo: boolean;
  nao_lidas: number;
  ultima_mensagem_texto: string | null;
  ultima_mensagem_em: string | null;
  arquivada: boolean;
  lead_id: string | null;
  lead_numero: string | null;
  lead_nome: string | null;
  lead_etapa: string | null;
}

function paraApiConversa(c: LinhaConversa) {
  return {
    id: c.id,
    chatid: c.chatid,
    telefone: c.telefone,
    nome_exibicao: c.nome_exibicao,
    e_grupo: c.e_grupo,
    nao_lidas: c.nao_lidas,
    ultima_mensagem_texto: c.ultima_mensagem_texto,
    ultima_mensagem_em: c.ultima_mensagem_em,
    arquivada: c.arquivada,
    lead: c.lead_id
      ? { id: c.lead_id, numero: c.lead_numero, nome: c.lead_nome, etapa: c.lead_etapa }
      : null,
  };
}

async function carregarConversa(id: string): Promise<LinhaConversa> {
  const linha = await consultarUm<LinhaConversa>(
    `SELECT ${COLUNAS_CONVERSA} ${DE_CONVERSA} WHERE c.id = $1`,
    [id],
  );
  if (!linha) throw naoEncontrado('Conversa');
  return linha;
}

const listaSchema = z.object({
  busca: z.string().max(60).optional(),
  arquivadas: z.enum(['nao', 'sim', 'todas']).default('nao'),
  /** Cursor: pega quem for mais antigo que este instante. */
  antes_de: z.string().datetime({ offset: true }).optional(),
  limite: z.coerce.number().int().min(1).max(50).default(30),
});

whatsappCaixaRouter.get(
  '/conversas',
  podeUsar,
  asyncHandler(async (req, res) => {
    const f = listaSchema.parse(req.query);

    const params: unknown[] = [];
    const condicoes: string[] = [];

    if (f.arquivadas === 'nao') condicoes.push('NOT c.arquivada');
    else if (f.arquivadas === 'sim') condicoes.push('c.arquivada');

    if (f.busca) {
      // Mesmo idioma de leads.routes.ts: a busca sem acento acha "Joao" para
      // quem digitou "João". O telefone entra por LIKE cru porque é só dígitos.
      params.push(f.busca);
      condicoes.push(
        `("SolarCosta_fn_sem_acento"(COALESCE(c.nome_exibicao,'')) LIKE '%' || "SolarCosta_fn_sem_acento"($${params.length}) || '%'
          OR "SolarCosta_fn_sem_acento"(COALESCE(l.nome,''))       LIKE '%' || "SolarCosta_fn_sem_acento"($${params.length}) || '%'
          OR COALESCE(c.telefone,'') LIKE '%' || regexp_replace($${params.length}, '\\D', '', 'g') || '%')`,
      );
    }

    if (f.antes_de) {
      params.push(f.antes_de);
      condicoes.push(`c.ultima_mensagem_em < $${params.length}`);
    }

    const where = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';

    // Paginação por cursor de timestamp, e não OFFSET: a lista se reordena a
    // cada mensagem que chega, e com OFFSET a segunda página repetiria ou
    // pularia conversas conforme o topo se movesse.
    params.push(f.limite);
    const linhas = await consultar<LinhaConversa>(
      `SELECT ${COLUNAS_CONVERSA} ${DE_CONVERSA} ${where}
        ORDER BY c.ultima_mensagem_em DESC NULLS LAST, c.id DESC
        LIMIT $${params.length}`,
      params,
    );

    // O total NÃO é filtrado pela busca nem pelo cursor: é o badge da tela, e
    // ele tem de contar tudo o que está esperando resposta, não só o que está
    // visível na lista filtrada.
    const total = await consultarUm<{ nao_lidas: number }>(
      `SELECT COALESCE(sum(nao_lidas), 0)::int AS nao_lidas
         FROM "SolarCosta_WhatsAppConversas" WHERE NOT arquivada`,
    );

    res.json({
      conversas: linhas.map(paraApiConversa),
      nao_lidas_total: total?.nao_lidas ?? 0,
      // Só oferece cursor quando a página veio cheia: página curta é o fim.
      proximo_cursor:
        linhas.length === f.limite ? linhas[linhas.length - 1]!.ultima_mensagem_em : null,
    });
  }),
);

/* =========================================================== MENSAGENS == */

const COLUNAS_MENSAGEM = `
  m.id, m.mensagem_id, m.de_mim, m.tipo, m.texto, m.midia_id, m.nome_arquivo,
  m.mime_type, m.status, m.erro, m.ocorrido_em, m.referencia_tipo, m.referencia_id,
  u.nome AS enviada_por_nome`;

const threadSchema = z
  .object({
    /** Página mais antiga. */
    antes_de: z.string().datetime({ offset: true }).optional(),
    /** Delta do polling: só o que chegou depois deste instante. */
    depois_de: z.string().datetime({ offset: true }).optional(),
    limite: z.coerce.number().int().min(1).max(80).default(40),
  })
  .refine((d) => !(d.antes_de && d.depois_de), {
    message: 'Use antes_de ou depois_de, não os dois.',
  });

whatsappCaixaRouter.get(
  '/conversas/:id/mensagens',
  podeUsar,
  asyncHandler(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const f = threadSchema.parse(req.query);

    const conversa = await carregarConversa(id);

    const params: unknown[] = [id];
    let filtro = '';
    if (f.antes_de) {
      params.push(f.antes_de);
      filtro = `AND m.ocorrido_em < $${params.length}`;
    } else if (f.depois_de) {
      params.push(f.depois_de);
      filtro = `AND m.ocorrido_em > $${params.length}`;
    }

    // O +1 é o que responde "tem mais?" sem um COUNT(*) na thread inteira.
    params.push(f.limite + 1);

    // Ordem DESC também no delta: o front sempre inverte para renderizar, e
    // manter uma ordem só evita um `if` de ordenação na tela.
    const linhas = await consultar(
      `SELECT ${COLUNAS_MENSAGEM}
         FROM "SolarCosta_WhatsAppMensagens" m
         LEFT JOIN "SolarCosta_Usuarios" u ON u.id = m.enviada_por_id
        WHERE m.conversa_id = $1 ${filtro}
        ORDER BY m.ocorrido_em DESC, m.id DESC
        LIMIT $${params.length}`,
      params,
    );

    const temMais = linhas.length > f.limite;

    res.json({
      conversa: paraApiConversa(conversa),
      mensagens: temMais ? linhas.slice(0, f.limite) : linhas,
      tem_mais: temMais,
    });
  }),
);

/* ================================================================ LER == */

/**
 * Zera o contador de não lidas.
 *
 * NÃO manda confirmação de leitura para o cliente — o visto azul no celular
 * dele continua como estava. Fazer isso exigiria um endpoint da uazapi que não
 * está verificado, e "o CRM avisou o cliente que eu li" é efeito colateral que
 * ninguém pediu.
 *
 * POST e não PATCH porque é ação sem corpo, no mesmo formato de
 * POST /instancia/desconectar.
 */
whatsappCaixaRouter.post(
  '/conversas/:id/ler',
  podeUsar,
  asyncHandler(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    await carregarConversa(id);

    await consultar(
      `UPDATE "SolarCosta_WhatsAppConversas" SET nao_lidas = 0 WHERE id = $1`,
      [id],
    );

    res.json({ conversa: paraApiConversa(await carregarConversa(id)) });
  }),
);

/* ============================================================ ARQUIVAR == */

whatsappCaixaRouter.post(
  '/conversas/:id/arquivar',
  podeUsar,
  asyncHandler(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { arquivada } = z.object({ arquivada: z.boolean() }).parse(req.body);

    await carregarConversa(id);
    await consultar(
      `UPDATE "SolarCosta_WhatsAppConversas" SET arquivada = $2 WHERE id = $1`,
      [id, arquivada],
    );

    res.json({ conversa: paraApiConversa(await carregarConversa(id)) });
  }),
);

/* ================================================================ LEAD == */

/**
 * Vincula ou desvincula o lead à mão.
 *
 * Existe porque o casamento automático por telefone é um palpite: homônimo e
 * número trocado existem, e um palpite errado do sistema não pode virar dado
 * definitivo. É o que a coluna `lead_id` promete no comentário do V009.
 *
 * A linha de timeline aqui NÃO tem a janela de 12 h de `registrarNaTimeline`:
 * vincular é ato humano deliberado e deve aparecer sempre.
 */
whatsappCaixaRouter.patch(
  '/conversas/:id/lead',
  podeUsar,
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { lead_id } = z
      .object({ lead_id: z.string().uuid().nullable() })
      .parse(req.body);

    const conversa = await carregarConversa(id);

    await emTransacao(async (cliente) => {
      let descricaoLead = '—';

      if (lead_id) {
        const { rows } = await cliente.query<{ numero: string; nome: string }>(
          `SELECT numero, nome FROM "SolarCosta_Leads"
            WHERE id = $1 AND excluido_em IS NULL`,
          [lead_id],
        );
        if (rows.length === 0) throw naoEncontrado('Lead');
        descricaoLead = `${rows[0]!.numero} — ${rows[0]!.nome}`;

        await cliente.query(
          `INSERT INTO "SolarCosta_LeadHistorico" (lead_id, descricao, tipo, usuario_id, usuario_nome)
           VALUES ($1, $2, 'whatsapp', $3, $4)`,
          [
            lead_id,
            `Conversa de WhatsApp (${conversa.telefone ?? conversa.chatid}) vinculada a este lead.`,
            req.usuario.id,
            req.usuario.nome,
          ],
        );
      }

      await cliente.query(
        `UPDATE "SolarCosta_WhatsAppConversas" SET lead_id = $2 WHERE id = $1`,
        [id, lead_id],
      );

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('editar','WhatsApp',$1,$2,$3)`,
        [
          `Conversa ${conversa.nome_exibicao ?? conversa.telefone ?? conversa.chatid}`,
          lead_id,
          lead_id ? `Vinculada ao lead ${descricaoLead}` : 'Vínculo com o lead removido',
        ],
      );
    }, ator(req));

    res.json({ conversa: paraApiConversa(await carregarConversa(id)) });
  }),
);

/* =========================================================== RESPONDER == */

whatsappCaixaRouter.post(
  '/conversas/:id/responder',
  podeUsar,
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { texto } = z.object({ texto: z.string().min(1).max(4000) }).parse(req.body);

    const conversa = await carregarConversa(id);

    // Grupo fica de fora por honestidade: mandar para `@g.us` usando o campo
    // `number` do /send/text não está verificado, e uma tela que diz "enviado"
    // sem ter enviado é pior do que um aviso claro. Virar suporte a grupo é
    // mudança de três linhas depois de confirmado com a uazapi.
    if (!conversa.telefone) {
      throw new AppError(
        409,
        'Responder em grupo ainda não é suportado. Use o WhatsApp no celular para este caso.',
        'whatsapp_grupo_sem_envio',
      );
    }

    const instancia = await carregarInstancia();
    const token = exigirToken(instancia);
    exigirConectada(instancia);

    // Sem `numeroExiste` aqui, ao contrário do /enviar: o número acabou de
    // mandar mensagem para nós, então a checagem só somaria uma ida à uazapi.
    // No /enviar ela paga por si, porque lá o telefone foi digitado à mão.

    const gravada = await comRegistroDeErro(() =>
      emTransacao(async (cliente) => {
        const m = await enviarERegistrar(cliente, {
          token,
          telefone: conversa.telefone!,
          texto,
          leadId: conversa.lead_id,
          autor: { id: req.usuario.id, nome: req.usuario.nome },
          referenciaTipo: null,
          referenciaId: null,
          descricaoAuditoria: null,
        });

        if (conversa.lead_id) {
          await registrarNaTimeline(
            cliente,
            conversa.lead_id,
            `Conversa no WhatsApp: ${texto.slice(0, 120)}`,
            { id: req.usuario.id, nome: req.usuario.nome },
          );
        }

        return m;
      }, ator(req)),
    );

    // Devolve a mensagem no mesmo shape da thread, para a tela poder mostrá-la
    // na hora sem esperar a próxima volta do polling.
    const mensagem = await consultarUm(
      `SELECT ${COLUNAS_MENSAGEM}
         FROM "SolarCosta_WhatsAppMensagens" m
         LEFT JOIN "SolarCosta_Usuarios" u ON u.id = m.enviada_por_id
        WHERE m.id = $1`,
      [gravada.linhaId],
    );

    res.status(201).json({ mensagem, conversa: paraApiConversa(await carregarConversa(id)) });
  }),
);

/* =============================================================== MÍDIA == */

/**
 * Tipos que o navegador pode RENDERIZAR sem risco.
 *
 * ========================= POR QUE ISTO É UMA LISTA =========================
 * O `mime_type` da mídia veio do webhook, ou seja, de fora. A CSP do app é
 * `default-src 'self'` (app.ts), então servir `text/html` — ou `image/svg+xml`,
 * que executa script — a partir da NOSSA origem seria XSS armazenado no domínio
 * do CRM, disparado por quem mandasse o arquivo certo no WhatsApp da empresa.
 *
 * Então: o que está na lista sai com o próprio tipo e `inline`; QUALQUER outra
 * coisa sai como `application/octet-stream` e `attachment`, que o navegador
 * baixa em vez de interpretar. O vendedor continua recebendo o arquivo; o que
 * ele não faz é executá-lo no nosso domínio.
 *
 * SVG está fora de propósito, apesar de ser imagem.
 */
const PREFIXOS_SEGUROS = ['image/', 'video/', 'audio/'];
const TIPOS_SEGUROS = new Set(['application/pdf']);

function tipoSeguro(mime: string): { contentType: string; inline: boolean } {
  const limpo = mime.toLowerCase().split(';')[0]!.trim();

  if (limpo === 'image/svg+xml' || limpo === 'image/svg') {
    return { contentType: 'application/octet-stream', inline: false };
  }
  if (TIPOS_SEGUROS.has(limpo) || PREFIXOS_SEGUROS.some((p) => limpo.startsWith(p))) {
    return { contentType: limpo, inline: true };
  }
  return { contentType: 'application/octet-stream', inline: false };
}

/**
 * Nome de arquivo para o header.
 *
 * O nome também vem do webhook, e CR/LF num header é injeção de cabeçalho — o
 * clássico. Sai um nome ASCII conservador em `filename=` e o nome real
 * percent-encoded em `filename*`, que é o que os navegadores atuais usam.
 */
function contentDisposition(nome: string, inline: boolean): string {
  const seguro = nome.replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'arquivo';
  return `${inline ? 'inline' : 'attachment'}; filename="${seguro}"; filename*=UTF-8''${encodeURIComponent(nome)}`;
}

/**
 * Bytes de um anexo recebido.
 *
 * Mesmo padrão da rota de mídia do site (publico.routes.ts), com três
 * diferenças deliberadas: exige login e `usar_whatsapp`; o cache é `private`,
 * porque isto é conversa de cliente e não imagem de site institucional; e o
 * Content-Type passa pela coerção acima.
 *
 * `immutable` é seguro porque os bytes de um id nunca mudam: a chave é o
 * hash do arquivo. O ETag é esse mesmo hash, então o 304 sai de graça.
 */
whatsappCaixaRouter.get(
  '/midia/:id',
  podeUsar,
  asyncHandler(async (req, res) => {
    const id = z.string().uuid().safeParse(req.params.id);
    if (!id.success) {
      res.status(404).json({ erro: 'Arquivo não encontrado.', codigo: 'nao_encontrado' });
      return;
    }

    const linha = await consultarUm<{
      nome_arquivo: string;
      mime_type: string;
      hash_sha256: string;
      conteudo: Buffer;
    }>(
      `SELECT nome_arquivo, mime_type, hash_sha256, conteudo
         FROM "SolarCosta_WhatsAppMidia" WHERE id = $1`,
      [id.data],
    );

    if (!linha) {
      res.status(404).json({ erro: 'Arquivo não encontrado.', codigo: 'nao_encontrado' });
      return;
    }

    const { contentType, inline } = tipoSeguro(linha.mime_type);
    const etag = `"${linha.hash_sha256}"`;

    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', contentDisposition(linha.nome_arquivo, inline));
    // O arquivo é de terceiro: impedir que o navegador adivinhe outro tipo a
    // partir dos bytes é o que faz a coerção acima valer de fato.
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }

    res.send(linha.conteudo);
  }),
);

