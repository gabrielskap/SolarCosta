// Teste de fumaça da API — exercita o caminho crítico de ponta a ponta.
//
//   node testar-fluxo.mjs
//
// A senha é pedida sem eco e não fica no histórico do shell.
// O lead de teste criado é excluído no final.

import readline from 'node:readline';
import { stdin, stdout } from 'node:process';

const API = process.env.API_URL ?? 'http://localhost:4000';

const cores = {
  ok: (t) => `\x1b[32m${t}\x1b[0m`,
  erro: (t) => `\x1b[31m${t}\x1b[0m`,
  info: (t) => `\x1b[36m${t}\x1b[0m`,
  fraco: (t) => `\x1b[90m${t}\x1b[0m`,
};

function perguntar(texto) {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  return new Promise((resolve) => rl.question(texto, (r) => { rl.close(); resolve(r.trim()); }));
}

function perguntarSenha(texto) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: stdin, output: stdout, terminal: true });
    stdout.write(texto);
    // Silencia o eco enquanto o usuário digita.
    const escrever = rl._writeToOutput;
    rl._writeToOutput = () => {};
    rl.question('', (r) => {
      rl._writeToOutput = escrever;
      stdout.write('\n');
      rl.close();
      resolve(r.trim());
    });
  });
}

let passos = 0;
let falhas = 0;

function checar(condicao, descricao, detalhe = '') {
  passos += 1;
  if (condicao) {
    console.log(`  ${cores.ok('[ok]')} ${descricao}${detalhe ? cores.fraco(' · ' + detalhe) : ''}`);
  } else {
    falhas += 1;
    console.log(`  ${cores.erro('[FALHOU]')} ${descricao}${detalhe ? ' · ' + detalhe : ''}`);
  }
}

async function chamar(metodo, caminho, { token, corpo } = {}) {
  const resposta = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: {
      ...(corpo ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(corpo ? { body: JSON.stringify(corpo) } : {}),
  });

  const texto = await resposta.text();
  let json = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { /* resposta sem corpo */ }
  return { status: resposta.status, json };
}

async function main() {
  console.log(cores.info('\n─────────────────────────────────────────────'));
  console.log(cores.info(`TESTE DE FLUXO · ${API}`));
  console.log(cores.info('─────────────────────────────────────────────\n'));

  const email = (await perguntar('E-mail: ')) || 'admin@solarcosta.com.br';
  const senha = await perguntarSenha('Senha (não aparece na tela): ');
  console.log('');

  // 1. LOGIN -----------------------------------------------------------------
  const login = await chamar('POST', '/api/auth/login', { corpo: { email, senha } });
  if (login.status !== 200) {
    console.log(cores.erro(`\nLogin falhou (HTTP ${login.status}): ${login.json?.erro ?? 'sem detalhe'}\n`));
    process.exit(1);
  }
  const token = login.json.accessToken;
  const refresh = login.json.refreshToken;
  const usuario = login.json.usuario;

  console.log('LOGIN');
  checar(!!token, 'access token emitido');
  checar(!!refresh, 'refresh token emitido');
  checar(!!usuario?.permissoes, 'permissões carregadas', usuario?.cargo);
  checar(!('senha_hash' in (usuario ?? {})), 'hash de senha NÃO vazou na resposta');

  // 2. /me -------------------------------------------------------------------
  const me = await chamar('GET', '/api/auth/me', { token });
  console.log('\nSESSÃO');
  checar(me.status === 200 && me.json?.usuario?.id === usuario.id, '/auth/me devolve o mesmo usuário');

  // 3. LEITURAS --------------------------------------------------------------
  console.log('\nLEITURAS');
  const leads = await chamar('GET', '/api/leads', { token });
  checar(leads.status === 200 && Array.isArray(leads.json?.leads), 'lista de leads', `${leads.json?.total ?? 0} registros`);

  const dash = await chamar('GET', '/api/dashboard', { token });
  checar(dash.status === 200 && Array.isArray(dash.json?.funil), 'dashboard', `funil com ${dash.json?.funil?.length ?? 0} etapas`);

  const config = await chamar('GET', '/api/config', { token });
  checar(config.status === 200 && !!config.json?.empresa, 'config da empresa', config.json?.empresa?.nome_fantasia);
  checar((config.json?.parametros?.length ?? 0) >= 26, 'parâmetros do sistema', `${config.json?.parametros?.length ?? 0} chaves`);

  const notif = await chamar('GET', '/api/notificacoes', { token });
  checar(notif.status === 200, 'notificações', `${notif.json?.contagem?.total ?? 0} pendências`);

  const catalogo = await chamar('GET', '/api/catalogo/produtos', { token });
  checar(catalogo.status === 200, 'catálogo de produtos', `${catalogo.json?.produtos?.length ?? 0} itens`);

  // 4. ESCRITA + TRIGGERS ----------------------------------------------------
  console.log('\nESCRITA (o lead de teste é removido no final)');
  const criado = await chamar('POST', '/api/leads', {
    token,
    corpo: {
      nome: 'ZZ Teste de Fluxo (apagar)',
      telefone: '(31) 90000-0000',
      cidade: 'Belo Horizonte',
      uf: 'MG',
      consumo_kwh: 750,
      concessionaria: 'CEMIG',
      telhado: 'Laje',
      origem: 'Indicação',
    },
  });

  const lead = criado.json?.lead;
  checar(criado.status === 201 && !!lead?.id, 'lead criado');
  checar(/^#\d+$/.test(lead?.numero ?? ''), 'número gerado pelo banco', lead?.numero);
  checar(lead?.concessionaria === 'CEMIG', 'nome de concessionária resolvido para id');
  checar(lead?.responsavel === null || typeof lead?.responsavel === 'string', 'responsável resolvido');

  if (lead?.id) {
    const etapa = await chamar('PATCH', `/api/leads/${lead.id}/etapa`, {
      token, corpo: { etapa: 'Contato feito' },
    });
    checar(etapa.status === 200 && etapa.json?.lead?.etapa === 'Contato feito', 'etapa alterada');

    const detalhe = await chamar('GET', `/api/leads/${lead.id}`, { token });
    const historico = detalhe.json?.historico ?? [];
    checar(historico.length >= 2, 'histórico gerado pelos triggers', `${historico.length} registros`);

    // 5. AUDITORIA — o teste que mais importa -------------------------------
    console.log('\nAUDITORIA');
    const auditoria = await chamar('GET', `/api/auditoria?tamanho=20`, { token });

    if (auditoria.status === 403) {
      console.log(`  ${cores.fraco('[pulado]')} usuário sem permissão ver_auditoria`);
    } else {
      const registros = auditoria.json?.registros ?? [];
      const meus = registros.filter((r) => r.entidade_id === lead.id);
      checar(auditoria.status === 200, 'trilha acessível');
      checar(meus.length >= 2, 'ações do teste registradas', `${meus.length} entradas`);
      checar(
        meus.every((r) => r.usuario_nome === usuario.nome),
        `autor é "${usuario.nome}", não "Sistema"`,
        meus[0]?.usuario_nome,
      );
      const mudanca = meus.find((r) => r.acao === 'mudanca_etapa');
      checar(!!mudanca?.detalhes?.includes('->') || !!mudanca?.detalhes?.includes('→'),
        'detalhe da mudança de etapa', mudanca?.detalhes);
    }

    // 6. LIMPEZA ------------------------------------------------------------
    console.log('\nLIMPEZA');
    const apagado = await chamar('DELETE', `/api/leads/${lead.id}`, { token });
    checar(apagado.status === 204, 'lead de teste removido');
  }

  // 7. REFRESH ---------------------------------------------------------------
  console.log('\nTOKENS');
  const novo = await chamar('POST', '/api/auth/refresh', { corpo: { refreshToken: refresh } });
  checar(novo.status === 200 && !!novo.json?.accessToken, 'refresh emite novo access token');

  const reusado = await chamar('POST', '/api/auth/refresh', { corpo: { refreshToken: refresh } });
  checar(reusado.status === 401, 'refresh antigo foi revogado (rotação)');

  await chamar('POST', '/api/auth/logout', {
    token: novo.json?.accessToken,
    corpo: { refreshToken: novo.json?.refreshToken },
  });
  console.log(`  ${cores.fraco('[info]')} sessão encerrada`);

  // Resultado ----------------------------------------------------------------
  console.log(cores.info('\n─────────────────────────────────────────────'));
  if (falhas === 0) {
    console.log(cores.ok(`TODOS OS ${passos} TESTES PASSARAM`));
  } else {
    console.log(cores.erro(`${falhas} de ${passos} testes falharam`));
  }
  console.log(cores.info('─────────────────────────────────────────────\n'));
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(cores.erro(`\nErro inesperado: ${e.message}\n`));
  process.exit(1);
});
