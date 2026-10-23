// Geometria em metros no plano da imagem. Não usa APIs nem coordenadas fictícias.
export interface PontoLocal { x: number; y: number }
export interface AguaManual {
  id: string;
  nome: string;
  pontos: PontoLocal[];
  inclinacao: number;
  azimute: number;
}
export interface PlacaManual {
  id: string;
  aguaId: string;
  pontos: PontoLocal[];
  stringId?: string;
}
export interface LevantamentoTelhado {
  versao: 1;
  origem: 'manual';
  larguraM: number;
  alturaM: number;
  norte: number;
  tipologia: string;
  anoConstrucao?: number;
  imagem?: string;
  imagemNome?: string;
  dataImagem?: string;
  localizacao?: { latitude: number; longitude: number; endereco?: string };
  satelite?: { latitude: number; longitude: number; zoom: number; larguraPx: number; alturaPx: number };
  vistaGoogle?: { modo: 'satelite' | '3d'; latitude: number; longitude: number; zoom?: number; altitude?: number; distanciaM?: number; inclinacao?: number; azimute?: number };
  simulacao?: { data: string; hora: number; fuso: number; mostrarIncidencia: boolean; mostrarSombras: boolean };
  escalaConfirmada: boolean;
  aguas: AguaManual[];
  obstaculos: { id: string; pontos: PontoLocal[]; alturaM: number }[];
  modulo: { modelo: string; placaId?: string; produtoId?: string; larguraM: number; alturaM: number; potenciaWp: number; pesoKg?: number };
  espacamentoM: number;
  recuoM: number;
  placas: PlacaManual[];
}
/** Escala no solo para pixels lógicos do Web Mercator; scale=2 altera resolução, não extensão. */
export function escalaSatelite(latitude:number,zoom:number,larguraPx=640,alturaPx=640) {
  const mpp=2*Math.PI*6378137*Math.cos(latitude*Math.PI/180)/(256*2**zoom);
  return {larguraM:larguraPx*mpp,alturaM:alturaPx*mpp};
}
const EPS = 1e-8;
const cross = (a: PontoLocal, b: PontoLocal, c: PontoLocal) => (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
export function areaPoligono(p: PontoLocal[]): number {
  return Math.abs(p.reduce((s,a,i) => { const b=p[(i+1)%p.length]!; return s+a.x*b.y-b.x*a.y; },0))/2;
}
function naBorda(p: PontoLocal,a: PontoLocal,b: PontoLocal) {
  return Math.abs(cross(a,b,p))<EPS && p.x>=Math.min(a.x,b.x)-EPS && p.x<=Math.max(a.x,b.x)+EPS && p.y>=Math.min(a.y,b.y)-EPS && p.y<=Math.max(a.y,b.y)+EPS;
}
export function dentro(p: PontoLocal, poly: PontoLocal[]): boolean {
  let sim=false;
  for(let i=0,j=poly.length-1;i<poly.length;j=i++) {
    const a=poly[j]!, b=poly[i]!;
    if(naBorda(p,a,b)) return true;
    if((a.y>p.y)!==(b.y>p.y) && p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x) sim=!sim;
  }
  return sim;
}
function cruza(a: PontoLocal,b: PontoLocal,c: PontoLocal,d: PontoLocal, estrito=false) {
  const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);
  if(x*y < -EPS && z*w < -EPS) return true;
  return !estrito && (naBorda(a,c,d)||naBorda(b,c,d)||naBorda(c,a,b)||naBorda(d,a,b));
}
function arestas(poly: PontoLocal[]) { return poly.map((a,i)=>[a,poly[(i+1)%poly.length]!] as const); }
export function poligonoValido(poly: PontoLocal[]) {
  if(poly.length<3 || areaPoligono(poly)<0.01) return false;
  const e=arestas(poly);
  return !e.some(([a,b],i)=>e.some(([c,d],j)=> j>i+1 && !(i===0&&j===e.length-1) && cruza(a,b,c,d)));
}
function distanciaPonto(p:PontoLocal,a:PontoLocal,b:PontoLocal) {
  const den=(b.x-a.x)**2+(b.y-a.y)**2;
  const t=den ? Math.max(0,Math.min(1,((p.x-a.x)*(b.x-a.x)+(p.y-a.y)*(b.y-a.y))/den)):0;
  return Math.hypot(p.x-a.x-t*(b.x-a.x),p.y-a.y-t*(b.y-a.y));
}
function distanciaSegmento(a:PontoLocal,b:PontoLocal,c:PontoLocal,d:PontoLocal) {
  if(cruza(a,b,c,d)) return 0;
  return Math.min(distanciaPonto(a,c,d),distanciaPonto(b,c,d),distanciaPonto(c,a,b),distanciaPonto(d,a,b));
}
export function sobrepoe(a:PontoLocal[],b:PontoLocal[]) {
  return a.some(p=>dentro(p,b)) || b.some(p=>dentro(p,a)) || arestas(a).some(([p,q])=>arestas(b).some(([r,s])=>cruza(p,q,r,s)));
}
export function cabe(placa:PontoLocal[],agua:PontoLocal[],obstaculos:PontoLocal[][],recuo:number) {
  if(!placa.every(p=>dentro(p,agua))) return false;
  // Contenção em concavidades exige verificar arestas, além dos vértices.
  if(arestas(placa).some(([a,b])=>arestas(agua).some(([c,d])=>cruza(a,b,c,d,true)))) return false;
  if(recuo>0 && arestas(placa).some(([a,b])=>arestas(agua).some(([c,d])=>distanciaSegmento(a,b,c,d)<recuo-EPS))) return false;
  return !obstaculos.some(o=>sobrepoe(placa,o) || (recuo>0 && arestas(placa).some(([a,b])=>arestas(o).some(([c,d])=>distanciaSegmento(a,b,c,d)<recuo-EPS))));
}
export function distribuir(l:LevantamentoTelhado,alvo=2000,paisagem=false):PlacaManual[] {
  if(!l.escalaConfirmada) return [];
  const placas:PlacaManual[]=[];
  for(const agua of l.aguas) {
    if(!poligonoValido(agua.pontos)) continue;
    // Projeta o comprimento na direção de queda da água (azimute relativo ao norte da imagem).
    const ang=(agua.azimute-l.norte)*Math.PI/180, co=Math.cos(ang),si=Math.sin(ang);
    const rodar=(p:PontoLocal):PontoLocal=>({x:p.x*co+p.y*si,y:-p.x*si+p.y*co});
    const voltar=(p:PontoLocal):PontoLocal=>({x:p.x*co-p.y*si,y:p.x*si+p.y*co});
    const p=agua.pontos.map(rodar);
    const xs=p.map(v=>v.x),ys=p.map(v=>v.y);
    const largura=paisagem?l.modulo.alturaM:l.modulo.larguraM;
    const altura=(paisagem?l.modulo.larguraM:l.modulo.alturaM)*Math.cos(agua.inclinacao*Math.PI/180);
    if(!(largura>0.1&&altura>0.1)) continue;
    let tentativas=0;
    for(let y=Math.min(...ys)+l.recuoM;y+altura<=Math.max(...ys)-l.recuoM+EPS;y+=altura+l.espacamentoM) {
      for(let x=Math.min(...xs)+l.recuoM;x+largura<=Math.max(...xs)-l.recuoM+EPS;x+=largura+l.espacamentoM) {
        if(++tentativas>100000 || placas.length>=Math.min(alvo,2000)) return placas;
        const pontos=[{x,y},{x:x+largura,y},{x:x+largura,y:y+altura},{x,y:y+altura}].map(voltar);
        if(cabe(pontos,agua.pontos,l.obstaculos.map(o=>o.pontos),l.recuoM)&&!placas.some(m=>sobrepoe(m.pontos,pontos))) placas.push({id:crypto.randomUUID(),aguaId:agua.id,pontos});
      }
    }
  }
  return placas;
}
export function areaSuperficie(l:LevantamentoTelhado) {
  return l.aguas.reduce((s,a)=>s+areaPoligono(a.pontos)/Math.cos(a.inclinacao*Math.PI/180),0);
}

/** Inclusão por clique com as mesmas dimensões e limites do preenchimento. */
export function inserirPlaca(l:LevantamentoTelhado,centro:PontoLocal,paisagem=false):PlacaManual | null {
  if(!l.escalaConfirmada||l.placas.length>=2000)return null;
  for(const agua of l.aguas) {
    if(!dentro(centro,agua.pontos))continue;
    const ang=(agua.azimute-l.norte)*Math.PI/180,co=Math.cos(ang),si=Math.sin(ang);
    const w=(paisagem?l.modulo.alturaM:l.modulo.larguraM)/2;
    const h=(paisagem?l.modulo.larguraM:l.modulo.alturaM)*Math.cos(agua.inclinacao*Math.PI/180)/2;
    const pontos=[{x:-w,y:-h},{x:w,y:-h},{x:w,y:h},{x:-w,y:h}].map(p=>({x:centro.x+p.x*co-p.y*si,y:centro.y+p.x*si+p.y*co}));
    if(cabe(pontos,agua.pontos,l.obstaculos.map(o=>o.pontos),l.recuoM)&&!l.placas.some(p=>sobrepoe(p.pontos,pontos)))return {id:crypto.randomUUID(),aguaId:agua.id,pontos};
  }
  return null;
}
