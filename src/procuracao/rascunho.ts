// Estado do editor de procuração: uma `Procuracao` com termos e outorgados
// sempre completos, para os módulos do formulário nunca lidarem com null.

import type { Contrato, Procuracao } from '../types';
import type { ConfigApp } from '../services/api';
import { prepararContrato } from '../contrato/marcadores';
import { MODELO_PROCURACAO_VERSAO } from './modeloProcuracao';
import { completarTermos, generoDaNacionalidade, outorgadosPadrao, termosPadraoProcuracao } from './padroes';

function hojeBR(): string {
  return new Date().toLocaleDateString('pt-BR');
}

/** Procuração em branco, já com os outorgados e a concessionária dos padrões. */
export function rascunhoNovo(config: ConfigApp | null): Procuracao {
  return {
    id: '',
    numero: '',
    leadId: '',
    contratoId: '',
    contratoNumero: '',
    modeloVersao: MODELO_PROCURACAO_VERSAO,
    clienteNome: '',
    cpfCnpj: '',
    rgInscricao: '',
    endereco: '',
    cep: '',
    telefone: '',
    outorgados: outorgadosPadrao(config),
    termos: termosPadraoProcuracao(config),
    status: 'aguardando',
    dataEmissao: hojeBR(),
  };
}

/** Procuração salva -> rascunho, com os campos que faltarem completados. */
export function rascunhoDeProcuracao(p: Procuracao, config: ConfigApp | null): Procuracao {
  return {
    ...p,
    termos: completarTermos(p.termos, termosPadraoProcuracao(config)),
    outorgados: p.outorgados ?? [],
  };
}

/**
 * Preenche o outorgante com o contrato escolhido: nome, documentos, endereço,
 * telefone, lead, nacionalidade (e dela o gênero), concessionária e local.
 * Passa por prepararContrato para valer também no contrato legado, que nunca
 * teve `termos` gravado. Outorgados e textos personalizados ficam como estão.
 */
export function aplicarContrato(r: Procuracao, c: Contrato, config: ConfigApp | null): Procuracao {
  const d = prepararContrato(c, { config });
  const nacionalidade = d.termos.contratanteNacionalidade || r.termos.outorganteNacionalidade;
  return {
    ...r,
    contratoId: c.id,
    contratoNumero: c.numero,
    leadId: c.leadId || r.leadId,
    clienteNome: c.clienteNome || '',
    cpfCnpj: c.cpfCnpj || '',
    rgInscricao: c.rgInscricao || '',
    endereco: c.endereco || '',
    cep: c.cep || '',
    telefone: c.telefone || '',
    termos: {
      ...r.termos,
      outorganteNacionalidade: nacionalidade,
      outorganteGenero: generoDaNacionalidade(nacionalidade),
      concessionaria: d.termos.concessionaria || r.termos.concessionaria,
      localAssinatura: d.termos.localAssinatura || r.termos.localAssinatura,
    },
  };
}

/** A ação "Procuração" da lista de contratos: uma nova, já preenchida. */
export function rascunhoDoContrato(c: Contrato, config: ConfigApp | null): Procuracao {
  return aplicarContrato(rascunhoNovo(config), c, config);
}

/** O que o servidor exige — checado antes, para não salvar nem imprimir pela metade. */
export function pendenciasObrigatorias(r: Procuracao): string[] {
  const faltas: string[] = [];
  if (!r.clienteNome.trim()) faltas.push('Informe o outorgante.');
  if (!r.cpfCnpj.trim()) faltas.push('CPF/CNPJ é obrigatório na procuração.');
  if (!r.endereco.trim()) faltas.push('Informe o endereço do outorgante.');
  if (r.outorgados.length === 0) faltas.push('Informe ao menos um outorgado.');
  else if (r.outorgados.some((o) => !o.nome.trim() || !o.cpf.trim())) faltas.push('Cada outorgado precisa de nome e CPF.');
  return faltas;
}
