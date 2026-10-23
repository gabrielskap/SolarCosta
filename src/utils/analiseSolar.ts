import type { SegmentoTelhado } from '../services/solar';
import type { LevantamentoTelhado } from './levantamentoTelhado';

export function segmentoAplicavel(s?: SegmentoTelhado): boolean {
  return !!s && Number.isFinite(s.inclinacaoGraus) && s.inclinacaoGraus >= 0 && s.inclinacaoGraus <= 75 &&
    Number.isFinite(s.azimuteGraus) && s.azimuteGraus >= 0 && s.azimuteGraus < 360;
}

/** Não modifica o original, para permitir restauração pelo histórico do editor. */
export function aplicarSegmento(d: LevantamentoTelhado, aguaId: string, s: SegmentoTelhado): LevantamentoTelhado {
  if (!segmentoAplicavel(s) || !d.aguas.some(a => a.id === aguaId)) throw new Error('Água ou segmento inválido.');
  return { ...d, placas: [], aguas: d.aguas.map(a => a.id === aguaId ? { ...a, inclinacao: s.inclinacaoGraus, azimute: s.azimuteGraus } : a) };
}
