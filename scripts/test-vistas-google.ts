import assert from 'node:assert/strict';
import { criarGeorreferencia } from '../src/utils/georreferenciaTelhado.ts';
import { lerCameraGoogle } from '../src/components/mapa/useDesenhoGoogle.ts';
import { levantamentoTelhadoSchema } from '../server/src/schemas/levantamentoTelhado.ts';
import type { LevantamentoTelhado } from '../src/utils/levantamentoTelhado.ts';
import { projetarClique3d } from '../src/utils/projecaoCamera3d.ts';

const d: LevantamentoTelhado = { versao: 1, origem: 'manual', larguraM: 90, alturaM: 90, norte: 0,
  tipologia: 'Não informado', escalaConfirmada: true, aguas: [], obstaculos: [], placas: [],
  modulo: { modelo: 'Teste', larguraM: 1, alturaM: 2, potenciaWp: 500 }, espacamentoM: 0.03, recuoM: 0.3,
  localizacao: { latitude: -19.85, longitude: -43.97 },
  satelite: { latitude: -19.85, longitude: -43.97, zoom: 20, larguraPx: 640, alturaPx: 640 },
};
assert.equal(criarGeorreferencia({ ...d, satelite: undefined }), null);
const geo = criarGeorreferencia(d)!;
assert(Math.abs(geo.paraGeo({ x: 45, y: 45 }).lat + 19.85) < 1e-10);
assert.equal(geo.paraGeo({ x: 45, y: 45 }).lng, -43.97);
for (const p of [{ x: 0, y: 0 }, { x: 90, y: 90 }, { x: 12.321, y: 43.123 }]) {
  const g = geo.paraGeo(p), volta = geo.paraLocal(g.lat, g.lng);
  assert(Math.abs(volta.x - p.x) < 1e-6 && Math.abs(volta.y - p.y) < 1e-6, 'clique Google retorna ao mesmo ponto em metros');
}
const redimensionado = criarGeorreferencia({ ...d, larguraM: 180, alturaM: 180 })!;
assert.deepEqual(redimensionado.paraGeo({ x: 90, y: 90 }), geo.paraGeo({ x: 45, y: 45 }), 'calibração não desloca a imagem');
const vista = lerCameraGoogle('3d', { center: { lat: -19.851, lng: -43.972, altitude: 850 }, range: 180, tilt: 50, heading: -15 })!;
assert.equal(vista.azimute, 345);
assert.equal(vista.latitude, -19.851);
const salvo = levantamentoTelhadoSchema.parse(JSON.parse(JSON.stringify({ ...d, vistaGoogle: vista })));
assert.deepEqual(salvo.vistaGoogle, vista, 'contrato do servidor preserva enquadramento para reabrir');
assert.equal(salvo.placas.length, 0, 'salva mapa antes da distribuição');
assert(levantamentoTelhadoSchema.safeParse({ ...d, escalaConfirmada: false, vistaGoogle: vista }).success, 'vista sem geometria dispensa escala de engenharia');
assert(!levantamentoTelhadoSchema.safeParse(d).success, 'levantamento vazio sem vista continua inválido');
assert(!levantamentoTelhadoSchema.safeParse({ ...d, vistaGoogle: { ...vista, altitude: Infinity } }).success);
assert(!levantamentoTelhadoSchema.safeParse({ ...d, vistaGoogle: { ...vista, latitude: 150 } }).success);
const satelite = lerCameraGoogle('satelite', { getCenter: () => ({ lat: () => -19.85, lng: () => -43.97 }), getZoom: () => 21 });
assert.deepEqual(satelite, { modo: 'satelite', latitude: -19.85, longitude: -43.97, zoom: 21 });
console.log('OK: pontos Google em metros, calibração, câmera 3D, vista sem placas e contrato de persistência.');
const camera={latitude:-19.85,longitude:-43.97,distanciaM:180,inclinacao:45,azimute:0,fov:35};
for(const azimute of [0,90,180,270]){
  const centro=projetarClique3d({...camera,azimute},{largura:1000,altura:600,x:500,y:300})!;
  assert(Math.abs(centro.lat-camera.latitude)<1e-10&&Math.abs(centro.lng-camera.longitude)<1e-10,'centro da tela aponta para o centro geográfico em qualquer orientação');
}
assert(projetarClique3d(camera,{largura:1000,altura:600,x:600,y:300})!.lng>camera.longitude,'direita com norte para cima aponta para leste');
assert(projetarClique3d({...camera,azimute:90},{largura:1000,altura:600,x:600,y:300})!.lat<camera.latitude,'direita com câmera virada para leste aponta para sul');
assert.equal(projetarClique3d(camera,{largura:0,altura:600,x:0,y:0}),null);
assert.equal(projetarClique3d({...camera,inclinacao:89},{largura:1000,altura:600,x:500,y:0}),null,'clique no horizonte não inventa ponto');
console.log('OK: clique alternativo no plano, orientação da câmera e rejeição do horizonte.');
