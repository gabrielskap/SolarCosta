// Executar a partir de server: npx tsx ../scripts/test-procuracoes-api.ts
// Todas as escritas, inclusive auditoria, são revertidas ao terminar.
//
// Procuração (V027) de ponta a ponta pela API: nasce de um contrato com número
// próprio e o lead dele, os jsonb vão e voltam intactos, o zod recusa o que o
// modelo não aceita, a rota pública entrega a mesma procuração que o CRM, e a
// procuração assinada não aceita edição.
//
// Precisa de um banco onde a V027 tenha conseguido alterar as CHECKs do
// WhatsApp (procuracao_envio_ativo) — num banco local montado pelas migrations,
// é o caso. Nunca rode contra produção.
import assert from 'node:assert/strict';
import { pool } from '../server/src/db.ts';
import { emitirTokenAcesso } from '../server/src/auth/tokens.ts';
import { criarApp } from '../server/src/app.ts';
import { obterOuCriarLink } from '../server/src/services/linksPublicos.ts';
import { CONTRATADA_PADRAO, termosPadrao } from '../src/contrato/padroes.ts';
import { deContrato, deProcuracao, paraContrato, paraProcuracao } from '../src/services/mappers.ts';
import { rascunhoDoContrato } from '../src/procuracao/rascunho.ts';
import type { Contrato, OutorgadoProcuracao, Procuracao } from '../src/types.ts';

const c = await pool.connect(), query = c.query.bind(c), release = c.release.bind(c);
await query('BEGIN');
let savepoint = 0;
// As transações internas usam savepoints: nunca COMMIT na transação externa do teste.
(c as any).query = (sql: any, values?: any) => typeof sql === 'string' && sql === 'BEGIN' ? query(`SAVEPOINT procuracao_${++savepoint}`) :
  sql === 'COMMIT' ? query(`RELEASE SAVEPOINT procuracao_${savepoint--}`) : sql === 'ROLLBACK' ? query(`ROLLBACK TO SAVEPOINT procuracao_${savepoint--}`) : query(sql, values);
(c as any).release = () => {};
const connect = pool.connect.bind(pool), poolQuery = pool.query.bind(pool);
(pool as any).connect = async () => c; (pool as any).query = (...args: any[]) => (c as any).query(...args);
const app = criarApp(), server = app.listen(0, '127.0.0.1');
await new Promise<void>((r) => server.on('listening', r));
const base = `http://127.0.0.1:${(server.address() as any).port}`;

try {
  const u = (await query(`SELECT id,nome,cargo FROM "SolarCosta_Usuarios" WHERE cargo='Administrador' AND status='ativo' AND excluido_em IS NULL LIMIT 1`)).rows[0];
  const lead = (await query(`SELECT id FROM "SolarCosta_Leads" WHERE excluido_em IS NULL LIMIT 1`)).rows[0];
  assert(u && lead, 'Teste exige usuário administrador e um lead');
  const headers = { Authorization: `Bearer ${emitirTokenAcesso({ sub: u.id, nome: u.nome, cargo: u.cargo })}`, 'Content-Type': 'application/json' };
  const api = async (metodo: string, caminho: string, corpo?: unknown) => {
    const r = await fetch(`${base}${caminho}`, { method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
    return { status: r.status, data: r.status === 204 ? null : await r.json() };
  };

  // ------------------------------------------------------- contrato de origem
  const contratoNovo: Contrato = {
    id: '', numero: '', leadId: lead.id, clienteNome: 'Carla Cliente Fictícia', cpfCnpj: '529.982.247-25',
    rgInscricao: 'MG-7', endereco: 'Rua das Flores, 35 – Jardim Exemplo, Belo Horizonte/MG', cep: '31640-000',
    telefone: '(31) 98888-0000', potenciaKwp: 5.64, modulosQtd: 8, moduloModelo: '705 W', inversorModelo: '',
    estrutura: '', prazoExecucao: '', localInstalacao: '', valorTotal: 15990, formaPagamento: '', entrada: '',
    parcelasInfo: '', bancoAgente: '', primeiroVencimento: '', multaAtraso: '', foroEleito: '',
    garantias: { modulos: '', inversores: '', instalacao: '', homologacao: '' }, responsavelTecnico: '', crea: '',
    clausulas: [], status: 'aguardando', dataEmissao: '', modeloVersao: 1,
    termos: { ...termosPadrao(null), contratanteNacionalidade: 'brasileira', concessionaria: 'CEMIG' },
    contratada: { ...CONTRATADA_PADRAO },
  };
  const contratoCriado = await api('POST', '/api/contratos', deContrato(contratoNovo));
  assert.equal(contratoCriado.status, 201, JSON.stringify(contratoCriado.data));
  const contrato = paraContrato(contratoCriado.data.contrato);

  // ------------------------------------------------------------- criar
  assert.equal((await fetch(`${base}/api/procuracoes`)).status, 401, 'sem login');

  const ana: OutorgadoProcuracao = {
    nome: 'Ana Teste Exemplo', genero: 'F', nacionalidade: 'brasileira', cpf: '111.222.333-44', rg: '',
    endereco: 'Rua Um, 10 – Bairro Centro, Belo Horizonte/MG, CEP 30.000-000',
  };
  const bruno: OutorgadoProcuracao = { ...ana, nome: 'Bruno Teste Exemplo', genero: 'M', nacionalidade: 'brasileiro', cpf: '555.666.777-88' };
  const rascunho = rascunhoDoContrato(contrato, null);
  // O contrato chega sem lead na procuração: o servidor tem de herdar o dele.
  const nova: Procuracao = {
    ...rascunho,
    leadId: '',
    outorgados: [bruno, ana],
    termos: {
      ...rascunho.termos,
      dataDocumento: '2026-10-28',
      textos: { poderes: 'Representar perante a {concessionaria} na UC 3001234567.' },
    },
  };
  assert.equal(nova.contratoId, contrato.id);
  assert.equal(nova.termos.outorganteGenero, 'F', 'gênero deduzido da nacionalidade do contrato');

  const criada = await api('POST', '/api/procuracoes', deProcuracao(nova));
  assert.equal(criada.status, 201, JSON.stringify(criada.data));
  const id = criada.data.procuracao.id as string;
  assert.match(criada.data.procuracao.numero, /^PROC-\d{4}-\d{4}$/, 'número próprio gerado pelo banco');

  const lida = paraProcuracao((await api('GET', `/api/procuracoes/${id}`)).data.procuracao);
  assert.equal(lida.contratoId, contrato.id);
  assert.equal(lida.contratoNumero, contrato.numero, 'número do contrato vem na consulta');
  assert.equal(lida.leadId, lead.id, 'lead herdado do contrato');
  assert.equal(lida.rgInscricao, 'MG-7');
  assert.equal(lida.status, 'aguardando');
  assert.deepEqual(lida.outorgados, [bruno, ana], 'outorgados voltam intactos e na ordem');
  assert.deepEqual(lida.termos, nova.termos, 'termos voltam intactos');

  const lista = (await api('GET', '/api/procuracoes')).data.procuracoes;
  assert(lista.some((p: any) => p.id === id && p.contrato_numero === contrato.numero), 'lista traz a procuração completa');
  const doContrato = (await api('GET', `/api/procuracoes?contrato_id=${contrato.id}`)).data.procuracoes;
  assert.deepEqual(doContrato.map((p: any) => p.id), [id], 'filtro por contrato');

  // ---------------------------------------------------------- validar
  const semOutorgado = await api('POST', '/api/procuracoes', deProcuracao({ ...nova, outorgados: [] }));
  assert.equal(semOutorgado.status, 422, 'procuração sem outorgado é recusada');
  const semCpf = await api('POST', '/api/procuracoes', deProcuracao({ ...nova, outorgados: [{ ...ana, cpf: '' }] }));
  assert.equal(semCpf.status, 422, 'outorgado sem CPF é recusado');
  const secaoErrada = await api('POST', '/api/procuracoes', deProcuracao({ ...nova, termos: { ...nova.termos, textos: { clausula_1: 'x' } as any } }));
  assert.equal(secaoErrada.status, 422, 'seção de texto desconhecida é recusada');
  const semNome = await api('POST', '/api/procuracoes', deProcuracao({ ...nova, clienteNome: '  ' }));
  assert.equal(semNome.status, 422, 'outorgante em branco é recusado');

  // ----------------------------------------------------------- editar
  const editada = await api('PUT', `/api/procuracoes/${id}`, deProcuracao({
    ...lida, clienteNome: 'Carla Editada', outorgados: [ana], termos: { ...lida.termos, textos: {}, localAssinatura: 'Contagem/MG' },
  }));
  assert.equal(editada.status, 200, JSON.stringify(editada.data));
  const relida = paraProcuracao(editada.data.procuracao);
  assert.equal(relida.clienteNome, 'Carla Editada');
  assert.deepEqual(relida.outorgados, [ana]);
  assert.deepEqual(relida.termos.textos, {}, 'texto personalizado removido');
  assert.equal(relida.contratoId, contrato.id, 'vínculo com o contrato preservado');

  // ----------------------------------------------------------- público
  const config = (await api('GET', '/api/config')).data;
  assert.equal(config.procuracao_envio_ativo, true, 'banco aceita procuração no link e na mensagem');
  assert(config.parametros.some((p: any) => p.chave === 'procuracao.outorgados'), 'parâmetro da V027');

  const token = await obterOuCriarLink(c as any, 'procuracao', id, u.id);
  const pub = await fetch(`${base}/api/publico/documento/${encodeURIComponent(token)}`).then((r) => r.json());
  assert.equal(pub.tipo, 'procuracao');
  const doPublico = paraProcuracao(pub.documento);
  assert.deepEqual(doPublico.termos, relida.termos, 'link do cliente traz os mesmos termos do CRM');
  assert.deepEqual(doPublico.outorgados, relida.outorgados);
  assert.equal(doPublico.contratoNumero, contrato.numero);
  assert.equal(pub.documento.telefone, undefined, 'telefone fica fora do link público');
  assert.equal(pub.documento.lead_id, undefined, 'lead fica fora do link público');

  // Link de contrato continua indo para o contrato (o ramo explícito não o quebrou).
  const tokenContrato = await obterOuCriarLink(c as any, 'contrato', contrato.id, u.id);
  const pubContrato = await fetch(`${base}/api/publico/documento/${encodeURIComponent(tokenContrato)}`).then((r) => r.json());
  assert.equal(pubContrato.tipo, 'contrato');

  // ---------------------------------------------------------- assinar
  const assinada = await api('POST', `/api/procuracoes/${id}/assinar`, { data_assinatura: '2026-10-29' });
  assert.equal(assinada.status, 200, JSON.stringify(assinada.data));
  assert.equal(paraProcuracao(assinada.data.procuracao).dataAssinatura, '29/10/2026');
  assert.equal(paraProcuracao(assinada.data.procuracao).status, 'assinada');
  const bloqueada = await api('PUT', `/api/procuracoes/${id}`, deProcuracao(relida));
  assert.equal(bloqueada.status, 409, 'procuração assinada não aceita edição');
  assert.equal(bloqueada.data.codigo, 'procuracao_assinada');
  assert.equal((await api('POST', `/api/procuracoes/${id}/assinar`, {})).status, 409, 'não assina duas vezes');

  // --------------------------------------------------------- auditoria
  const trilha = (await query(
    `SELECT acao::text AS acao, entidade::text AS entidade, detalhes FROM "SolarCosta_Auditoria"
      WHERE entidade_id = $1 ORDER BY id`, [id])).rows;
  assert.deepEqual(trilha.map((t: any) => t.acao), ['criar', 'editar', 'editar'], 'criar, editar e assinar auditados');
  assert(trilha.every((t: any) => t.entidade === 'Contrato'), 'auditada como Contrato (sem ALTER TYPE)');
  assert.equal(trilha[2].detalhes, 'Procuração assinada.');

  // ----------------------------------------------------------- excluir
  assert.equal((await api('DELETE', `/api/procuracoes/${id}`)).status, 204);
  const sumiu = await api('GET', `/api/procuracoes/${id}`);
  assert.equal(sumiu.status, 404);
  assert.equal(sumiu.data.erro, 'Procuração não encontrada.');
  assert(!(await api('GET', '/api/procuracoes')).data.procuracoes.some((p: any) => p.id === id), 'excluída sai da lista');

  // ----------------------------------------------------------- padrões
  const params = await api('PATCH', '/api/config/parametros', {
    parametros: [{ chave: 'procuracao.outorgados', valor: JSON.stringify([ana]) }],
  });
  assert.equal(params.status, 200, 'outorgados padrão editáveis (V027)');

  console.log('procurações pela API: ok');
} finally {
  server.close();
  await query('ROLLBACK');
  (pool as any).connect = connect; (pool as any).query = poolQuery; (c as any).release = release;
  release();
  await pool.end();
}
