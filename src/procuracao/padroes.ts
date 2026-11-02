// Valores iniciais de uma procuração.
//
// Mesmas fontes do contrato (src/contrato/padroes.ts), nesta ordem:
//   1. o banco — o parâmetro 'procuracao.outorgados' (V027), editado em
//      Padrões, a concessionária do contrato e o cadastro da empresa;
//   2. sem lista de outorgados, o representante legal do cadastro, com o
//      endereço da empresa — que é o que a segunda outorgada do .docx usa.
// Cada procuração guarda a própria cópia: mudar os padrões não reescreve
// procuração já emitida.

import type { GeneroPessoa, OutorgadoProcuracao, TermosProcuracao } from '../types';
// Só o TIPO de api.ts: o módulo lê import.meta.env ao carregar e quebraria os
// scripts de teste que rodam este arquivo no Node.
import type { ConfigApp } from '../services/api';
import { PARAMETRO_CONCESSIONARIA, hojeISO } from '../contrato/padroes';

export const PARAMETRO_OUTORGADOS = 'procuracao.outorgados';

/** A procuração aceita até 5 outorgados (o zod do servidor confere). */
export const MAXIMO_OUTORGADOS = 5;

const texto = (v: unknown): string => (v == null ? '' : String(v));

export const OUTORGADO_VAZIO: OutorgadoProcuracao = {
  nome: '', genero: '', nacionalidade: 'brasileiro(a)', cpf: '', rg: '', endereco: '',
};

/** "brasileira" -> 'F', "brasileiro" -> 'M'; "brasileiro(a)" e o resto ficam neutros. */
export function generoDaNacionalidade(nacionalidade: string): GeneroPessoa {
  const n = nacionalidade.trim().toLowerCase();
  if (!n || n.endsWith('(a)')) return '';
  if (n.endsWith('a')) return 'F';
  if (n.endsWith('o')) return 'M';
  return '';
}

const NACIONALIDADES_PADRAO = ['', 'brasileiro', 'brasileira', 'brasileiro(a)'];

/**
 * Trocar o gênero acerta a nacionalidade junto — mas só enquanto ela for uma
 * das formas de "brasileiro". Nacionalidade digitada não é tocada.
 */
export function ajustarNacionalidade(atual: string, genero: GeneroPessoa): string {
  if (!NACIONALIDADES_PADRAO.includes(atual.trim().toLowerCase())) return atual;
  return genero === 'F' ? 'brasileira' : genero === 'M' ? 'brasileiro' : 'brasileiro(a)';
}

/** Um item do json, à prova de campo faltando ou de outro tipo. */
export function normalizarOutorgado(o: any): OutorgadoProcuracao {
  return {
    nome: texto(o?.nome),
    genero: o?.genero === 'M' || o?.genero === 'F' ? o.genero : '',
    nacionalidade: texto(o?.nacionalidade),
    cpf: texto(o?.cpf),
    rg: texto(o?.rg),
    endereco: texto(o?.endereco),
  };
}

/** A lista do parâmetro como está, sem fallback — é o que a tela de Padrões edita. */
export function lerOutorgados(config: ConfigApp | null): OutorgadoProcuracao[] {
  const bruto = config?.parametros.find((p) => p.chave === PARAMETRO_OUTORGADOS)?.valor ?? '';
  if (!bruto) return [];
  try {
    const lista = JSON.parse(bruto);
    return Array.isArray(lista) ? lista.map(normalizarOutorgado) : [];
  } catch {
    return [];
  }
}

/** "Rua Alzira Maria Ferreira, 241 – Bairro Santa Mônica, Belo Horizonte/MG, CEP 31.530-150". */
function enderecoDaEmpresa(e: Record<string, any>): string {
  const rua = texto(e.endereco);
  const bairro = texto(e.bairro);
  const cidade = texto(e.cidade);
  const uf = texto(e.uf);
  const cep = texto(e.cep);
  const cidadeUf = cidade && uf ? `${cidade}/${uf}` : cidade || uf;
  return [bairro ? `${rua} – Bairro ${bairro}` : rua, cidadeUf, cep && `CEP ${cep}`].filter(Boolean).join(', ');
}

/** O representante legal do cadastro, como outorgado. Sem RG: o .docx não imprime. */
export function outorgadoDoRepresentante(empresa: Record<string, any> | null | undefined): OutorgadoProcuracao[] {
  const nome = texto(empresa?.representante_nome).trim();
  if (!empresa || !nome) return [];
  const nacionalidade = texto(empresa.representante_nacionalidade);
  return [{
    nome,
    genero: generoDaNacionalidade(nacionalidade),
    nacionalidade,
    cpf: texto(empresa.representante_cpf),
    rg: '',
    endereco: enderecoDaEmpresa(empresa),
  }];
}

/** Outorgados de uma procuração nova: os dos padrões ou, sem eles, o representante. */
export function outorgadosPadrao(config: ConfigApp | null): OutorgadoProcuracao[] {
  const lista = lerOutorgados(config).filter((o) => o.nome.trim() || o.cpf.trim());
  return lista.length ? lista : outorgadoDoRepresentante(config?.empresa ?? null);
}

/** Termos de uma procuração nova: concessionária do contrato + cidade da empresa. */
export function termosPadraoProcuracao(config: ConfigApp | null): TermosProcuracao {
  const empresa = config?.empresa ?? null;
  const cidade = texto(empresa?.cidade);
  const uf = texto(empresa?.uf);
  const cidadeUf = cidade && uf ? `${cidade}/${uf}` : cidade || uf;
  return {
    outorganteGenero: '',
    outorganteNacionalidade: 'brasileiro(a)',
    outorganteEstadoCivil: '',
    outorganteProfissao: '',
    representanteNome: '',
    representanteGenero: '',
    representanteCpf: '',
    concessionaria: config?.parametros.find((p) => p.chave === PARAMETRO_CONCESSIONARIA)?.valor || 'Cemig',
    localAssinatura: cidadeUf || 'Belo Horizonte/MG',
    dataDocumento: hojeISO(),
    textos: {},
  };
}

/** Completa um `termos` que veio do banco com os campos que faltarem. */
export function completarTermos(
  termos: Partial<TermosProcuracao> | null | undefined,
  base: TermosProcuracao,
): TermosProcuracao {
  if (!termos) return base;
  const limpo = Object.fromEntries(Object.entries(termos).filter(([, v]) => v !== undefined && v !== null));
  return { ...base, ...limpo, textos: { ...(termos.textos ?? {}) } } as TermosProcuracao;
}
