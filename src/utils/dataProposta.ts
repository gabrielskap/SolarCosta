import { paraDataISO } from '../services/mappers';

/** Data civil, sem conversão de meia-noite UTC para o dia anterior. */
export function dataDaProposta(proposta?: { dataProposta?: string; dataCriacao?: string }): string {
  return paraDataISO(proposta?.dataProposta) ?? paraDataISO(proposta?.dataCriacao)
    ?? new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Sao_Paulo' }).format(new Date());
}

export function dataPropostaPorExtenso(proposta: { dataProposta?: string; dataCriacao?: string }): string {
  const [ano, mes, dia] = dataDaProposta(proposta).split('-').map(Number);
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(Date.UTC(ano, mes - 1, dia)));
}
