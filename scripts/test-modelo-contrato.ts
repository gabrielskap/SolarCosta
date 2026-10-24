// Executar: npx tsx scripts/test-modelo-contrato.ts
//
// Garante que o texto do modelo e os dados se encaixam: nenhum marcador sem
// definição, nenhum `{…}` sobrando num contrato completo, texto personalizado
// valendo só na sua seção, e o servidor aceitando exatamente as mesmas seções.
import assert from 'node:assert/strict';
import type { Contrato } from '../src/types.ts';
import { CHAVES_SECOES, SECOES } from '../src/contrato/modeloSolarCosta.ts';
import { MARCADORES, dataPorExtenso, marcador, prepararContrato } from '../src/contrato/marcadores.ts';
import {
  blocosDaSecao, marcadoresDesconhecidos, secaoPersonalizada, textoPlano,
} from '../src/contrato/renderizar.ts';
import {
  CONTRATADA_PADRAO, anexoDoSistema, termosDeContratoLegado, termosPadrao,
} from '../src/contrato/padroes.ts';
import { CHAVES_SECOES_CONTRATO, termosContratoSchema, contratadaContratoSchema } from '../server/src/schemas/contrato.ts';

// ---------------------------------------------------------------- modelo
assert.deepEqual([...CHAVES_SECOES], [...CHAVES_SECOES_CONTRATO], 'seções do front e do servidor iguais');
assert.equal(new Set(MARCADORES.map((m) => m.chave)).size, MARCADORES.length, 'marcadores sem repetição');
for (const s of SECOES) {
  assert.deepEqual(marcadoresDesconhecidos(s.texto), [], `marcadores válidos em ${s.chave}`);
}

// --------------------------------------------------------------- contrato
const base: Contrato = {
  id: 'x', numero: '2026-0185', leadId: '', clienteNome: 'Valeria Cristina Tavares',
  cpfCnpj: '607.351.986-91', rgInscricao: '', endereco: 'Rua Alameda Jatai 1380, Brumadinho/MG', cep: '35460-000',
  telefone: '(31) 99999-0000', potenciaKwp: 5.64, modulosQtd: 8, moduloModelo: 'monocristalino 705 W',
  inversorModelo: 'Micro inversor Hoymiles 2 kW 220 V', estrutura: 'Colonial', prazoExecucao: '',
  localInstalacao: '', valorTotal: 15990, formaPagamento: '', entrada: '', parcelasInfo: '',
  bancoAgente: '', primeiroVencimento: '', multaAtraso: '', foroEleito: '',
  garantias: { modulos: '', inversores: '', instalacao: '', homologacao: '' },
  responsavelTecnico: '', crea: '', clausulas: [], status: 'aguardando', dataEmissao: '08/09/2026',
};
const termos = {
  ...termosPadrao(null),
  contratanteNacionalidade: 'brasileira',
  contratanteEmail: 'cliente@exemplo.com',
  enderecoEntrega: 'Rua Alameda Jatai 1380, Brumadinho/MG',
  condicoesPagamento: 'R$ 10.000,00 no cartão de crédito e R$ 5.990,00 na entrega da usina instalada.',
  dataDocumento: '2026-09-08',
  anexoItens: anexoDoSistema(base),
};
const completo: Contrato = { ...base, modeloVersao: 1, termos, contratada: { ...CONTRATADA_PADRAO } };
const d = prepararContrato(completo);

const textoDe = (dados: typeof d, chave: (typeof CHAVES_SECOES)[number]) =>
  blocosDaSecao(dados, chave).map(textoPlano).join('\n');

for (const chave of CHAVES_SECOES) {
  const t = textoDe(d, chave);
  assert(!/\{[a-z0-9_]+\}/.test(t), `nenhum marcador sobrando em ${chave}: ${t.match(/\{[a-z0-9_]+\}/)?.[0]}`);
  assert(!t.includes('________'), `nenhum campo vazio em ${chave}`);
  for (const b of blocosDaSecao(d, chave)) {
    if (b.tipo === 'paragrafo') assert(!b.trechos.some((x) => x.desconhecido), `marcador desconhecido em ${chave}`);
  }
}

const preambulo = textoDe(d, 'preambulo');
assert.match(preambulo, /\(I\) Valeria Cristina Tavares, brasileira, inscrito\(a\) no CPF sob nº 607\.351\.986-91/);
assert.match(preambulo, /SOLAR COSTA LTDA, sede na Rua Alzira Maria Ferreira, 241 – Bairro Santa Mônica, na Cidade de Belo Horizonte, no Estado de Minas Gerais, CEP: 31\.530-150/);
assert.match(preambulo, /Giselle Alonso Costa, brasileira/);

const c3 = textoDe(d, 'clausula_3');
assert.match(c3, /R\$\s15\.990,00 \(quinze mil novecentos e noventa reais\)/);
assert.match(c3, /juros de mora de 1% \(um por cento\) ao mês/);
assert.match(c3, /multa moratória de 5% \(cinco por cento\)/);
assert.match(textoDe(d, 'clausula_2'), /no prazo máximo de 30 \(trinta\) dias/);
assert.match(textoDe(d, 'clausula_2'), /em até 45 dias corridos/);
assert.match(textoDe(d, 'clausula_7'), /prazo legal de 90 \(noventa\) dias/);
assert.match(textoDe(d, 'clausula_9'), /por mais de 60 \(sessenta\) dias/);
assert.match(textoDe(d, 'clausula_9'), /concessionária de energia Cemig/);
assert.match(textoDe(d, 'clausula_10'), /Contratante: cliente@exemplo\.com/);
assert.match(textoDe(d, 'encerramento'), /em 2 \(duas\) vias/);
assert.match(textoDe(d, 'encerramento'), /Belo Horizonte\/MG, 08 de Setembro de 2026/);
assert(blocosDaSecao(d, 'clausula_7').some((b) => b.tipo === 'tabela_garantias'), 'tabela de garantias na cláusula 7');

// Numeração em negrito e itens recuados.
const c1 = blocosDaSecao(d, 'clausula_1');
const p11 = c1[0];
assert(p11.tipo === 'paragrafo' && p11.trechos[0].negrito && p11.trechos[0].texto === '1.1 ' && !p11.item);
assert(c1.some((b) => b.tipo === 'paragrafo' && b.item && b.trechos[0].texto === '(iii) '));

// ---------------------------------------------------- PJ e campos vazios
const pj = prepararContrato({ ...completo, clienteNome: 'Padaria Boa Ltda', cpfCnpj: '12.345.678/0001-90' });
assert.match(textoDe(pj, 'preambulo'), /Padaria Boa Ltda, pessoa jurídica de direito privado, inscrita no CNPJ sob nº 12\.345\.678\/0001-90, com sede no endereço/);
assert(!textoDe(pj, 'preambulo').includes('residente'));

const semEmail = prepararContrato({ ...completo, termos: { ...termos, contratanteEmail: '' } });
assert.match(textoDe(semEmail, 'clausula_10'), /Contratante: ________/, 'dado vazio vira linha em branco');

// -------------------------------------------------- texto personalizado
const personalizado = prepararContrato({
  ...completo,
  termos: { ...termos, textos: { clausula_4: '4.1 Texto **negociado** com prazo de {prazo_execucao_dias} dias e {marcador_inexistente}.' } },
});
assert.equal(secaoPersonalizada(personalizado, 'clausula_4'), true);
assert.equal(secaoPersonalizada(personalizado, 'clausula_5'), false);
const c4 = blocosDaSecao(personalizado, 'clausula_4');
assert.equal(c4.length, 1);
assert.equal(textoPlano(c4[0]), '4.1 Texto negociado com prazo de 45 dias e {marcador_inexistente}.');
assert(c4[0].tipo === 'paragrafo' && c4[0].trechos.some((t) => t.negrito && t.texto === 'negociado'));
assert(c4[0].tipo === 'paragrafo' && c4[0].trechos.some((t) => t.desconhecido));
assert.deepEqual(marcadoresDesconhecidos('{marcador_inexistente} e {valor_total}'), ['{marcador_inexistente}']);
assert.deepEqual(marcadoresDesconhecidos('linha com {tabela_garantias} no meio'), ['{tabela_garantias}'], 'tabela só em linha própria');
assert.equal(textoDe(personalizado, 'clausula_5'), textoDe(d, 'clausula_5'), 'outras seções seguem o modelo');
// Texto em branco = volta ao modelo.
assert.equal(secaoPersonalizada(prepararContrato({ ...completo, termos: { ...termos, textos: { clausula_4: '   ' } } }), 'clausula_4'), false);
// Valor de marcador não é interpretado como marcação.
const comAsteriscos = prepararContrato({ ...completo, clienteNome: '**Nome**' });
assert(textoDe(comAsteriscos, 'preambulo').includes('**Nome**'));

// --------------------------------------------------------------- legado
const legado = prepararContrato({
  ...base, localInstalacao: 'Sítio Boa Vista', foroEleito: 'Contagem/MG', formaPagamento: 'À vista',
}, { empresa: null });
assert.equal(legado.termos.enderecoEntrega, 'Sítio Boa Vista');
assert.equal(legado.termos.foro, 'Contagem');
assert.equal(legado.termos.dataDocumento, '2026-09-08');
assert.equal(legado.contratada.cnpj, CONTRATADA_PADRAO.cnpj);
assert.equal(termosDeContratoLegado(base, null).anexoItens[0].qtd, '08');

// ------------------------------------------------------------- servidor
assert.deepEqual(termosContratoSchema.parse(JSON.parse(JSON.stringify(termos))), termos, 'servidor aceita os termos do front');
assert.deepEqual(contratadaContratoSchema.parse(CONTRATADA_PADRAO), CONTRATADA_PADRAO);
assert.throws(() => termosContratoSchema.parse({ ...termos, textos: { clausula_99: 'x' } }), /desconhecida/);
assert.throws(() => termosContratoSchema.parse({ ...termos, multaMoratoriaPct: 150 }));
assert.throws(() => termosContratoSchema.parse({ ...termos, testemunhas: [{}, {}, {}] }));

assert.equal(dataPorExtenso('2026-01-31'), '31 de Janeiro de 2026');
assert.equal(dataPorExtenso(''), '');
assert.equal(marcador('nao_existe'), undefined);

console.log('modelo do contrato: ok');
