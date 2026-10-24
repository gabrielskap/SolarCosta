// Marcadores do texto do contrato: `{chave}` -> valor.
//
// É a lista que o editor mostra como "campos disponíveis" ao personalizar uma
// cláusula, e a única ponte entre os DADOS do contrato e o TEXTO do modelo.
// Um marcador escrito no texto que não estiver aqui sai impresso entre chaves
// e destacado na pré-visualização — o erro aparece antes de virar papel.

import type { ContratadaContrato, Contrato, TermosContrato } from '../types';
import type { ConfigApp } from '../services/api';
import { formatCurrencyBRL, onlyDigits } from '../utils/format';
import { numeroComExtenso, percentualComExtenso, valorPorExtenso } from '../utils/extenso';
import {
  completarTermos, contratadaDoCadastro, termosDeContratoLegado, termosPadrao,
} from './padroes';

/** Tudo de que o documento precisa, já com padrões aplicados. */
export interface DadosContrato {
  contrato: Contrato;
  termos: TermosContrato;
  contratada: ContratadaContrato;
}

/**
 * Junta o contrato com os padrões. Contrato sem `termos` (legado) ganha os do
 * modelo derivados das colunas antigas; sem `contratada`, usa o cadastro da
 * empresa — e, sem cadastro (link público antigo), a contratada do modelo.
 */
export function prepararContrato(
  contrato: Contrato,
  opcoes: { empresa?: Record<string, any> | null; config?: ConfigApp | null } = {},
): DadosContrato {
  const config = opcoes.config ?? null;
  const termos = contrato.termos
    ? completarTermos(contrato.termos, termosPadrao(config))
    : termosDeContratoLegado(contrato, config);
  const contratada = contrato.contratada ?? contratadaDoCadastro(opcoes.empresa ?? config?.empresa ?? null);
  return { contrato, termos, contratada };
}

/** Pedaço de texto já resolvido. `vazio` = dado não preenchido (sai como linha em branco). */
export interface Trecho {
  texto: string;
  negrito?: boolean;
  vazio?: boolean;
  /** Marcador que não existe nesta lista. */
  desconhecido?: boolean;
}

export interface Marcador {
  chave: string;
  rotulo: string;
  grupo: string;
  /** Ocupa a linha inteira e vira um bloco (a tabela de garantias). */
  bloco?: boolean;
  valor: (d: DadosContrato) => string | Trecho[];
}

const ESTADOS: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia', CE: 'Ceará',
  DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás', MA: 'Maranhão', MT: 'Mato Grosso',
  MS: 'Mato Grosso do Sul', MG: 'Minas Gerais', PA: 'Pará', PB: 'Paraíba', PR: 'Paraná',
  PE: 'Pernambuco', PI: 'Piauí', RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte',
  RS: 'Rio Grande do Sul', RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina',
  SP: 'São Paulo', SE: 'Sergipe', TO: 'Tocantins',
};

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

/** '2026-09-08' -> '08 de Setembro de 2026', como no fecho do modelo. */
export function dataPorExtenso(iso: string): string {
  const m = (iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return '';
  const mes = MESES[Number(m[2]) - 1];
  return mes ? `${m[3]} de ${mes} de ${m[1]}` : '';
}

const pct = (n: number) => `${String(n).replace('.', ',')}%`;
const negrito = (texto: string): Trecho => (texto ? { texto, negrito: true } : { texto: '', vazio: true, negrito: true });
const simples = (texto: string): Trecho => ({ texto });
const campo = (texto: string): Trecho => (texto ? { texto } : { texto: '', vazio: true });

/** PF ou PJ pelo número de dígitos — 14 é CNPJ. */
export function ehPessoaJuridica(cpfCnpj: string): boolean {
  return onlyDigits(cpfCnpj).length === 14;
}

/**
 * "(I) Fulana, brasileira, inscrito(a) no CPF …". O modelo tinha o texto de
 * pessoa física; contrato com CNPJ troca para a qualificação de empresa em vez
 * de imprimir "residente e domiciliado" para uma pessoa jurídica.
 */
function qualificacaoContratante(d: DadosContrato): Trecho[] {
  const c = d.contrato;
  const t = d.termos;
  if (ehPessoaJuridica(c.cpfCnpj)) {
    return [
      negrito(c.clienteNome),
      simples(', pessoa jurídica de direito privado, inscrita no CNPJ sob nº '),
      campo(c.cpfCnpj),
      simples(', com sede no endereço '),
      campo(c.endereco),
      ...(c.cep ? [simples(`, CEP ${c.cep}`)] : []),
    ];
  }
  return [
    negrito(c.clienteNome),
    ...(t.contratanteNacionalidade ? [simples(`, ${t.contratanteNacionalidade}`)] : []),
    simples(', inscrito(a) no CPF sob nº '),
    campo(c.cpfCnpj),
    ...(c.rgInscricao ? [simples(`, portador(a) do RG nº ${c.rgInscricao}`)] : []),
    simples(', residente e domiciliado(a) no endereço '),
    campo(c.endereco),
    ...(c.cep ? [simples(`, CEP ${c.cep}`)] : []),
  ];
}

/** "Rua X, 241 – Bairro Santa Mônica, na Cidade de Belo Horizonte, no Estado de Minas Gerais, CEP: …". */
function enderecoContratada(c: ContratadaContrato): string {
  const partes = [c.endereco];
  if (c.bairro) partes[0] += ` – Bairro ${c.bairro}`;
  if (c.cidade) partes.push(`na Cidade de ${c.cidade}`);
  if (c.uf) partes.push(`no Estado de ${ESTADOS[c.uf.toUpperCase()] ?? c.uf}`);
  if (c.cep) partes.push(`CEP: ${c.cep}`);
  return partes.filter(Boolean).join(', ');
}

export const MARCADORES: Marcador[] = [
  // ------------------------------------------------------- Contratante
  { chave: 'contratante_qualificacao', grupo: 'Contratante', rotulo: 'Qualificação completa (nome, CPF/CNPJ, endereço)', valor: qualificacaoContratante },
  { chave: 'contratante_nome', grupo: 'Contratante', rotulo: 'Nome', valor: (d) => d.contrato.clienteNome },
  { chave: 'contratante_cpf_cnpj', grupo: 'Contratante', rotulo: 'CPF/CNPJ', valor: (d) => d.contrato.cpfCnpj },
  { chave: 'contratante_rg', grupo: 'Contratante', rotulo: 'RG/IE', valor: (d) => d.contrato.rgInscricao },
  { chave: 'contratante_nacionalidade', grupo: 'Contratante', rotulo: 'Nacionalidade', valor: (d) => d.termos.contratanteNacionalidade },
  { chave: 'contratante_endereco', grupo: 'Contratante', rotulo: 'Endereço', valor: (d) => d.contrato.endereco },
  { chave: 'contratante_cep', grupo: 'Contratante', rotulo: 'CEP', valor: (d) => d.contrato.cep },
  { chave: 'contratante_telefone', grupo: 'Contratante', rotulo: 'Telefone', valor: (d) => d.contrato.telefone },
  { chave: 'email_contratante', grupo: 'Contratante', rotulo: 'E-mail', valor: (d) => d.termos.contratanteEmail },

  // -------------------------------------------------------- Contratada
  { chave: 'contratada_razao_social', grupo: 'Solar Costa', rotulo: 'Razão social', valor: (d) => d.contratada.razaoSocial },
  { chave: 'contratada_cnpj', grupo: 'Solar Costa', rotulo: 'CNPJ', valor: (d) => d.contratada.cnpj },
  { chave: 'contratada_endereco_completo', grupo: 'Solar Costa', rotulo: 'Endereço completo', valor: (d) => enderecoContratada(d.contratada) },
  { chave: 'contratada_telefone', grupo: 'Solar Costa', rotulo: 'Telefone', valor: (d) => d.contratada.telefone },
  { chave: 'email_contratada', grupo: 'Solar Costa', rotulo: 'E-mail para notificações', valor: (d) => d.termos.emailContratada },
  { chave: 'representante_nome', grupo: 'Solar Costa', rotulo: 'Representante legal', valor: (d) => d.contratada.representanteNome },
  { chave: 'representante_nacionalidade', grupo: 'Solar Costa', rotulo: 'Nacionalidade do representante', valor: (d) => d.contratada.representanteNacionalidade },
  { chave: 'representante_rg', grupo: 'Solar Costa', rotulo: 'RG do representante', valor: (d) => d.contratada.representanteRg },
  { chave: 'representante_cpf', grupo: 'Solar Costa', rotulo: 'CPF do representante', valor: (d) => d.contratada.representanteCpf },

  // ----------------------------------------------------------- Sistema
  { chave: 'potencia_kwp', grupo: 'Sistema', rotulo: 'Potência (kWp)', valor: (d) => (d.contrato.potenciaKwp ? `${String(d.contrato.potenciaKwp).replace('.', ',')} kWp` : '') },
  { chave: 'modulos_qtd', grupo: 'Sistema', rotulo: 'Quantidade de módulos', valor: (d) => (d.contrato.modulosQtd ? String(d.contrato.modulosQtd) : '') },
  { chave: 'modulo_modelo', grupo: 'Sistema', rotulo: 'Modelo do módulo', valor: (d) => d.contrato.moduloModelo },
  { chave: 'inversor_modelo', grupo: 'Sistema', rotulo: 'Inversor', valor: (d) => d.contrato.inversorModelo },
  { chave: 'estrutura', grupo: 'Sistema', rotulo: 'Estrutura / telhado', valor: (d) => d.contrato.estrutura },
  { chave: 'endereco_entrega', grupo: 'Sistema', rotulo: 'Endereço de entrega e instalação', valor: (d) => d.termos.enderecoEntrega },

  // ------------------------------------------------------------ Prazos
  { chave: 'prazo_despacho', grupo: 'Prazos', rotulo: 'Despacho — "30 (trinta)"', valor: (d) => numeroComExtenso(d.termos.prazoDespachoDias) },
  { chave: 'prazo_despacho_dias', grupo: 'Prazos', rotulo: 'Despacho — só o número', valor: (d) => String(d.termos.prazoDespachoDias) },
  { chave: 'prazo_execucao', grupo: 'Prazos', rotulo: 'Execução — "45 (quarenta e cinco)"', valor: (d) => numeroComExtenso(d.termos.prazoExecucaoDias) },
  { chave: 'prazo_execucao_dias', grupo: 'Prazos', rotulo: 'Execução — só o número', valor: (d) => String(d.termos.prazoExecucaoDias) },

  // ------------------------------------------------------------- Preço
  { chave: 'valor_total', grupo: 'Preço', rotulo: 'Valor total (R$)', valor: (d) => formatCurrencyBRL(d.contrato.valorTotal) },
  { chave: 'valor_extenso', grupo: 'Preço', rotulo: 'Valor total por extenso', valor: (d) => d.termos.valorExtenso || valorPorExtenso(d.contrato.valorTotal) },
  { chave: 'condicoes_pagamento', grupo: 'Preço', rotulo: 'Condições de pagamento', valor: (d) => d.termos.condicoesPagamento },
  { chave: 'juros_mora', grupo: 'Preço', rotulo: 'Juros de mora — "1% (um por cento)"', valor: (d) => percentualComExtenso(d.termos.jurosMoraMesPct) },
  { chave: 'multa_moratoria', grupo: 'Preço', rotulo: 'Multa moratória — "5% (cinco por cento)"', valor: (d) => percentualComExtenso(d.termos.multaMoratoriaPct) },

  // ---------------------------------------------------------- Garantia
  { chave: 'tabela_garantias', grupo: 'Garantia', rotulo: 'Tabela de garantias (linha própria)', bloco: true, valor: () => '' },
  { chave: 'garantia_legal', grupo: 'Garantia', rotulo: 'Garantia legal — "90 (noventa)"', valor: (d) => numeroComExtenso(d.termos.garantiaLegalDias) },
  { chave: 'garantia_legal_dias', grupo: 'Garantia', rotulo: 'Garantia legal — só o número', valor: (d) => String(d.termos.garantiaLegalDias) },

  // ---------------------------------------------------------- Rescisão
  { chave: 'forca_maior', grupo: 'Rescisão', rotulo: 'Força maior — "60 (sessenta)"', valor: (d) => numeroComExtenso(d.termos.forcaMaiorDias) },
  { chave: 'forca_maior_dias', grupo: 'Rescisão', rotulo: 'Força maior — só o número', valor: (d) => String(d.termos.forcaMaiorDias) },
  { chave: 'prazo_cura_dias', grupo: 'Rescisão', rotulo: 'Prazo para sanar descumprimento (dias)', valor: (d) => String(d.termos.prazoCuraDias) },
  { chave: 'multa_rescisoria_contratante', grupo: 'Rescisão', rotulo: 'Multa se o contratante desistir (%)', valor: (d) => pct(d.termos.multaRescisoriaContratantePct) },
  { chave: 'multa_rescisoria_contratada', grupo: 'Rescisão', rotulo: 'Multa se a Solar Costa atrasar (%)', valor: (d) => pct(d.termos.multaRescisoriaContratadaPct) },
  { chave: 'prazo_pagamento_estruturas_dias', grupo: 'Rescisão', rotulo: 'Prazo para pagar estruturas (dias úteis)', valor: (d) => String(d.termos.prazoPagamentoEstruturasDiasUteis) },
  { chave: 'concessionaria', grupo: 'Rescisão', rotulo: 'Concessionária', valor: (d) => d.termos.concessionaria },

  // ------------------------------------------------------------- Fecho
  { chave: 'foro', grupo: 'Fecho', rotulo: 'Foro (comarca)', valor: (d) => d.termos.foro },
  { chave: 'numero_vias', grupo: 'Fecho', rotulo: 'Número de vias — "2 (duas)"', valor: (d) => numeroComExtenso(d.termos.numeroVias, { feminino: true }) },
  { chave: 'local_assinatura', grupo: 'Fecho', rotulo: 'Local de assinatura', valor: (d) => d.termos.localAssinatura },
  { chave: 'data_documento', grupo: 'Fecho', rotulo: 'Data por extenso', valor: (d) => dataPorExtenso(d.termos.dataDocumento) },
  {
    chave: 'local_data',
    grupo: 'Fecho',
    rotulo: 'Local e data — "Belo Horizonte/MG, 08 de Setembro de 2026"',
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

export function marcador(chave: string): Marcador | undefined {
  return POR_CHAVE.get(chave);
}
