// Marcadores do texto da procuração: `{chave}` -> valor.
//
// Mesma ideia de src/contrato/marcadores.ts: é a lista que o editor mostra em
// "Inserir campo" e a única ponte entre os DADOS da procuração e o TEXTO do
// modelo. Um marcador escrito no texto que não estiver aqui sai impresso entre
// chaves e destacado na pré-visualização.

import type { GeneroPessoa, OutorgadoProcuracao, Procuracao, TermosProcuracao } from '../types';
import type { ConfigApp } from '../services/api';
import type { MarcadorModelo, Trecho } from '../documento/textoModelo';
import { dataPorExtenso, ehPessoaJuridica } from '../contrato/marcadores';
import { completarTermos, termosPadraoProcuracao } from './padroes';

/** Tudo de que o documento precisa, já com padrões aplicados. */
export interface DadosProcuracao {
  procuracao: Procuracao;
  termos: TermosProcuracao;
  outorgados: OutorgadoProcuracao[];
}

export type MarcadorProcuracao = MarcadorModelo<DadosProcuracao>;

export function prepararProcuracao(p: Procuracao, opcoes: { config?: ConfigApp | null } = {}): DadosProcuracao {
  return {
    procuracao: p,
    termos: completarTermos(p.termos, termosPadraoProcuracao(opcoes.config ?? null)),
    outorgados: p.outorgados ?? [],
  };
}

/** "inscrito" | "inscrita" | "inscrito(a)", conforme o gênero escolhido. */
export function concordar(genero: GeneroPessoa, masculino: string, feminino: string): string {
  if (genero === 'M') return masculino;
  if (genero === 'F') return feminino;
  return `${masculino}(a)`;
}

const negrito = (texto: string): Trecho => (texto ? { texto, negrito: true } : { texto: '', vazio: true, negrito: true });
const simples = (texto: string): Trecho => ({ texto });
const campo = (texto: string): Trecho => (texto ? { texto } : { texto: '', vazio: true });

/**
 * "Fulana, brasileira, casada, inscrita no CPF sob nº …, portadora do RG nº
 * …, residente e domiciliada no endereço …, CEP …". Com CNPJ, a qualificação
 * de empresa, representada por quem assina por ela.
 */
function qualificacaoOutorgante(d: DadosProcuracao): Trecho[] {
  const p = d.procuracao;
  const t = d.termos;
  const cep = p.cep ? [simples(`, CEP ${p.cep}`)] : [];
  if (ehPessoaJuridica(p.cpfCnpj)) {
    return [
      negrito(p.clienteNome),
      simples(', pessoa jurídica de direito privado, inscrita no CNPJ sob nº '),
      campo(p.cpfCnpj),
      ...(p.rgInscricao ? [simples(`, inscrição estadual nº ${p.rgInscricao}`)] : []),
      simples(', com sede no endereço '),
      campo(p.endereco),
      ...cep,
      simples(', neste ato representada por '),
      negrito(t.representanteNome),
      simples(`, ${concordar(t.representanteGenero, 'inscrito', 'inscrita')} no CPF sob nº `),
      campo(t.representanteCpf),
    ];
  }
  const g = t.outorganteGenero;
  return [
    negrito(p.clienteNome),
    ...[t.outorganteNacionalidade, t.outorganteEstadoCivil, t.outorganteProfissao]
      .filter((x) => x.trim())
      .map((x) => simples(`, ${x.trim()}`)),
    simples(`, ${concordar(g, 'inscrito', 'inscrita')} no CPF sob nº `),
    campo(p.cpfCnpj),
    ...(p.rgInscricao ? [simples(`, ${concordar(g, 'portador', 'portadora')} do RG nº ${p.rgInscricao}`)] : []),
    simples(`, residente e ${concordar(g, 'domiciliado', 'domiciliada')} no endereço `),
    campo(p.endereco),
    ...cep,
  ];
}

/** "Fulano, brasileiro, portador do CPF nº …, residente no endereço …" — como no .docx, sem negrito. */
function qualificacaoOutorgado(o: OutorgadoProcuracao): Trecho[] {
  return [
    campo(o.nome.trim()),
    ...(o.nacionalidade.trim() ? [simples(`, ${o.nacionalidade.trim()}`)] : []),
    simples(`, ${concordar(o.genero, 'portador', 'portadora')} do CPF nº `),
    campo(o.cpf),
    ...(o.rg.trim() ? [simples(`, RG nº ${o.rg.trim()}`)] : []),
    simples(', residente no endereço '),
    campo(o.endereco.trim()),
  ];
}

/** Outorgado que é só uma linha em branco do formulário não entra no texto. */
function outorgadosPreenchidos(d: DadosProcuracao): OutorgadoProcuracao[] {
  return d.outorgados.filter((o) => o.nome.trim() || o.cpf.trim());
}

/** "A e B", "A; B e C" — o "e" antes do último, como no .docx. */
function juntar<T>(itens: T[], trechos: (item: T) => Trecho[]): Trecho[] {
  if (itens.length === 0) return [campo('')];
  return itens.flatMap((item, i) => [
    ...(i === 0 ? [] : [simples(i === itens.length - 1 ? ' e ' : '; ')]),
    ...trechos(item),
  ]);
}

export const MARCADORES: MarcadorProcuracao[] = [
  // ------------------------------------------------------- Outorgante
  { chave: 'outorgante_qualificacao', grupo: 'Outorgante', rotulo: 'Qualificação completa (nome, documentos, endereço)', valor: qualificacaoOutorgante },
  { chave: 'outorgante_nome', grupo: 'Outorgante', rotulo: 'Nome / razão social', valor: (d) => d.procuracao.clienteNome },
  { chave: 'outorgante_cpf_cnpj', grupo: 'Outorgante', rotulo: 'CPF/CNPJ', valor: (d) => d.procuracao.cpfCnpj },
  { chave: 'outorgante_rg', grupo: 'Outorgante', rotulo: 'RG/IE', valor: (d) => d.procuracao.rgInscricao },
  { chave: 'outorgante_nacionalidade', grupo: 'Outorgante', rotulo: 'Nacionalidade', valor: (d) => d.termos.outorganteNacionalidade },
  { chave: 'outorgante_estado_civil', grupo: 'Outorgante', rotulo: 'Estado civil', valor: (d) => d.termos.outorganteEstadoCivil },
  { chave: 'outorgante_profissao', grupo: 'Outorgante', rotulo: 'Profissão', valor: (d) => d.termos.outorganteProfissao },
  {
    chave: 'outorgante_endereco',
    grupo: 'Outorgante',
    rotulo: 'Endereço (com CEP)',
    valor: (d) => (d.procuracao.endereco ? `${d.procuracao.endereco}${d.procuracao.cep ? `, CEP ${d.procuracao.cep}` : ''}` : ''),
  },
  { chave: 'outorgante_representante', grupo: 'Outorgante', rotulo: 'Representante (pessoa jurídica)', valor: (d) => d.termos.representanteNome },

  // -------------------------------------------------------- Outorgados
  { chave: 'outorgados_qualificacao', grupo: 'Outorgados', rotulo: 'Qualificação de todos', valor: (d) => juntar(outorgadosPreenchidos(d), qualificacaoOutorgado) },
  { chave: 'outorgados_nomes', grupo: 'Outorgados', rotulo: 'Só os nomes', valor: (d) => juntar(outorgadosPreenchidos(d), (o) => [campo(o.nome.trim())]) },

  // ---------------------------------------------------------- Processo
  { chave: 'concessionaria', grupo: 'Processo', rotulo: 'Concessionária', valor: (d) => d.termos.concessionaria },
  { chave: 'contrato_numero', grupo: 'Processo', rotulo: 'Nº do contrato de origem', valor: (d) => d.procuracao.contratoNumero },

  // ------------------------------------------------------------- Fecho
  { chave: 'local_assinatura', grupo: 'Fecho', rotulo: 'Local de assinatura', valor: (d) => d.termos.localAssinatura },
  { chave: 'data_documento', grupo: 'Fecho', rotulo: 'Data por extenso', valor: (d) => dataPorExtenso(d.termos.dataDocumento) },
  {
    chave: 'local_data',
    grupo: 'Fecho',
    rotulo: 'Local e data — "Belo Horizonte/MG, 28 de Outubro de 2026"',
    valor: (d) => {
      const data = dataPorExtenso(d.termos.dataDocumento);
      return [
        campo(d.termos.localAssinatura),
        simples(', '),
        data ? simples(data) : simples('____ de ________________ de ________'),
      ];
    },
  },
];

const POR_CHAVE = new Map(MARCADORES.map((m) => [m.chave, m]));

export function marcador(chave: string): MarcadorProcuracao | undefined {
  return POR_CHAVE.get(chave);
}
