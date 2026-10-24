// Estado do editor de contrato: um `Contrato` com termos e contratada sempre
// presentes, para os módulos do formulário nunca precisarem lidar com null.

import type { ContratadaContrato, Contrato, Lead, Proposta, TermosContrato } from '../types';
import type { ConfigApp } from '../services/api';
import { MODELO_VERSAO } from './modeloSolarCosta';
import { prepararContrato } from './marcadores';
import {
  anexoDaProposta, anexoDoSistema, condicoesDaProposta, contratadaDoCadastro, termosPadrao,
} from './padroes';

export type RascunhoContrato = Contrato & {
  modeloVersao: number;
  termos: TermosContrato;
  contratada: ContratadaContrato;
};

function hojeBR(): string {
  return new Date().toLocaleDateString('pt-BR');
}

/** Contrato em branco, já com os padrões do banco e a cópia da empresa. */
export function rascunhoNovo(config: ConfigApp | null): RascunhoContrato {
  const empresa = config?.empresa ?? null;
  return {
    id: '',
    numero: '',
    leadId: '',
    propostaId: '',
    clienteNome: '',
    cpfCnpj: '',
    rgInscricao: '',
    endereco: '',
    cep: '',
    telefone: '',
    potenciaKwp: 0,
    modulosQtd: 0,
    moduloModelo: '',
    inversorModelo: '',
    estrutura: '',
    prazoExecucao: '',
    localInstalacao: '',
    valorTotal: 0,
    formaPagamento: '',
    entrada: '',
    parcelasInfo: '',
    bancoAgente: '',
    primeiroVencimento: '',
    multaAtraso: '',
    foroEleito: '',
    garantias: { modulos: '', inversores: '', instalacao: '', homologacao: '' },
    responsavelTecnico: empresa?.responsavel_tecnico ?? '',
    crea: empresa?.crea ?? '',
    clausulas: [],
    status: 'aguardando',
    dataEmissao: hojeBR(),
    modeloVersao: MODELO_VERSAO,
    termos: termosPadrao(config),
    contratada: contratadaDoCadastro(empresa),
  };
}

/**
 * Contrato salvo -> rascunho. O legado (sem termos) ganha os termos do modelo
 * derivados das colunas antigas; ao salvar, passa a ser um contrato do modelo.
 */
export function rascunhoDeContrato(c: Contrato, config: ConfigApp | null): RascunhoContrato {
  const d = prepararContrato(c, { config });
  return { ...c, modeloVersao: c.modeloVersao ?? MODELO_VERSAO, termos: d.termos, contratada: d.contratada };
}

function enderecoCompleto(p: Proposta): string {
  const endereco = (p.endereco || '').trim();
  const cidade = (p.cidade || '').trim();
  if (cidade && !endereco.toLowerCase().includes(cidade.toLowerCase())) {
    return endereco ? `${endereco}, ${cidade}` : cidade;
  }
  return endereco;
}

const ROTULO_FORMA: Record<string, string> = {
  financiamento: 'Financiamento bancário',
  cartao: 'Cartão de crédito',
  avista: 'À vista',
};

/**
 * Preenche o rascunho com a proposta escolhida: cliente, sistema, preço,
 * condições de pagamento e Anexo I. O que não vem da proposta (prazos,
 * multas, testemunhas, textos personalizados) fica como estava.
 */
export function aplicarProposta(r: RascunhoContrato, p: Proposta, lead: Lead | undefined): RascunhoContrato {
  const endereco = enderecoCompleto(p);
  const anexo = anexoDaProposta(p);
  const moduloModelo = p.moduloWp ? `${p.moduloWp} Wp` : r.moduloModelo;
  const estrutura = p.telhado || r.estrutura;

  return {
    ...r,
    leadId: p.leadId || r.leadId,
    propostaId: p.id,
    clienteNome: p.clienteNome || '',
    cpfCnpj: p.cpfCnpj || '',
    rgInscricao: lead?.rgInscricao || '',
    endereco,
    cep: p.cep || lead?.cep || '',
    telefone: p.telefone || '',
    potenciaKwp: p.potenciaKwp || 0,
    modulosQtd: p.modulosQtd || 0,
    moduloModelo,
    estrutura,
    localInstalacao: endereco,
    valorTotal: p.valorTotal || 0,
    // Colunas antigas: não saem no modelo, mas seguem gravadas para a busca
    // da lista e para quem consulta o banco.
    formaPagamento: ROTULO_FORMA[p.formaPagamento] ?? '',
    entrada: p.entradaFinanciamentoValor
      ? p.entradaFinanciamentoValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
      : '',
    parcelasInfo: p.parcelasFinanciamento ? `${p.parcelasFinanciamento}x` : '',
    bancoAgente: p.bancoFinanciamento || '',
    // O responsável técnico escolhido na proposta (V017) ganha do cadastro.
    responsavelTecnico: p.responsavelTecnico || r.responsavelTecnico,
    crea: p.crea || r.crea,
    termos: {
      ...r.termos,
      contratanteEmail: p.email || lead?.email || r.termos.contratanteEmail,
      enderecoEntrega: endereco,
      condicoesPagamento: condicoesDaProposta(p),
      valorExtenso: '',
      anexoItens: anexo.length
        ? anexo
        : anexoDoSistema({ modulosQtd: p.modulosQtd, moduloModelo, inversorModelo: r.inversorModelo, estrutura }),
    },
  };
}

/** O que o servidor exige — checado antes, para não salvar nem imprimir pela metade. */
export function pendenciasObrigatorias(r: Contrato): string[] {
  const faltas: string[] = [];
  if (!r.clienteNome.trim()) faltas.push('Informe o contratante.');
  if (!r.cpfCnpj.trim()) faltas.push('CPF/CNPJ é obrigatório no contrato.');
  if (!r.endereco.trim()) faltas.push('Informe o endereço do contratante.');
  return faltas;
}
