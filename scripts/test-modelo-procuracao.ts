// Executar: npx tsx scripts/test-modelo-procuracao.ts
//
// Garante que o texto da procuração e os dados se encaixam: nenhum marcador
// sem definição, nenhum `{…}` sobrando numa procuração completa, concordância
// de gênero, pessoa jurídica, um e vários outorgados, padrões vindos do
// cadastro, texto personalizado valendo só na sua seção, e o servidor aceitando
// exatamente as mesmas seções. Dados fictícios.
import assert from 'node:assert/strict';
import type { Contrato, OutorgadoProcuracao, Procuracao } from '../src/types.ts';
import type { ConfigApp } from '../src/services/api.ts';
import { CHAVES_SECOES, SECOES, tituloNoQuadro } from '../src/procuracao/modeloProcuracao.ts';
import { MARCADORES, concordar, marcador, prepararProcuracao } from '../src/procuracao/marcadores.ts';
import {
  marcadoresDesconhecidos, paragrafosDaSecao, secaoPersonalizada, textoPlanoDaSecao,
} from '../src/procuracao/renderizar.ts';
import {
  ajustarNacionalidade, generoDaNacionalidade, outorgadosPadrao, termosPadraoProcuracao,
} from '../src/procuracao/padroes.ts';
import { aplicarContrato, pendenciasObrigatorias, rascunhoNovo } from '../src/procuracao/rascunho.ts';
import {
  CHAVES_SECOES_PROCURACAO, outorgadosProcuracaoSchema, termosProcuracaoSchema,
} from '../server/src/schemas/procuracao.ts';

// ---------------------------------------------------------------- modelo
assert.deepEqual([...CHAVES_SECOES], [...CHAVES_SECOES_PROCURACAO], 'seções do front e do servidor iguais');
assert.equal(new Set(MARCADORES.map((m) => m.chave)).size, MARCADORES.length, 'marcadores sem repetição');
for (const s of SECOES) {
  assert.deepEqual(marcadoresDesconhecidos(s.texto), [], `marcadores válidos em ${s.chave}`);
}

// ------------------------------------------------------------ procuração
const ana: OutorgadoProcuracao = {
  nome: 'Ana Teste Exemplo', genero: 'F', nacionalidade: 'brasileira', cpf: '111.222.333-44', rg: '',
  endereco: 'Rua Um, 10 – Bairro Centro, Belo Horizonte/MG, CEP 30.000-000',
};
const bruno: OutorgadoProcuracao = {
  nome: 'Bruno Teste Exemplo', genero: 'M', nacionalidade: 'brasileiro', cpf: '555.666.777-88', rg: 'MG-1.234',
  endereco: 'Rua Dois, 20, Contagem/MG',
};
const base: Procuracao = {
  id: 'x', numero: 'PROC-2026-0001', leadId: '', contratoId: '', contratoNumero: '2026-0185',
  modeloVersao: 1, clienteNome: 'Carla Cliente Fictícia', cpfCnpj: '123.456.789-09', rgInscricao: '',
  endereco: 'Rua das Flores, 35 – Jardim Exemplo, Belo Horizonte/MG', cep: '31640-000', telefone: '(31) 99999-0000',
  outorgados: [bruno, ana],
  termos: {
    ...termosPadraoProcuracao(null),
    outorganteGenero: 'F',
    outorganteNacionalidade: 'brasileira',
    concessionaria: 'CEMIG',
    localAssinatura: 'Belo Horizonte/MG',
    dataDocumento: '2026-10-28',
  },
  status: 'aguardando', dataEmissao: '28/10/2026',
};
const d = prepararProcuracao(base);
const texto = (dados: typeof d, chave: (typeof CHAVES_SECOES)[number]) => textoPlanoDaSecao(dados, chave);

for (const chave of CHAVES_SECOES) {
  const t = texto(d, chave);
  assert(!/\{[a-z0-9_]+\}/.test(t), `nenhum marcador sobrando em ${chave}: ${t.match(/\{[a-z0-9_]+\}/)?.[0]}`);
  assert(!t.includes('________'), `nenhum campo vazio em ${chave}: ${t}`);
}

assert.equal(texto(d, 'abertura'), 'Pelo presente instrumento particular de mandato.');
assert.equal(
  texto(d, 'outorgante'),
  'Carla Cliente Fictícia, brasileira, inscrita no CPF sob nº 123.456.789-09, residente e domiciliada no endereço '
    + 'Rua das Flores, 35 – Jardim Exemplo, Belo Horizonte/MG, CEP 31640-000',
);
assert(paragrafosDaSecao(d, 'outorgante')[0].trechos[0].negrito, 'nome do outorgante em negrito, como no .docx');
assert.equal(
  texto(d, 'outorgados'),
  'Bruno Teste Exemplo, brasileiro, portador do CPF nº 555.666.777-88, RG nº MG-1.234, residente no endereço Rua Dois, 20, Contagem/MG'
    + ' e Ana Teste Exemplo, brasileira, portadora do CPF nº 111.222.333-44, residente no endereço Rua Um, 10 – Bairro Centro, Belo Horizonte/MG, CEP 30.000-000.',
);
assert.match(texto(d, 'poderes'), /^Representar o OUTORGANTE perante a Concessionária CEMIG, assinando/);
assert.match(texto(d, 'poderes'), /relativas a todas as unidades consumidoras em meu nome\.$/);
assert.match(texto(d, 'vigencia'), /vedado o substabelecimento dos poderes outorgados\.$/);
assert.equal(texto(d, 'fecho'), 'Belo Horizonte/MG, 28 de Outubro de 2026');

// Rótulo do quadro no singular com um outorgado só.
assert.equal(tituloNoQuadro('outorgados', 2), 'OUTORGADOS:');
assert.equal(tituloNoQuadro('outorgados', 1), 'OUTORGADO:');
assert.equal(tituloNoQuadro('poderes', 1), 'PODERES CONFERIDOS:');

// ------------------------------------------------------------ concordância
assert.equal(concordar('M', 'inscrito', 'inscrita'), 'inscrito');
assert.equal(concordar('F', 'inscrito', 'inscrita'), 'inscrita');
assert.equal(concordar('', 'inscrito', 'inscrita'), 'inscrito(a)');
const masculino = prepararProcuracao({
  ...base,
  rgInscricao: 'MG-9.876',
  termos: { ...base.termos, outorganteGenero: 'M', outorganteNacionalidade: 'brasileiro', outorganteEstadoCivil: 'casado', outorganteProfissao: 'engenheiro' },
});
assert.match(texto(masculino, 'outorgante'), /, brasileiro, casado, engenheiro, inscrito no CPF sob nº 123\.456\.789-09, portador do RG nº MG-9\.876, residente e domiciliado no endereço/);
const neutro = prepararProcuracao({ ...base, termos: { ...base.termos, outorganteGenero: '', outorganteNacionalidade: 'brasileiro(a)' } });
assert.match(texto(neutro, 'outorgante'), /brasileiro\(a\), inscrito\(a\) no CPF sob nº .*, residente e domiciliado\(a\) no endereço/);
assert.equal(generoDaNacionalidade('brasileira'), 'F');
assert.equal(generoDaNacionalidade('Brasileiro'), 'M');
assert.equal(generoDaNacionalidade('brasileiro(a)'), '');
assert.equal(ajustarNacionalidade('brasileiro(a)', 'F'), 'brasileira');
assert.equal(ajustarNacionalidade('brasileira', 'M'), 'brasileiro');
assert.equal(ajustarNacionalidade('portuguesa', 'M'), 'portuguesa', 'nacionalidade digitada não muda');

// ---------------------------------------------------- PJ e campos vazios
const pj = prepararProcuracao({
  ...base, clienteNome: 'Padaria Exemplo Ltda', cpfCnpj: '12.345.678/0001-90',
  termos: { ...base.termos, representanteNome: 'Davi Sócio', representanteGenero: 'M', representanteCpf: '999.888.777-66' },
});
assert.match(texto(pj, 'outorgante'), /^Padaria Exemplo Ltda, pessoa jurídica de direito privado, inscrita no CNPJ sob nº 12\.345\.678\/0001-90, com sede no endereço .*, neste ato representada por Davi Sócio, inscrito no CPF sob nº 999\.888\.777-66$/);
assert(!texto(pj, 'outorgante').includes('residente'));
const pjSemRepresentante = prepararProcuracao({ ...base, cpfCnpj: '12.345.678/0001-90' });
assert.match(texto(pjSemRepresentante, 'outorgante'), /representada por ________, inscrito\(a\) no CPF sob nº ________$/, 'representante em branco vira linha');

const umSo = prepararProcuracao({ ...base, outorgados: [ana, { ...bruno, nome: '', cpf: '' }] });
assert.match(texto(umSo, 'outorgados'), /^Ana Teste Exemplo, brasileira, portadora/);
assert(!texto(umSo, 'outorgados').includes(' e '), 'linha em branco do formulário não entra no texto');
const tres = prepararProcuracao({ ...base, outorgados: [ana, bruno, { ...ana, nome: 'Clara Terceira' }] });
assert.match(texto(tres, 'outorgados'), /Ana Teste Exemplo, .*; Bruno Teste Exemplo, .* e Clara Terceira, /);
const semOutorgados = prepararProcuracao({ ...base, outorgados: [] });
assert.equal(texto(semOutorgados, 'outorgados'), '________.');
const semData = prepararProcuracao({ ...base, termos: { ...base.termos, dataDocumento: '' } });
assert.equal(texto(semData, 'fecho'), 'Belo Horizonte/MG, ____ de ________________ de ________');

// -------------------------------------------------- texto personalizado
const personalizada = prepararProcuracao({
  ...base,
  termos: { ...base.termos, textos: { poderes: 'Representar perante a **{concessionaria}** na UC 3001234567 e {marcador_inexistente}.' } },
});
assert.equal(secaoPersonalizada(personalizada, 'poderes'), true);
assert.equal(secaoPersonalizada(personalizada, 'vigencia'), false);
assert.equal(texto(personalizada, 'poderes'), 'Representar perante a CEMIG na UC 3001234567 e {marcador_inexistente}.');
const [poderes] = paragrafosDaSecao(personalizada, 'poderes');
assert(poderes.trechos.some((t) => t.negrito && t.texto === 'CEMIG'));
assert(poderes.trechos.some((t) => t.desconhecido));
assert.equal(texto(personalizada, 'vigencia'), texto(d, 'vigencia'), 'outras seções seguem o modelo');
assert.deepEqual(marcadoresDesconhecidos('{marcador_inexistente} e {concessionaria}'), ['{marcador_inexistente}']);
assert.equal(secaoPersonalizada(prepararProcuracao({ ...base, termos: { ...base.termos, textos: { poderes: '  ' } } }), 'poderes'), false);
assert(texto(prepararProcuracao({ ...base, clienteNome: '**Nome**' }), 'outorgante').includes('**Nome**'), 'valor não vira marcação');

// ------------------------------------------- padrões e geração do contrato
const empresa = {
  razao_social: 'SOLAR EXEMPLO LTDA', endereco: 'Rua Três, 30', bairro: 'Vila Nova', cidade: 'Belo Horizonte', uf: 'MG',
  cep: '31.000-000', representante_nome: 'Eva Representante', representante_nacionalidade: 'brasileira',
  representante_rg: 'MG-5', representante_cpf: '000.111.222-33',
};
const config = (outorgados: string): ConfigApp => ({
  empresa,
  parametros: [
    { chave: 'procuracao.outorgados', valor: outorgados, tipo: 'json', grupo: 'procuracao', descricao: '' },
    { chave: 'contrato.concessionaria', valor: 'CEMIG', tipo: 'texto', grupo: 'contrato', descricao: '' },
  ],
  concessionarias: [], origens: [], telhados: [], categorias: [], pastas: [], bancos: [], presets: [], clausulas: [],
} as unknown as ConfigApp);

// Lista vazia (como a V027 semeia): cai no representante, com o endereço da empresa.
const [doCadastro] = outorgadosPadrao(config('[]'));
assert.deepEqual(doCadastro, {
  nome: 'Eva Representante', genero: 'F', nacionalidade: 'brasileira', cpf: '000.111.222-33', rg: '',
  endereco: 'Rua Três, 30 – Bairro Vila Nova, Belo Horizonte/MG, CEP 31.000-000',
});
assert.deepEqual(outorgadosPadrao(config(JSON.stringify([bruno, ana]))), [bruno, ana]);
assert.deepEqual(outorgadosPadrao(config('{quebrado')), [doCadastro], 'json quebrado não derruba o editor');

const novo = rascunhoNovo(config('[]'));
assert.equal(novo.termos.concessionaria, 'CEMIG');
assert.equal(novo.termos.localAssinatura, 'Belo Horizonte/MG');
assert.deepEqual(pendenciasObrigatorias(novo), [
  'Informe o outorgante.', 'CPF/CNPJ é obrigatório na procuração.', 'Informe o endereço do outorgante.',
]);

const contrato = {
  id: 'c1', numero: '2026-0185', leadId: 'l1', clienteNome: 'Carla Cliente Fictícia', cpfCnpj: '123.456.789-09',
  rgInscricao: 'MG-7', endereco: 'Rua das Flores, 35', cep: '31640-000', telefone: '(31) 98888-0000',
  potenciaKwp: 5, modulosQtd: 8, moduloModelo: '', inversorModelo: '', estrutura: '', prazoExecucao: '',
  localInstalacao: '', valorTotal: 1, formaPagamento: '', entrada: '', parcelasInfo: '', bancoAgente: '',
  primeiroVencimento: '', multaAtraso: '', foroEleito: '',
  garantias: { modulos: '', inversores: '', instalacao: '', homologacao: '' },
  responsavelTecnico: '', crea: '', clausulas: [], status: 'aguardando', dataEmissao: '08/09/2026',
  modeloVersao: 1,
  termos: { ...termosPadraoProcuracao(null), contratanteNacionalidade: 'brasileira', concessionaria: 'Cemig', localAssinatura: 'Contagem/MG' },
} as unknown as Contrato;
const gerada = aplicarContrato(novo, contrato, config('[]'));
assert.equal(gerada.contratoId, 'c1');
assert.equal(gerada.contratoNumero, '2026-0185');
assert.equal(gerada.leadId, 'l1');
assert.equal(gerada.rgInscricao, 'MG-7');
assert.equal(gerada.telefone, '(31) 98888-0000');
assert.equal(gerada.termos.outorganteNacionalidade, 'brasileira');
assert.equal(gerada.termos.outorganteGenero, 'F', 'gênero deduzido da nacionalidade do contrato');
assert.equal(gerada.termos.concessionaria, 'Cemig');
assert.equal(gerada.termos.localAssinatura, 'Contagem/MG');
assert.deepEqual(pendenciasObrigatorias(gerada), []);
assert.deepEqual(pendenciasObrigatorias({ ...gerada, outorgados: [{ ...ana, cpf: '' }] }), ['Cada outorgado precisa de nome e CPF.']);

// ------------------------------------------------------------- servidor
assert.deepEqual(termosProcuracaoSchema.parse(JSON.parse(JSON.stringify(base.termos))), base.termos, 'servidor aceita os termos do front');
assert.deepEqual(outorgadosProcuracaoSchema.parse([bruno, ana]), [bruno, ana]);
assert.throws(() => termosProcuracaoSchema.parse({ ...base.termos, textos: { clausula_1: 'x' } }), /desconhecida/);
assert.throws(() => termosProcuracaoSchema.parse({ ...base.termos, dataDocumento: '28/10/2026' }), /AAAA-MM-DD/);
assert.throws(() => termosProcuracaoSchema.parse({ ...base.termos, outorganteGenero: 'X' }));
assert.throws(() => outorgadosProcuracaoSchema.parse([]), /ao menos um/);
assert.throws(() => outorgadosProcuracaoSchema.parse([ana, ana, ana, ana, ana, ana]), /até 5/);
assert.throws(() => outorgadosProcuracaoSchema.parse([{ ...ana, cpf: ' ' }]), /CPF/);

assert.equal(marcador('nao_existe'), undefined);

console.log('modelo da procuração: ok');
