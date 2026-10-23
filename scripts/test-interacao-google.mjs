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
const effects = [], module = { exports: {} };
runInNewContext(bundle.outputFiles[0].text, { exports: module.exports, module, effects, setTimeout, clearTimeout });
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
const emitir = (name, e) => listeners.get(name)(e);
const click = () => emitir('gmp-click', { position: { lat: -19.85, lng: -43.97 } });
click();
assert.equal(pontos.length, 1);
assert.equal(pontos[0].x, 45);
assert.equal(pontos[0].y, 45, '3D usa o mesmo centro da planta 2D');
emitir('gmp-steadychange', { isSteady: false }); click();
assert.equal(pontos.length, 1, 'câmera em movimento não adiciona vértices');
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
limpar();
assert.equal(listeners.size, 0, 'desmontagem remove todos os listeners');
module.exports.useDesenhoGoogle({ mapa }, '3d', edicao, true);
assert.equal(effects[2](), undefined, 'prévia não instala listeners de edição');
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
const limparFormas=effects[5]();
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
console.log('OK: coordenadas 2D/3D, câmera em movimento, arrasto, duplicação, navegação e limpeza.');
