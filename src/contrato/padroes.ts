// Valores iniciais de um contrato no modelo Solar Costa.
//
// Duas fontes, nesta ordem:
//   1. o banco — parâmetros do grupo 'contrato' (V024) e o cadastro da
//      empresa, que o administrador edita em "Padrões do contrato";
//   2. as constantes abaixo, iguais às da V024. Servem de rede para onde não
//      há /api/config: o link público /p/:token e o contrato legado, que nunca
//      teve `termos` gravado.

import type {
  ContratadaContrato, Contrato, GarantiaContrato, ItemAnexoContrato, Proposta, TermosContrato,
} from '../types';
// Só o TIPO de api.ts: o módulo lê import.meta.env ao carregar e quebraria os
// scripts de teste que rodam este arquivo no Node. Por isso param/paramNum
// são reescritos aqui em vez de importados.
import type { ConfigApp } from '../services/api';
import { formatCurrencyBRL } from '../utils/format';

function param(config: ConfigApp | null, chave: string, padrao = ''): string {
  return config?.parametros.find((p) => p.chave === chave)?.valor ?? padrao;
}

function paramNum(config: ConfigApp | null, chave: string, padrao: number): number {
  const bruto = config?.parametros.find((p) => p.chave === chave)?.valor;
  if (bruto == null || bruto === '') return padrao;
  const n = Number(bruto);
  return Number.isFinite(n) ? n : padrao;
}

/** '29/07/2026' ou '2026-07-29…' -> '2026-07-29'; null se não reconhecer. */
function paraDataISO(valor?: string | null): string | null {
  if (!valor) return null;
  const br = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const iso = valor.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso ? iso[1] : null;
}

export const GARANTIAS_PADRAO: GarantiaContrato[] = [
  { equipamento: 'Módulos', prazo: '15 anos', causa: 'Defeitos de fabricação' },
  { equipamento: 'Módulos', prazo: '20 anos', causa: 'Performance' },
  { equipamento: 'Inversor', prazo: '12 anos', causa: 'Defeito de fabricação' },
  { equipamento: 'Instalação', prazo: '1 ano', causa: 'Defeito de instalação e desconformidade com o projeto' },
];

/** Os números do modelo — mesmos valores dos parâmetros da V024. */
export const NUMEROS_PADRAO = {
  prazoDespachoDias: 30,
  prazoExecucaoDias: 45,
  jurosMoraMesPct: 1,
  multaMoratoriaPct: 5,
  garantiaLegalDias: 90,
  forcaMaiorDias: 60,
  prazoCuraDias: 15,
  multaRescisoriaContratantePct: 15,
  multaRescisoriaContratadaPct: 15,
  prazoPagamentoEstruturasDiasUteis: 5,
  numeroVias: 2,
};

/** Parâmetro de cada número em "SolarCosta_Parametros". */
export const CHAVES_PARAMETRO: Record<keyof typeof NUMEROS_PADRAO, string> = {
  prazoDespachoDias: 'contrato.prazo_despacho_dias',
  prazoExecucaoDias: 'contrato.prazo_execucao_dias',
  jurosMoraMesPct: 'contrato.juros_mora_mes_pct',
  multaMoratoriaPct: 'contrato.multa_moratoria_pct',
  garantiaLegalDias: 'contrato.garantia_legal_dias',
  forcaMaiorDias: 'contrato.forca_maior_dias',
  prazoCuraDias: 'contrato.prazo_cura_dias',
  multaRescisoriaContratantePct: 'contrato.multa_rescisoria_contratante_pct',
  multaRescisoriaContratadaPct: 'contrato.multa_rescisoria_contratada_pct',
  prazoPagamentoEstruturasDiasUteis: 'contrato.prazo_pagamento_estruturas_dias_uteis',
  numeroVias: 'contrato.numero_vias',
};

export const PARAMETRO_GARANTIAS = 'contrato.garantias';
export const PARAMETRO_CONCESSIONARIA = 'contrato.concessionaria';

/** A contratada do modelo, para quando nem o cadastro estiver disponível. */
export const CONTRATADA_PADRAO: ContratadaContrato = {
  razaoSocial: 'SOLAR COSTA LTDA',
  cnpj: '43.630.879/0001-68',
  endereco: 'Rua Alzira Maria Ferreira, 241',
  bairro: 'Santa Mônica',
  cidade: 'Belo Horizonte',
  uf: 'MG',
  cep: '31.530-150',
  telefone: '(31) 98658-8456',
  email: 'solarcostamg@gmail.com',
  representanteNome: 'Giselle Alonso Costa',
  representanteNacionalidade: 'brasileira',
  representanteRg: 'MG10513845',
  representanteCpf: '012.091.516-26',
};

const texto = (v: unknown): string => (v == null ? '' : String(v));

/** Linha crua de "SolarCosta_Empresa" (snake_case) -> cópia para o contrato. */
export function contratadaDoCadastro(empresa: Record<string, any> | null | undefined): ContratadaContrato {
  if (!empresa) return { ...CONTRATADA_PADRAO };
  return {
    razaoSocial: texto(empresa.razao_social),
    cnpj: texto(empresa.cnpj),
    endereco: texto(empresa.endereco),
    bairro: texto(empresa.bairro),
    cidade: texto(empresa.cidade),
    uf: texto(empresa.uf),
    cep: texto(empresa.cep),
    telefone: texto(empresa.telefone),
    email: texto(empresa.email),
    representanteNome: texto(empresa.representante_nome),
    representanteNacionalidade: texto(empresa.representante_nacionalidade),
    representanteRg: texto(empresa.representante_rg),
    representanteCpf: texto(empresa.representante_cpf),
  };
}

/** Lê a tabela de garantias do parâmetro json; cai no padrão se vier quebrada. */
export function garantiasDoParametro(config: ConfigApp | null): GarantiaContrato[] {
  const bruto = param(config, PARAMETRO_GARANTIAS, '');
  if (!bruto) return GARANTIAS_PADRAO.map((g) => ({ ...g }));
  try {
    const lista = JSON.parse(bruto);
    if (!Array.isArray(lista)) throw new Error('não é lista');
    return lista.map((g: any) => ({
      equipamento: texto(g?.equipamento),
      prazo: texto(g?.prazo),
      causa: texto(g?.causa),
    }));
  } catch {
    return GARANTIAS_PADRAO.map((g) => ({ ...g }));
  }
}

/** Hoje em AAAA-MM-DD, no fuso do navegador (não em UTC). */
export function hojeISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function cidadeUf(cidade: string, uf: string): string {
  return cidade && uf ? `${cidade}/${uf}` : cidade || uf;
}

/** "Belo Horizonte/MG" -> "Belo Horizonte": o foro é uma comarca. */
function comarca(foro: string): string {
  return foro.replace(/\s*[/-]\s*[A-Za-z]{2}$/, '').trim();
}

/** Termos de um contrato novo: parâmetros do banco + cadastro da empresa. */
export function termosPadrao(config: ConfigApp | null): TermosContrato {
  const empresa = config?.empresa ?? null;
  const numeros = Object.fromEntries(
    (Object.keys(NUMEROS_PADRAO) as (keyof typeof NUMEROS_PADRAO)[]).map((k) => [
      k,
      paramNum(config, CHAVES_PARAMETRO[k], NUMEROS_PADRAO[k]),
    ]),
  ) as typeof NUMEROS_PADRAO;
  const contratada = contratadaDoCadastro(empresa);

  return {
    ...numeros,
    contratanteNacionalidade: 'brasileiro(a)',
    contratanteEmail: '',
    enderecoEntrega: '',
    valorExtenso: '',
    condicoesPagamento: '',
    garantias: garantiasDoParametro(config),
    concessionaria: param(config, PARAMETRO_CONCESSIONARIA, 'Cemig'),
    emailContratada: contratada.email || CONTRATADA_PADRAO.email,
    foro: comarca(texto(empresa?.foro_padrao)) || contratada.cidade || CONTRATADA_PADRAO.cidade,
    localAssinatura: cidadeUf(contratada.cidade, contratada.uf) || 'Belo Horizonte/MG',
    dataDocumento: hojeISO(),
    testemunhas: [
      { nome: '', rg: '', cpf: '' },
      { nome: '', rg: '', cpf: '' },
    ],
    anexoItens: [],
    textos: {},
  };
}

/** Quantidade como o modelo imprime: "08", "02", "12"; fração com vírgula. */
export function formatarQtd(qtd: number): string {
  if (!Number.isFinite(qtd) || qtd <= 0) return '';
  return Number.isInteger(qtd) ? String(qtd).padStart(2, '0') : String(qtd).replace('.', ',');
}

/**
 * Anexo I a partir do que o contrato já sabe do sistema, no formato do
 * modelo. Usado quando não há proposta com itens.
 */
export function anexoDoSistema(dados: {
  modulosQtd?: number;
  moduloModelo?: string;
  inversorModelo?: string;
  estrutura?: string;
}): ItemAnexoContrato[] {
  const itens: ItemAnexoContrato[] = [];
  if (dados.modulosQtd || dados.moduloModelo) {
    itens.push({
      qtd: formatarQtd(dados.modulosQtd ?? 0),
      descricao: `Módulos fotovoltaicos ${dados.moduloModelo ?? ''}`.trim(),
    });
  }
  if (dados.inversorModelo) itens.push({ qtd: '', descricao: `Inversor ${dados.inversorModelo}` });
  itens.push({ qtd: '', descricao: 'Caixas e proteções do sistema' });
  itens.push({ qtd: '', descricao: 'Cabos solares' });
  itens.push({
    qtd: '',
    descricao: dados.estrutura ? `Estrutura para telhado ${dados.estrutura}` : 'Estrutura para telhado',
  });
  return itens;
}

/**
 * Anexo I a partir dos itens da proposta. Kit entra pelos componentes — é o
 * que vai fisicamente para o telhado; o nome comercial do kit não diz ao
 * cliente o que ele está recebendo.
 */
export function anexoDaProposta(proposta: Proposta): ItemAnexoContrato[] {
  const itens: ItemAnexoContrato[] = [];
  for (const item of proposta.kitItens ?? []) {
    const linhas = item.componentes?.length ? item.componentes : [item];
    for (const l of linhas) {
      if (!l.descricao?.trim()) continue;
      itens.push({ qtd: formatarQtd(l.qtd), descricao: l.descricao.trim() });
    }
  }
  return itens;
}

/** Condições de pagamento da proposta, em texto para a cláusula 3.1. */
export function condicoesDaProposta(p: Proposta): string {
  const brl = (v: number) => formatCurrencyBRL(v);
  if (p.formaPagamento === 'financiamento') {
    const entrada = p.entradaFinanciamentoValor ? `entrada de ${brl(p.entradaFinanciamentoValor)} e ` : '';
    const parcelas = p.parcelasFinanciamento ? ` em ${p.parcelasFinanciamento} parcelas` : '';
    const banco = p.bancoFinanciamento ? ` por meio de ${p.bancoFinanciamento}` : '';
    return `${entrada}saldo por financiamento bancário${parcelas}${banco}.`;
  }
  if (p.formaPagamento === 'cartao') {
    const parcelas = p.parcelasCartao ? ` em ${p.parcelasCartao}x` : '';
    return `cartão de crédito${parcelas}.`;
  }
  return 'pagamento à vista.';
}

/**
 * Termos de um contrato LEGADO (sem `termos` gravado): padrões do modelo +
 * o que as colunas antigas já diziam. É o que permite abrir no editor, e
 * imprimir no modelo novo, um contrato emitido antes da V024.
 */
export function termosDeContratoLegado(c: Contrato, config: ConfigApp | null): TermosContrato {
  const base = termosPadrao(config);
  const partesPagamento = [c.formaPagamento, c.entrada && `entrada de ${c.entrada}`, c.parcelasInfo, c.bancoAgente]
    .filter(Boolean)
    .join(', ');
  return {
    ...base,
    enderecoEntrega: c.localInstalacao || c.endereco || '',
    condicoesPagamento: partesPagamento ? `${partesPagamento}.` : '',
    foro: c.foroEleito ? comarca(c.foroEleito) : base.foro,
    dataDocumento: paraDataISO(c.dataEmissao) ?? base.dataDocumento,
    anexoItens: anexoDoSistema(c),
  };
}

/**
 * Completa um `termos` que veio do banco com os campos que faltarem —
 * contrato salvo por uma versão anterior deste formulário, por exemplo.
 */
export function completarTermos(termos: Partial<TermosContrato> | null | undefined, base: TermosContrato): TermosContrato {
  if (!termos) return base;
  const limpo = Object.fromEntries(Object.entries(termos).filter(([, v]) => v !== undefined && v !== null));
  return { ...base, ...limpo, textos: { ...(termos.textos ?? {}) } } as TermosContrato;
}
