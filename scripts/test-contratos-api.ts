// Executar a partir de server: npx tsx ../scripts/test-contratos-api.ts
// Todas as escritas, inclusive auditoria, são revertidas ao terminar.
//
// Contrato no modelo Solar Costa (V024) de ponta a ponta pela API: os jsonb
// vão e voltam intactos, as colunas antigas nascem dos termos, a rota pública
// entrega o mesmo contrato que o CRM e o contrato assinado não aceita edição.
import assert from 'node:assert/strict';
import { pool } from '../server/src/db.ts';
import { emitirTokenAcesso } from '../server/src/auth/tokens.ts';
import { criarApp } from '../server/src/app.ts';
import { obterOuCriarLink } from '../server/src/services/linksPublicos.ts';
import { CONTRATADA_PADRAO, anexoDoSistema, termosPadrao } from '../src/contrato/padroes.ts';
import { deContrato, paraContrato } from '../src/services/mappers.ts';
import type { Contrato } from '../src/types.ts';

const c = await pool.connect(), query = c.query.bind(c), release = c.release.bind(c);
await query('BEGIN');
let savepoint = 0;
// As transações internas usam savepoints: nunca COMMIT na transação externa do teste.
(c as any).query = (sql: any, values?: any) => typeof sql === 'string' && sql === 'BEGIN' ? query(`SAVEPOINT contrato_${++savepoint}`) :
  sql === 'COMMIT' ? query(`RELEASE SAVEPOINT contrato_${savepoint--}`) : sql === 'ROLLBACK' ? query(`ROLLBACK TO SAVEPOINT contrato_${savepoint--}`) : query(sql, values);
(c as any).release = () => {};
const connect = pool.connect.bind(pool), poolQuery = pool.query.bind(pool);
(pool as any).connect = async () => c; (pool as any).query = (...args: any[]) => (c as any).query(...args);
const app = criarApp(), server = app.listen(0, '127.0.0.1');
await new Promise<void>((r) => server.on('listening', r));
const base = `http://127.0.0.1:${(server.address() as any).port}`;

try {
  const u = (await query(`SELECT id,nome,cargo FROM "SolarCosta_Usuarios" WHERE cargo='Administrador' AND status='ativo' AND excluido_em IS NULL LIMIT 1`)).rows[0];
  const p = (await query(`SELECT id, lead_id FROM "SolarCosta_Propostas" WHERE excluido_em IS NULL LIMIT 1`)).rows[0];
  assert(u && p, 'Teste exige usuário administrador e uma proposta');
  const headers = { Authorization: `Bearer ${emitirTokenAcesso({ sub: u.id, nome: u.nome, cargo: u.cargo })}`, 'Content-Type': 'application/json' };
  const api = async (metodo: string, caminho: string, corpo?: unknown) => {
    const r = await fetch(`${base}${caminho}`, { method: metodo, headers, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
    return { status: r.status, data: r.status === 204 ? null : await r.json() };
  };

  const termos = {
    ...termosPadrao(null),
    contratanteNacionalidade: 'brasileira',
    contratanteEmail: 'cliente@exemplo.com',
    enderecoEntrega: 'Rua Alameda Jatai 1380, Brumadinho/MG',
    condicoesPagamento: 'R$ 10.000,00 no cartão e R$ 5.990,00 na entrega.',
    dataDocumento: '2026-09-08',
    prazoExecucaoDias: 50,
    multaMoratoriaPct: 2.5,
    anexoItens: anexoDoSistema({ modulosQtd: 8, moduloModelo: '705 W', inversorModelo: 'Hoymiles', estrutura: 'Colonial' }),
    testemunhas: [{ nome: 'Ana', rg: 'MG1', cpf: '111.111.111-11' }, { nome: '', rg: '', cpf: '' }],
    textos: { clausula_4: '4.1 Texto negociado com {prazo_execucao_dias} dias.' },
  };
  const novo: Contrato = {
    id: '', numero: '', leadId: p.lead_id ?? '', propostaId: p.id, clienteNome: 'Cliente Teste Contrato',
    cpfCnpj: '529.982.247-25', rgInscricao: '', endereco: 'Rua A, 1', cep: '30000-000', telefone: '(31) 90000-0000',
    potenciaKwp: 5.64, modulosQtd: 8, moduloModelo: '705 W', inversorModelo: 'Hoymiles', estrutura: 'Colonial',
    prazoExecucao: '', localInstalacao: '', valorTotal: 15990, formaPagamento: 'Cartão de crédito', entrada: '',
    parcelasInfo: '', bancoAgente: '', primeiroVencimento: '', multaAtraso: '', foroEleito: '',
    garantias: { modulos: '', inversores: '', instalacao: '', homologacao: '' }, responsavelTecnico: '', crea: '',
    clausulas: [], status: 'aguardando', dataEmissao: '', modeloVersao: 1, termos, contratada: { ...CONTRATADA_PADRAO },
  };

  // ------------------------------------------------------------ criar
  assert.equal((await fetch(`${base}/api/contratos`)).status, 401, 'sem login');
  const criado = await api('POST', '/api/contratos', deContrato(novo));
  assert.equal(criado.status, 201, JSON.stringify(criado.data));
  const id = criado.data.contrato.id as string;
  assert.match(criado.data.contrato.numero, /^\d{4}-\d{4}$/, 'número gerado pelo banco');

  const lido = paraContrato((await api('GET', `/api/contratos/${id}`)).data.contrato);
  assert.equal(lido.modeloVersao, 1);
  assert.equal(lido.propostaId, p.id, 'proposta_id não se perde mais');
  assert.deepEqual(lido.termos, termos, 'termos voltam intactos');
  assert.deepEqual(lido.contratada, CONTRATADA_PADRAO, 'contratada volta intacta');
  const colunas = (await query(`SELECT prazo_execucao, multa_atraso, foro_eleito, local_instalacao FROM "SolarCosta_Contratos" WHERE id=$1`, [id])).rows[0];
  assert.deepEqual(colunas, {
    prazo_execucao: '50 dias corridos', multa_atraso: '2,5% + 1% a.m.', foro_eleito: 'Belo Horizonte',
    local_instalacao: 'Rua Alameda Jatai 1380, Brumadinho/MG',
  }, 'colunas antigas derivadas dos termos');

  // ---------------------------------------------------------- validar
  const invalido = await api('POST', '/api/contratos', deContrato({ ...novo, termos: { ...termos, textos: { clausula_99: 'x' } as any } }));
  assert.equal(invalido.status, 422, 'seção de texto desconhecida é recusada');
  const pctInvalido = await api('POST', '/api/contratos', deContrato({ ...novo, termos: { ...termos, multaMoratoriaPct: 150 } }));
  assert.equal(pctInvalido.status, 422, 'percentual acima de 100 é recusado');

  // ----------------------------------------------------------- editar
  const editado = await api('PUT', `/api/contratos/${id}`, deContrato({
    ...lido, termos: { ...termos, textos: {}, foro: 'Contagem' }, clienteNome: 'Cliente Editado',
  }));
  assert.equal(editado.status, 200, JSON.stringify(editado.data));
  const relido = paraContrato(editado.data.contrato);
  assert.equal(relido.clienteNome, 'Cliente Editado');
  assert.deepEqual(relido.termos?.textos, {}, 'texto personalizado removido');
  assert.equal(relido.termos?.foro, 'Contagem');

  // ----------------------------------------------------------- público
  const token = await obterOuCriarLink(c as any, 'contrato', id, u.id);
  const pub = await fetch(`${base}/api/publico/documento/${encodeURIComponent(token)}`).then((r) => r.json());
  assert.equal(pub.tipo, 'contrato');
  const doPublico = paraContrato(pub.documento);
  assert.equal(doPublico.modeloVersao, 1);
  assert.deepEqual(doPublico.termos, relido.termos, 'link do cliente traz os mesmos termos do CRM');
  assert.deepEqual(doPublico.contratada, relido.contratada);
  assert.equal(doPublico.telefone, novo.telefone, 'telefone no link público');
  assert.equal(pub.empresa.representante_nome, 'Giselle Alonso Costa', 'representante no cadastro (V024)');

  // ---------------------------------------------------------- assinar
  const assinado = await api('POST', `/api/contratos/${id}/assinar`, { data_assinatura: '2026-09-10' });
  assert.equal(assinado.status, 200, JSON.stringify(assinado.data));
  assert.equal(paraContrato(assinado.data.contrato).dataAssinatura, '10/09/2026');
  const bloqueado = await api('PUT', `/api/contratos/${id}`, deContrato(relido));
  assert.equal(bloqueado.status, 409, 'contrato assinado não aceita edição');

  // ----------------------------------------------------------- empresa
  const empresa = await api('PATCH', '/api/config/empresa', { representante_nome: 'Outra Pessoa', representante_cpf: '000.000.000-00' });
  assert.equal(empresa.status, 200, JSON.stringify(empresa.data));
  assert.equal(empresa.data.empresa.representante_nome, 'Outra Pessoa');
  assert.equal(empresa.data.empresa.razao_social, 'SOLAR COSTA LTDA', 'COALESCE preserva o resto');
  const congelado = paraContrato((await api('GET', `/api/contratos/${id}`)).data.contrato);
  assert.equal(congelado.contratada?.representanteNome, CONTRATADA_PADRAO.representanteNome, 'cópia do contrato não muda com o cadastro');

  const params = await api('PATCH', '/api/config/parametros', { parametros: [{ chave: 'contrato.prazo_execucao_dias', valor: '60' }] });
  assert.equal(params.status, 200, 'parâmetro novo da V024 é editável');

  console.log('contratos pela API: ok');
} finally {
  server.close();
  await query('ROLLBACK');
  (pool as any).connect = connect; (pool as any).query = poolQuery; (c as any).release = release;
  release();
  await pool.end();
}
