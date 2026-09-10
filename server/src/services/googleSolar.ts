// Integração com o Google Maps Platform: Geocoding + Solar API.
//
// Por que fica no servidor e não no front: a chave é restrita por IP da VPS.
// Uma chave no bundle do Vite é pública, e sem restrição de IP vira conta
// aberta na fatura de quem a encontrar.
//
// O que esta camada NÃO faz: posicionar os módulos. A Solar API devolve um
// layout pronto, mas assumindo placa de 400 Wp — a Solar Costa vende 710 Wp,
// que é fisicamente maior. O empacotamento com a placa real acontece no
// front (src/utils/layoutModulos.ts), junto com o resto do dimensionamento.
// Aqui só normalizamos o que o Google devolve.

import { config } from '../config.js';
import { AppError } from '../errors.js';

const GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const SOLAR_URL = 'https://solar.googleapis.com/v1/buildingInsights:findClosest';
const STATIC_URL = 'https://maps.googleapis.com/maps/api/staticmap';

/**
 * Cache em memória. O ToS do Google permite cache temporário de conteúdo por
 * até 30 dias; o `place_id` é a única coisa que pode ser guardada para sempre
 * (e é o que persistimos no banco). 24h é folgado para o uso real: o consultor
 * abre o mesmo endereço várias vezes enquanto monta a proposta.
 *
 * `buildingInsights` é a chamada mais cara do conjunto — sem cache, cada
 * ajuste de kit na tela viraria uma cobrança.
 */
const TTL_MS = 24 * 60 * 60 * 1000;
const cache = new Map<string, { em: number; valor: unknown }>();

function doCache<T>(chave: string): T | null {
  const hit = cache.get(chave);
  if (!hit) return null;
  if (Date.now() - hit.em > TTL_MS) {
    cache.delete(chave);
    return null;
  }
  return hit.valor as T;
}

function guardar(chave: string, valor: unknown): void {
  // Limite defensivo: sem isso o Map cresce para sempre num processo longo.
  if (cache.size > 500) cache.clear();
  cache.set(chave, { em: Date.now(), valor });
}

function exigirChave(): string {
  if (!config.GOOGLE_MAPS_SERVER_KEY) {
    throw new AppError(
      503,
      'Busca por satélite indisponível: GOOGLE_MAPS_SERVER_KEY não configurada.',
      'google_maps_desligado',
    );
  }
  return config.GOOGLE_MAPS_SERVER_KEY;
}

/* ============================================================ GEOCODING == */

/**
 * Precisão devolvida pelo Geocoding. Importa mais do que parece: só
 * `ROOFTOP` cai em cima de uma edificação. `RANGE_INTERPOLATED` é um chute
 * ao longo da rua e `APPROXIMATE` é o centro do bairro — nesses dois a Solar
 * API responde 404 mesmo em cidade coberta, porque não há prédio no ponto.
 */
export type PrecisaoGeocoding =
  | 'ROOFTOP'
  | 'RANGE_INTERPOLATED'
  | 'GEOMETRIC_CENTER'
  | 'APPROXIMATE';

export interface EnderecoGeocodificado {
  latitude: number;
  longitude: number;
  precisao: PrecisaoGeocoding;
  /** true só em ROOFTOP: abaixo disso o pino provavelmente não está no telhado. */
  confiavel: boolean;
  enderecoFormatado: string;
  placeId: string;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
}

function componente(
  componentes: Array<{ long_name: string; short_name: string; types: string[] }>,
  tipo: string,
  curto = false,
): string | null {
  const c = componentes.find((x) => x.types.includes(tipo));
  if (!c) return null;
  return curto ? c.short_name : c.long_name;
}

export async function geocodificar(endereco: string): Promise<EnderecoGeocodificado> {
  const chave = exigirChave();
  const emCache = doCache<EnderecoGeocodificado>(`geo:${endereco}`);
  if (emCache) return emCache;

  const url = `${GEOCODING_URL}?address=${encodeURIComponent(endereco)}&region=br&language=pt-BR&key=${chave}`;
  const resp = await fetch(url);

  // Atenção: o Geocoding devolve HTTP 200 mesmo quando recusa. O erro real
  // vem no campo `status` do corpo — checar só resp.ok deixa passar.
  const json = (await resp.json()) as {
    status: string;
    error_message?: string;
    results: Array<{
      formatted_address: string;
      place_id: string;
      geometry: { location: { lat: number; lng: number }; location_type: PrecisaoGeocoding };
      address_components: Array<{ long_name: string; short_name: string; types: string[] }>;
    }>;
  };

  if (json.status === 'ZERO_RESULTS') {
    throw new AppError(404, 'Endereço não localizado no mapa.', 'endereco_nao_encontrado');
  }
  if (json.status !== 'OK' || !json.results[0]) {
    console.error('[geocoding]', json.status, json.error_message);
    throw new AppError(502, 'Falha ao consultar o mapa. Tente novamente.', 'geocoding_falhou');
  }

  const r = json.results[0];
  const comp = r.address_components;
  const resultado: EnderecoGeocodificado = {
    latitude: r.geometry.location.lat,
    longitude: r.geometry.location.lng,
    precisao: r.geometry.location_type,
    confiavel: r.geometry.location_type === 'ROOFTOP',
    enderecoFormatado: r.formatted_address,
    placeId: r.place_id,
    bairro: componente(comp, 'sublocality_level_1') ?? componente(comp, 'sublocality'),
    cidade: componente(comp, 'administrative_area_level_2'),
    uf: componente(comp, 'administrative_area_level_1', true),
    cep: componente(comp, 'postal_code'),
  };

  guardar(`geo:${endereco}`, resultado);
  return resultado;
}

/* =========================================================== SOLAR API == */

export interface SegmentoTelhado {
  indice: number;
  /** Graus, 0 = norte, sentido horário. Define a rotação das fileiras. */
  azimuteGraus: number;
  inclinacaoGraus: number;
  areaM2: number;
  centro: { latitude: number; longitude: number };
  /**
   * Insolação mediana do segmento, em kWh/m²/ano. É o critério de preenchimento
   * do layout: no hemisfério sul a água voltada para o norte rende bem mais que
   * a voltada para o sul, e área sozinha não captura isso.
   */
  insolacaoMediaKwh: number;
}

export interface PlacaGoogle {
  centro: { latitude: number; longitude: number };
  orientacao: 'LANDSCAPE' | 'PORTRAIT';
  segmentoIndice: number;
}

export interface TelhadoSolar {
  /** Id estável da edificação — pode ser persistido sem prazo (ToS). */
  edificacaoId: string;
  centro: { latitude: number; longitude: number };
  /** Data da foto aérea de levantamento 3D original. */
  imagemData: { ano: number; mes: number; dia: number } | null;
  /** Data mais recente de processamento e atualização solar pelo Google. */
  imagemProcessadaData: { ano: number; mes: number; dia: number } | null;
  imagemQualidade: string | null;
  areaTelhadoM2: number;
  areaMaxArranjoM2: number;
  segmentos: SegmentoTelhado[];
  /**
   * Posições que o Google considerou aproveitáveis, para a placa DELE
   * (400 Wp). Não são as nossas placas: servem de máscara da área útil do
   * telhado, que é a informação que o `roofSegmentStats` não dá — de lá vem
   * só uma bounding box retangular, larga demais para empacotar em cima.
   */
  placasGoogle: PlacaGoogle[];
  /** Dimensões que o Google assumiu, para converter a máscara na nossa escala. */
  placaGoogle: { potenciaWp: number; alturaM: number; larguraM: number };
}

interface RespostaSolar {
  name: string;
  center: { latitude: number; longitude: number };
  imageryDate?: { year: number; month: number; day: number };
  imageryProcessedDate?: { year: number; month: number; day: number };
  imageryQuality?: string;
  solarPotential: {
    maxArrayAreaMeters2: number;
    panelCapacityWatts: number;
    panelHeightMeters: number;
    panelWidthMeters: number;
    wholeRoofStats: { areaMeters2: number };
    roofSegmentStats: Array<{
      pitchDegrees: number;
      azimuthDegrees: number;
      stats: { areaMeters2: number; sunshineQuantiles: number[] };
      center: { latitude: number; longitude: number };
    }>;
    solarPanels?: Array<{
      center: { latitude: number; longitude: number };
      orientation: 'LANDSCAPE' | 'PORTRAIT';
      segmentIndex: number;
    }>;
  };
}

export async function telhadoPorCoordenada(
  latitude: number,
  longitude: number,
): Promise<TelhadoSolar> {
  const chave = exigirChave();
  // 6 casas ≈ 11 cm: agrupa cliques vizinhos no mesmo prédio sem perder precisão.
  const cacheKey = `solar:${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  const emCache = doCache<TelhadoSolar>(cacheKey);
  if (emCache) return emCache;

  const url =
    `${SOLAR_URL}?location.latitude=${latitude}&location.longitude=${longitude}` +
    `&requiredQuality=HIGH&key=${chave}`;
  const resp = await fetch(url);

  if (resp.status === 404) {
    throw new AppError(
      404,
      'O Google não tem análise de telhado para este ponto. Ajuste o pino sobre a edificação e tente de novo.',
      'telhado_sem_dados',
    );
  }
  if (!resp.ok) {
    const corpo = await resp.text();
    console.error('[solar api]', resp.status, corpo.slice(0, 400));
    throw new AppError(502, 'Falha ao consultar a análise de telhado.', 'solar_falhou');
  }

  const j = (await resp.json()) as RespostaSolar;
  const s = j.solarPotential;

  const resultado: TelhadoSolar = {
    edificacaoId: j.name,
    centro: j.center,
    imagemData: j.imageryDate
      ? { ano: j.imageryDate.year, mes: j.imageryDate.month, dia: j.imageryDate.day }
      : null,
    imagemProcessadaData: j.imageryProcessedDate
      ? { ano: j.imageryProcessedDate.year, mes: j.imageryProcessedDate.month, dia: j.imageryProcessedDate.day }
      : null,
    imagemQualidade: j.imageryQuality ?? null,
    areaTelhadoM2: s.wholeRoofStats.areaMeters2,
    areaMaxArranjoM2: s.maxArrayAreaMeters2,
    segmentos: s.roofSegmentStats.map((r, indice) => ({
      indice,
      azimuteGraus: r.azimuthDegrees,
      inclinacaoGraus: r.pitchDegrees,
      areaM2: r.stats.areaMeters2,
      centro: r.center,
      // O Google devolve 11 quantis (0%, 10%, ... 100%); o do meio é a mediana.
      insolacaoMediaKwh: r.stats.sunshineQuantiles?.[5] ?? 0,
    })),
    placasGoogle: (s.solarPanels ?? []).map((p) => ({
      centro: p.center,
      orientacao: p.orientation,
      segmentoIndice: p.segmentIndex,
    })),
    placaGoogle: {
      potenciaWp: s.panelCapacityWatts,
      alturaM: s.panelHeightMeters,
      larguraM: s.panelWidthMeters,
    },
  };

  guardar(cacheKey, resultado);
  return resultado;
}

/* ===================================================== IMAGEM ESTÁTICA == */

export interface ImagemSatelite {
  bytes: Buffer;
  tipo: string;
}

/**
 * Recorte de satélite do telhado, sem sobreposições.
 *
 * Os módulos NÃO são desenhados aqui: o Static Maps aceita `path=` por
 * polígono, mas cada módulo viraria um path e a URL estoura o limite de 8 KB
 * já na casa das duas dezenas de placas. O front desenha os módulos em SVG
 * por cima desta imagem, usando a mesma projeção — o que também mantém o
 * desenho vetorial na impressão, em vez de virar pixel serrilhado.
 *
 * Passa pela nossa API em vez de ir direto do <img> para o Google por dois
 * motivos: a chave não pode aparecer no HTML, e a imagem precisa vir da mesma
 * origem para o navegador não recusar na hora de imprimir.
 */
export async function imagemSatelite(
  latitude: number,
  longitude: number,
  zoom = 20,
  largura = 640,
  altura = 640,
): Promise<ImagemSatelite> {
  const chave = exigirChave();
  // Limita o zoom ao nível 20: no Brasil o Google Maps não tem cobertura nativa ótica
  // em zoom 21, gerando interpolação digital 4x borrada. O nível 20 é o mais nítido.
  const z = Math.min(20, Math.max(16, Math.round(zoom)));
  const w = Math.min(640, Math.max(100, Math.round(largura)));
  const h = Math.min(640, Math.max(100, Math.round(altura)));

  const url =
    `${STATIC_URL}?center=${latitude},${longitude}&zoom=${z}` +
    `&size=${w}x${h}&scale=2&maptype=satellite&format=png&key=${chave}`;

  const resp = await fetch(url);
  if (!resp.ok) {
    const corpo = await resp.text();
    console.error('[static maps]', resp.status, corpo.slice(0, 300));
    throw new AppError(502, 'Não foi possível carregar a imagem de satélite.', 'imagem_falhou');
  }

  return {
    bytes: Buffer.from(await resp.arrayBuffer()),
    tipo: resp.headers.get('content-type') ?? 'image/png',
  };
}
