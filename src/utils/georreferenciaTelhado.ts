import type { LevantamentoTelhado, PontoLocal } from './levantamentoTelhado';

/** Mesma projeção da imagem Static Maps; pixels físicos scale=2 não mudam a extensão. */
export function criarGeorreferencia(d: LevantamentoTelhado) {
  const s = d.satelite;
  if (!s) return null;
  const escala = 256 * 2 ** s.zoom;
  const origemY = Math.log(Math.tan(Math.PI / 4 + s.latitude * Math.PI / 360));
  return {
    paraGeo(p: PontoLocal) {
      return { lat: Math.atan(Math.sinh(origemY - (p.y / d.alturaM - 0.5) * s.alturaPx / escala * 2 * Math.PI)) * 180 / Math.PI,
        lng: s.longitude + (p.x / d.larguraM - 0.5) * s.larguraPx / escala * 360 };
    },
    paraLocal(lat: number, lng: number): PontoLocal {
      const mercatorY = Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
      return { x: ((lng - s.longitude) / 360 * escala / s.larguraPx + 0.5) * d.larguraM,
        y: ((origemY - mercatorY) / (2 * Math.PI) * escala / s.alturaPx + 0.5) * d.alturaM };
    },
  };
}
