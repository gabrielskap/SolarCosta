import type { LevantamentoTelhado } from './levantamentoTelhado.js';

export type EstadoCaptura = 'pendente'|'processando'|'concluido'|'falhou'|'cancelado';
export interface CapturaTelhado {
  id: string; proposta_id: string; lead_id: string; estado: EstadoCaptura;
  assinatura: string; camera: LevantamentoTelhado['vistaGoogle']; largura: number; altura: number;
  pronta: boolean; melhorar_ia: boolean; modelo: string|null; original_id: string|null; final_id: string|null;
  mensagem: string|null; criado_em: string;
}

/** Serialização idêntica no browser e no servidor, independente da ordem das chaves JSONB. */
export function chaveCaptura(d: LevantamentoTelhado): string {
  const ordenar = (v: any): any => Array.isArray(v) ? v.map(ordenar) : v && typeof v==='object'
    ? Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,ordenar(v[k])])) : v;
  const { larguraM,alturaM,norte,aguas,obstaculos,placas,satelite,localizacao,vistaGoogle,simulacao }=d;
  return JSON.stringify(ordenar({larguraM,alturaM,norte,aguas,obstaculos,placas,satelite,localizacao,vistaGoogle,simulacao}));
}
