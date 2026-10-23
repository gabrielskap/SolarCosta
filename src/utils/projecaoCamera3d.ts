/** Interseção do raio da câmera com o plano horizontal do centro do mapa.
 * Alternativa para navegadores que não entregam position no evento Google.
 * A malha dos prédios não é usada: o desenho mantém a mesma projeção de planta.
 */
export function projetarClique3d(camera: { latitude:number;longitude:number;distanciaM:number;inclinacao:number;azimute:number;fov:number },
  tela: { largura:number;altura:number;x:number;y:number }) {
  if (![...Object.values(camera), ...Object.values(tela)].every(Number.isFinite) || tela.largura<=0 || tela.altura<=0 || camera.distanciaM<=0 || camera.fov<=0 || camera.fov>=180) return null;
  const r=Math.PI/180,t=camera.inclinacao*r,h=camera.azimute*r;
  const fator=Math.tan(camera.fov*r/2),x=(2*tela.x/tela.largura-1)*fator*tela.largura/tela.altura,y=(1-2*tela.y/tela.altura)*fator;
  const raio={e:Math.sin(t)*Math.sin(h)+x*Math.cos(h)+y*Math.cos(t)*Math.sin(h),n:Math.sin(t)*Math.cos(h)-x*Math.sin(h)+y*Math.cos(t)*Math.cos(h),z:-Math.cos(t)+y*Math.sin(t)};
  if(raio.z>=-1e-6)return null;
  const alcance=camera.distanciaM*Math.cos(t)/-raio.z;
  const leste=-camera.distanciaM*Math.sin(t)*Math.sin(h)+alcance*raio.e;
  const norte=-camera.distanciaM*Math.sin(t)*Math.cos(h)+alcance*raio.n;
  const latitude=camera.latitude+norte/6378137/r,longitude=camera.longitude+leste/(6378137*Math.cos(camera.latitude*r))/r;
  return {lat:latitude,lng:longitude};
}
