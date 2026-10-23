import assert from 'node:assert/strict';
import { aplicarSegmento, segmentoAplicavel } from '../src/utils/analiseSolar.ts';
import { consultarBuildingInsights } from '../server/src/services/googleSolarResposta.ts';
import { AppError } from '../server/src/errors.ts';
import type { LevantamentoTelhado } from '../src/utils/levantamentoTelhado.ts';

const agua = { id: 'a', nome: 'Principal', pontos: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: 10 }], inclinacao: 20, azimute: 180 };
const original: LevantamentoTelhado = {
  versao: 1, origem: 'manual', larguraM: 20, alturaM: 20, norte: 0, tipologia: 'Outro', escalaConfirmada: true,
  aguas: [agua, { ...agua, id: 'b' }], obstaculos: [], placas: [{ id: 'p', aguaId: 'a', pontos: [] }],
  modulo: { modelo: 'Catálogo', larguraM: 1, alturaM: 2, potenciaWp: 500 }, espacamentoM: 0.03, recuoM: 0.3,
};
const segmento = { indice: 0, inclinacaoGraus: 0, azimuteGraus: 0, areaM2: 100, centro: { latitude: -23, longitude: -46 }, insolacaoMediaKwh: 1500 };
const copia = structuredClone(original);
const aplicado = aplicarSegmento(original, 'a', segmento);
assert.equal(aplicado.aguas[0].inclinacao, 0);
assert.equal(aplicado.aguas[0].azimute, 0);
assert.deepEqual(aplicado.aguas[0].pontos, original.aguas[0].pontos);
assert.deepEqual(aplicado.aguas[1], original.aguas[1]);
assert.deepEqual(aplicado.modulo, original.modulo);
assert.deepEqual(aplicado.obstaculos, original.obstaculos);
assert.equal(aplicado.placas.length, 0);
assert.deepEqual(original, copia, 'estado anterior disponível para desfazer');
for (const inclinacaoGraus of [NaN, Infinity, -1, 76]) assert.equal(segmentoAplicavel({ ...segmento, inclinacaoGraus }), false);
assert.throws(() => aplicarSegmento(original, 'inexistente', segmento));
assert.equal(segmentoAplicavel({ ...segmento, azimuteGraus: 360 }), false);

const fetchOriginal = globalThis.fetch;
const resposta = {
  name: 'buildings/test', center: segmento.centro,
  solarPotential: { maxArrayAreaMeters2: 100, panelCapacityWatts: 400, panelHeightMeters: 1.8, panelWidthMeters: 1,
    wholeRoofStats: { areaMeters2: 120 }, roofSegmentStats: [{ center: segmento.centro, stats: { areaMeters2: 100, sunshineQuantiles: Array(11).fill(1500) } }] },
};
try {
  globalThis.fetch = async () => new Response(JSON.stringify(resposta));
  const r = await consultarBuildingInsights('https://example.invalid');
  assert.equal(r.solarPotential.roofSegmentStats[0].pitchDegrees, 0, 'zero omitido pelo formato do provedor');
  assert.equal(r.solarPotential.roofSegmentStats[0].azimuthDegrees, 0);
  for (const [status, codigo] of [[404, 'telhado_sem_dados'], [403, 'solar_acesso_recusado'], [429, 'solar_limite'], [503, 'solar_indisponivel']] as const) {
    globalThis.fetch = async () => new Response('', { status });
    await assert.rejects(consultarBuildingInsights('https://example.invalid'), e => e instanceof AppError && e.codigo === codigo);
  }
  globalThis.fetch = async () => new Response('{}');
  await assert.rejects(consultarBuildingInsights('https://example.invalid'), e => e instanceof AppError && e.codigo === 'solar_resposta_invalida');
  globalThis.fetch = async (_url, options) => new Promise<Response>((_resolve, reject) => {
    options?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });
  // Mantém o processo ativo: AbortSignal.timeout usa timer unref no Node.
  const manterAtivo = setTimeout(() => {}, 1000);
  try { await assert.rejects(consultarBuildingInsights('https://example.invalid', 5), e => e instanceof AppError && e.codigo === 'solar_timeout'); }
  finally { clearTimeout(manterAtivo); }
} finally { globalThis.fetch = fetchOriginal; }
console.log('OK: aplicação isolada, preservação do original, limites, validação da resposta e timeout solar.');
