import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';

// Exercita os listeners reais do hook sem depender de WebGL ou da rede Google.
const bundle = await build({
  entryPoints: ['src/components/mapa/useDesenhoGoogle.ts'], bundle: true,
  platform: 'node', format: 'cjs', write: false,
  plugins: [{ name: 'react-effects', setup(b) {
    b.onResolve({ filter: /^react$/ }, () => ({ path: 'react', namespace: 'effects' }));
    b.onLoad({ filter: /.*/, namespace: 'effects' }, () => ({ contents:
      'export const useRef = current => ({current}); export const useEffect = fn => globalThis.effects.push(fn);' }));
  } }],
});
const effects = [], module = { exports: {} }, window = {google:{maps:{}}};
runInNewContext(bundle.outputFiles[0].text, { exports: module.exports, module, effects, setTimeout, clearTimeout, window });
const listeners = new Map();
const mapa = {
  addEventListener: (name, fn) => listeners.set(name, fn),
  removeEventListener: name => listeners.delete(name),
};
const pontos = [];
const edicao = {
  dados: { aguas:[{id:'agua-1',pontos:[{x:30,y:30},{x:60,y:30},{x:60,y:60},{x:30,y:60}]}], larguraM: 90, alturaM: 90, satelite: { latitude: -19.85, longitude: -43.97, zoom: 20, larguraPx: 640, alturaPx: 640 } },
  ferramenta: 'agua', rascunho: [], onPonto: p => pontos.push(p),
  onAviso() {}, onCamera() {}, onFechar() {}, onRemover() {},
};
module.exports.useDesenhoGoogle({ mapa }, '3d', edicao);
const limpar = effects[0]();
const emitir = (name, e) => listeners.get(name)({stopPropagation() {}, ...e});
const click = () => emitir('gmp-click', { position: { lat: -19.85, lng: -43.97 } });
click();
assert.equal(pontos.length, 1);
assert.equal(pontos[0].x, 45);
assert.equal(pontos[0].y, 45, '3D usa o mesmo centro da planta 2D');
// A cena pode continuar carregando tiles mesmo com a câmera parada. Alguns
// navegadores só expõem o gmp-click, sem PointerEvents do canvas interno.
emitir('gmp-steadychange', { isSteady: false });
for (const ferramenta of ['agua', 'calibrar', 'placa']) {
  edicao.ferramenta = ferramenta;
  const antes = pontos.length;
  click();
  assert.equal(pontos.length, antes + 1, `${ferramenta} aceita posição nativa enquanto a cena renderiza`);
}
pontos.splice(1);
edicao.ferramenta = 'agua';
emitir('gmp-steadychange', { isSteady: true });
emitir('pointerdown', { button: 0, pointerId: 1, clientX: 0, clientY: 0, composedPath: () => [] });
emitir('pointermove', { pointerId: 1, clientX: 20, clientY: 0 });
emitir('pointerup', { pointerId: 1, clientX: 20, clientY: 0 }); click();
assert.equal(pontos.length, 1, 'arrasto não se transforma em clique no final');
emitir('pointerdown', { button: 0, pointerId: 2, clientX: 0, clientY: 0, composedPath: () => [] });
emitir('pointerup', { pointerId: 2, clientX: 0, clientY: 0 }); click(); click();
assert.equal(pontos.length, 2, 'um gesto adiciona apenas um ponto');
emitir('pointercancel', {});
emitir('gmp-click', {});
assert.equal(pontos.length, 2, 'sem coordenada nativa não inventa um vértice no solo');
let selecionada; edicao.onSelecionarAgua=id=>{selecionada=id;};
edicao.ferramenta = 'navegar'; click();
assert.equal(selecionada,'agua-1','modo Mover seleciona a água sob o clique em 3D');
assert.equal(pontos.length, 2, 'modo Mover não desenha');
edicao.ferramenta='agua';
emitir('gmp-steadychange',{isSteady:false});
emitir('pointerdown',{button:0,pointerId:3,clientX:10,clientY:10,composedPath:()=>[]});
click();
assert.equal(pontos.length,3,'um toque sem movimento desenha mesmo se o Google emitir steady=false');
// Regressão: um clique de edição não pode iniciar o arrasto do SDK, mas
// precisa preservar o click que fornece a posição real sobre a malha.
let animacoesInterrompidas=0;
mapa.stopCameraAnimation=()=>animacoesInterrompidas++;
for(const ferramenta of ['agua','obstaculo','calibrar','placa','remover','navegar']){
  edicao.ferramenta=ferramenta;
  let propagou=true,cancelouPadrao=false;
  emitir('pointerdown',{button:0,pointerId:4,clientX:10,clientY:10,composedPath:()=>[],
    stopPropagation(){propagou=false;},preventDefault(){cancelouPadrao=true;}});
  assert.equal(propagou,true,'preserva pointerdown para o SDK reconhecer o clique');
  assert.equal(cancelouPadrao,false,'preserva click nativo para obter coordenadas do Google');
  emitir('pointermove',{pointerId:4,clientX:11,clientY:10,stopPropagation(){propagou=false;}});
  assert.equal(propagou,ferramenta==='navegar',`${ferramenta}: apenas Mover mapa permite arrastar a câmera`);
  let zoom=true;
  emitir('dblclick',{preventDefault(){zoom=false;},stopPropagation(){}});
  assert.equal(zoom,ferramenta==='navegar','duplo clique só aproxima no modo de navegação');
  emitir('pointerup',{pointerId:4,clientX:11,clientY:10});
  if(['agua','obstaculo','calibrar','placa'].includes(ferramenta)){
    const antes=pontos.length;
    click();click();
    assert.equal(pontos.length,antes+1,`${ferramenta}: um gesto registra exatamente um ponto`);
  }
}
assert.equal(animacoesInterrompidas,5,'edição interrompe movimento pendente da câmera');
// Regressão: o Map3DElement aproxima no duplo clique pelos PointerEvents, sem
// passar pelo evento dblclick. A câmera anterior ao gesto deve ser restaurada.
Object.assign(mapa,{center:{lat:-19.85,lng:-43.97,altitude:800},range:40,tilt:0,heading:0});
edicao.ferramenta='placa';
emitir('pointerdown',{button:0,pointerId:5,clientX:10,clientY:10,composedPath:()=>[]});
emitir('pointerup',{pointerId:5,clientX:10,clientY:10});
Object.assign(mapa,{center:{lat:-19.8501,lng:-43.9701,altitude:800},range:12});
emitir('gmp-rangechange',{});
assert.deepEqual([mapa.center.lat,mapa.range],[-19.85,40],'duplo clique em edição não aproxima a câmera 3D');
emitir('wheel',{});
mapa.range=25;emitir('gmp-rangechange',{});
assert.equal(mapa.range,25,'roda do mouse continua aproximando durante a edição');
edicao.ferramenta='navegar';
emitir('pointerdown',{button:0,pointerId:6,clientX:10,clientY:10,composedPath:()=>[]});
mapa.range=10;emitir('gmp-rangechange',{});
assert.equal(mapa.range,10,'Mover mapa permite aproximar');
animacoesInterrompidas=0;
limpar();
assert.equal(listeners.size, 0, 'desmontagem remove todos os listeners');
module.exports.useDesenhoGoogle({ mapa }, '3d', edicao, true);
assert.equal(effects[3](), undefined, 'prévia não instala listeners de edição');
assert.equal(listeners.size, 0, 'prévia permanece sem ações de desenho');
const objetos=[];
class Forma {
  constructor(options) { this.options=options; this.listeners=new Map(); }
  addEventListener(name, fn) { this.listeners.set(name,fn); }
  removeEventListener(name) { this.listeners.delete(name); }
  remove() { this.removido=true; }
}
class AguaInterativa extends Forma {}
mapa.append=objeto=>objetos.push(objeto);
Object.assign(edicao.dados,{obstaculos:[],placas:[]});
edicao.ferramenta='navegar';
edicao.aguaSelecionada='agua-1';
const biblioteca={Polygon3DInteractiveElement:AguaInterativa,Polygon3DElement:Forma,Polyline3DElement:Forma};
module.exports.useDesenhoGoogle({mapa,biblioteca},'3d',edicao);
const limparFormas=effects[8]();
assert.equal(objetos.length,1,'não cria moldura ou água quadrada automaticamente');
const agua=objetos.find(o=>o instanceof AguaInterativa);
assert(agua,'água usa polígono 3D interativo');
assert.equal(agua.options.strokeWidth,4,'água selecionada recebe destaque');
selecionada=undefined;
let propagou=true;
agua.listeners.get('gmp-click')({stopPropagation(){propagou=false;}});
assert.equal(selecionada,'agua-1','clique no polígono seleciona sem depender da posição do evento');
assert.equal(propagou,false,'seleção não adiciona pontos ao mapa');
limparFormas();
assert.equal(agua.listeners.size,0,'desmontagem limpa a seleção');
assert(objetos.every(o=>o.removido),'desmontagem remove as sobreposições');
edicao.dados.placas=[{id:'placa-1',pontos:[{x:40,y:40},{x:42,y:40},{x:42,y:44},{x:40,y:44}]}];
objetos.length=0;
module.exports.useDesenhoGoogle({mapa,biblioteca},'3d',edicao);
const limparCamadas=effects[11]();
const agua3d=objetos.find(o=>o.options.fillColor==='#0284c780');
const placa3d=objetos.find(o=>o.options.fillColor==='#1e3a8aff');
assert(agua3d&&placa3d,'água translúcida e placa opaca são desenhadas');
assert(placa3d.options.zIndex>agua3d.options.zIndex,'placa tem prioridade sobre a água selecionada');
assert(placa3d.options.path.every(p=>p.altitude>agua3d.options.path[0].altitude),'placa fica acima da superfície da água no 3D');
assert.equal(placa3d.options.altitudeMode,'RELATIVE_TO_MESH','placa acompanha a superfície do imóvel');
listeners.get('solarcosta-captura-fase')({detail:'contornos'});
const captura=objetos.filter(o=>!o.removido);
assert(captura.find(o=>o.options.fillColor==='#1e3a8aff').options.zIndex>captura.find(o=>o.options.strokeColor==='#0284c7').options.zIndex,'captura preserva placas sobre as águas');
limparCamadas();
class FormaSatelite extends Forma {
  constructor(options){super(options);objetos.push(this);}
  addListener(){return {remove(){}};}
  setMap(mapa){if(mapa===null)this.removido=true;}
}
Object.assign(window.google.maps,{Polygon:FormaSatelite,Polyline:FormaSatelite});
objetos.length=0;
module.exports.useDesenhoGoogle({mapa},'satelite',edicao);
let opcoes;mapa.setOptions=o=>{opcoes=o;};
edicao.ferramenta='placa';
module.exports.useDesenhoGoogle({mapa},'satelite',edicao);
effects[13]();
assert.deepEqual({...opcoes},{draggable:false,disableDoubleClickZoom:true},'satélite não arrasta nem aproxima por duplo clique em edição');
const limparSatelite=effects[14]();
const agua2d=objetos.find(o=>o.options.fillColor==='#0284c7');
const placa2d=objetos.find(o=>o.options.fillColor==='#1e3a8a');
assert(placa2d.options.zIndex>agua2d.options.zIndex,'satélite também mantém placas sobre as águas');
assert.equal(placa2d.options.fillOpacity,1,'placas do satélite são opacas');
limparSatelite();
console.log('OK: coordenadas 2D/3D, câmera em movimento, arrasto, duplicação, navegação e limpeza.');
