import type {PontoLocal} from './levantamentoTelhado';
export interface CameraTelhado {zoom:number;centro:PontoLocal}
export function limitarCamera(c:CameraTelhado,largura:number,altura:number):CameraTelhado {
  const zoom=Math.max(1,Math.min(12,c.zoom));
  const mx=largura/zoom/2,my=altura/zoom/2;
  return {zoom,centro:{x:Math.max(mx,Math.min(largura-mx,c.centro.x)),y:Math.max(my,Math.min(altura-my,c.centro.y))}};
}
export function aproximarCamera(c:CameraTelhado,fator:number,ancora:PontoLocal,largura:number,altura:number) {
  const zoom=Math.max(1,Math.min(12,c.zoom*fator)),r=c.zoom/zoom;
  return limitarCamera({zoom,centro:{x:ancora.x+(c.centro.x-ancora.x)*r,y:ancora.y+(c.centro.y-ancora.y)*r}},largura,altura);
}
