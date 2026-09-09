// Posicionamento dos módulos sobre o telhado, para a figura da proposta.
//
// Por que não usamos o layout pronto da Solar API: o Google posiciona placas
// de 400 Wp (1,879 x 1,045 m) e a Solar Costa vende 710 Wp (~2,38 x 1,30 m).
// Desenhar as placas do Google daria uma figura bonita e errada — 72 placas no
// desenho contra 12 módulos na lista de equipamentos, no mesmo documento. O
// cliente compara as duas coisas.
//
// O que aproveitamos do Google: os SEGMENTOS (azimute, inclinação, insolação)
// e as posições das placas dele como MÁSCARA da área aproveitável. Essa
// máscara é a parte difícil de obter — `roofSegmentStats` só devolve uma
// bounding box retangular, que numa casa em L cobre o quintal junto.
//
// Estas funções são puras: nada de `google.maps` aqui. Isso mantém o cálculo
// testável e permite reusá-lo na impressão sem carregar a API do mapa.

/** Raio equatorial WGS84. */
const RAIO_TERRA_M = 6378137;

export interface Coordenada {
  latitude: number;
  longitude: number;
}

export interface SegmentoEntrada {
  indice: number;
  azimuteGraus: number;
  inclinacaoGraus: number;
  areaM2: number;
  centro: Coordenada;
  insolacaoMediaKwh: number;
}

export interface PlacaMascara {
  centro: Coordenada;
  segmentoIndice: number;
}

export interface EntradaLayout {
  /** Segmentos de telhado devolvidos pela Solar API. */
  segmentos: SegmentoEntrada[];
  /** Placas do Google — usadas só como máscara de área útil. */
  mascara: PlacaMascara[];
  /** Dimensões da placa que o Google assumiu, para calibrar a máscara. */
  placaMascara: { alturaM: number; larguraM: number };
  /** Dimensões físicas do NOSSO módulo (layout.modulo_*_m). */
  modulo: { larguraM: number; alturaM: number };
  /** Folga entre módulos vizinhos (layout.espacamento_m). */
  espacamentoM: number;
  /** Quantos módulos o dimensionamento pediu (dimensionar().modulosQtd). */
  quantidade: number;
}

export interface ModuloPosicionado {
  /** Os 4 cantos, em ordem horária, prontos para virar um polígono no mapa. */
  cantos: Coordenada[];
  centro: Coordenada;
  segmento: number;
  azimuteGraus: number;
}

export interface ResultadoLayout {
  modulos: ModuloPosicionado[];
  /** Quantos couberam de fato. Menor que `quantidade` = telhado apertado. */
  couberam: number;
  /** Quantos foram pedidos, para a UI comparar sem refazer a conta. */
  solicitados: number;
  /** Capacidade máxima do telhado com o nosso módulo, ignorando a quantidade. */
  capacidadeMaxima: number;
  porSegmento: Array<{ segmento: number; modulos: number; azimuteGraus: number }>;
}

/* ====================================================== PROJEÇÃO LOCAL == */
//
// Num telhado (dezenas de metros) a curvatura da Terra é irrelevante, então
// projetamos tudo num plano equirretangular centrado no imóvel: x para leste,
// y para o norte, ambos em metros. O erro nessa escala fica muito abaixo da
// precisão da própria imagem de satélite.

interface Plano {
  latRef: number;
  lngRef: number;
  metrosPorGrauLng: number;
  metrosPorGrauLat: number;
}

function criarPlano(ref: Coordenada): Plano {
  const rad = (ref.latitude * Math.PI) / 180;
  return {
    latRef: ref.latitude,
    lngRef: ref.longitude,
    metrosPorGrauLat: (Math.PI / 180) * RAIO_TERRA_M,
    metrosPorGrauLng: (Math.PI / 180) * RAIO_TERRA_M * Math.cos(rad),
  };
}

function paraMetros(p: Plano, c: Coordenada): { x: number; y: number } {
  return {
    x: (c.longitude - p.lngRef) * p.metrosPorGrauLng,
    y: (c.latitude - p.latRef) * p.metrosPorGrauLat,
  };
}

function paraCoordenada(p: Plano, x: number, y: number): Coordenada {
  return {
    longitude: p.lngRef + x / p.metrosPorGrauLng,
    latitude: p.latRef + y / p.metrosPorGrauLat,
  };
}

/* ========================================================= EMPACOTAMENTO == */

/**
 * Distância máxima entre o ponto amostrado e o centro de uma placa do Google
 * para considerar aquele ponto "em cima de área aproveitável". Meia diagonal
 * da placa do Google é o valor natural: cobre a placa inteira e nada além.
 */
function raioMascara(placa: { alturaM: number; larguraM: number }): number {
  return Math.hypot(placa.alturaM, placa.larguraM) / 2;
}

/**
 * Empacota os módulos de um segmento.
 *
 * O sistema de coordenadas gira para o azimute do segmento: `u` corre ao longo
 * da cumeeira e `v` desce a água do telhado. As fileiras ficam paralelas à
 * cumeeira, que é como o módulo é instalado de verdade.
 */
function empacotarSegmento(
  plano: Plano,
  seg: SegmentoEntrada,
  mascaraDoSegmento: Array<{ x: number; y: number }>,
  modulo: { larguraM: number; alturaM: number },
  espacamentoM: number,
  raio: number,
): ModuloPosicionado[] {
  if (mascaraDoSegmento.length === 0) return [];

  const az = (seg.azimuteGraus * Math.PI) / 180;
  // Descida da água (azimute 0 = norte, sentido horário) e paralelo à cumeeira.
  const dv = { x: Math.sin(az), y: Math.cos(az) };
  const du = { x: Math.cos(az), y: -Math.sin(az) };

  const paraUV = (p: { x: number; y: number }) => ({
    u: p.x * du.x + p.y * du.y,
    v: p.x * dv.x + p.y * dv.y,
  });
  const paraXY = (u: number, v: number) => ({
    x: u * du.x + v * dv.x,
    y: u * du.y + v * dv.y,
  });

  const mascaraUV = mascaraDoSegmento.map(paraUV);
  const us = mascaraUV.map((p) => p.u);
  const vs = mascaraUV.map((p) => p.v);
  // A máscara são centros de placa; a área real se estende meia placa além.
  const uMin = Math.min(...us) - raio;
  const uMax = Math.max(...us) + raio;
  const vMin = Math.min(...vs) - raio;
  const vMax = Math.max(...vs) + raio;

  const passoU = modulo.larguraM + espacamentoM;
  const passoV = modulo.alturaM + espacamentoM;
  const meiaU = modulo.larguraM / 2;
  const meiaV = modulo.alturaM / 2;

  // Um módulo só entra se os 4 cantos e o centro caírem sobre área
  // aproveitável. Testar só o centro deixaria módulos pendurados na borda.
  const dentro = (cu: number, cv: number): boolean => {
    const amostras = [
      [cu, cv],
      [cu - meiaU, cv - meiaV],
      [cu + meiaU, cv - meiaV],
      [cu - meiaU, cv + meiaV],
      [cu + meiaU, cv + meiaV],
    ];
    return amostras.every(([au, av]) =>
      mascaraUV.some((m) => Math.hypot(m.u - au!, m.v - av!) <= raio),
    );
  };

  const modulos: ModuloPosicionado[] = [];
  // Centraliza a grade na máscara: sobra dividida entre as duas bordas em vez
  // de acumular toda de um lado, que é o que uma grade ancorada no mínimo faz.
  const colunas = Math.floor((uMax - uMin + espacamentoM) / passoU);
  const linhas = Math.floor((vMax - vMin + espacamentoM) / passoV);
  const sobraU = uMax - uMin - (colunas * passoU - espacamentoM);
  const sobraV = vMax - vMin - (linhas * passoV - espacamentoM);

  for (let li = 0; li < linhas; li++) {
    const cv = vMin + sobraV / 2 + meiaV + li * passoV;
    for (let co = 0; co < colunas; co++) {
      const cu = uMin + sobraU / 2 + meiaU + co * passoU;
      if (!dentro(cu, cv)) continue;

      const centroXY = paraXY(cu, cv);
      const cantosUV = [
        [cu - meiaU, cv - meiaV],
        [cu + meiaU, cv - meiaV],
        [cu + meiaU, cv + meiaV],
        [cu - meiaU, cv + meiaV],
      ];
      modulos.push({
        cantos: cantosUV.map(([u, v]) => {
          const p = paraXY(u!, v!);
          return paraCoordenada(plano, p.x, p.y);
        }),
        centro: paraCoordenada(plano, centroXY.x, centroXY.y),
        segmento: seg.indice,
        azimuteGraus: seg.azimuteGraus,
      });
    }
  }

  return modulos;
}

/**
 * Distribui `quantidade` módulos pelo telhado, do segmento mais ensolarado
 * para o menos, e devolve a geometria de cada um.
 *
 * Quando não cabe tudo, devolve o que coube e `couberam < solicitados` — cabe
 * à UI avisar o consultor, não a esta função decidir o que fazer.
 */
export function calcularLayout(entrada: EntradaLayout): ResultadoLayout {
  const { segmentos, mascara, placaMascara, modulo, espacamentoM, quantidade } = entrada;

  const referencia = segmentos[0]?.centro ?? mascara[0]?.centro;
  if (!referencia || segmentos.length === 0) {
    return {
      modulos: [],
      couberam: 0,
      solicitados: quantidade,
      capacidadeMaxima: 0,
      porSegmento: [],
    };
  }

  const plano = criarPlano(referencia);
  const raio = raioMascara(placaMascara);

  // Agrupa a máscara por segmento uma vez só, em vez de filtrar por segmento
  // dentro do laço — em telhados grandes a máscara passa de mil pontos.
  const porSegmento = new Map<number, Array<{ x: number; y: number }>>();
  for (const p of mascara) {
    const lista = porSegmento.get(p.segmentoIndice);
    const xy = paraMetros(plano, p.centro);
    if (lista) lista.push(xy);
    else porSegmento.set(p.segmentoIndice, [xy]);
  }

  // Melhor insolação primeiro; área desempata. É a ordem em que um projetista
  // preencheria o telhado — a água mais ensolarada rende mais por módulo.
  const ordenados = [...segmentos].sort(
    (a, b) => b.insolacaoMediaKwh - a.insolacaoMediaKwh || b.areaM2 - a.areaM2,
  );

  const porSegmentoResultado: ResultadoLayout['porSegmento'] = [];
  const escolhidos: ModuloPosicionado[] = [];
  let capacidadeMaxima = 0;

  for (const seg of ordenados) {
    const cabem = empacotarSegmento(
      plano,
      seg,
      porSegmento.get(seg.indice) ?? [],
      modulo,
      espacamentoM,
      raio,
    );
    capacidadeMaxima += cabem.length;

    const faltam = quantidade - escolhidos.length;
    if (faltam > 0 && cabem.length > 0) {
      const usados = cabem.slice(0, faltam);
      escolhidos.push(...usados);
      porSegmentoResultado.push({
        segmento: seg.indice,
        modulos: usados.length,
        azimuteGraus: seg.azimuteGraus,
      });
    }
  }

  return {
    modulos: escolhidos,
    couberam: escolhidos.length,
    solicitados: quantidade,
    capacidadeMaxima,
    porSegmento: porSegmentoResultado,
  };
}

/* ================================================ PROJEÇÃO PARA A TELA == */
//
// O Static Maps entrega um recorte de Web Mercator. Reproduzir a mesma
// projeção aqui é o que permite desenhar os módulos por cima da imagem em
// SVG, em vez de pedir ao Google que os desenhe — o `path=` do Static Maps
// estoura o limite de URL já na casa das duas dezenas de placas, e o
// resultado viria rasterizado, o que fica ruim no papel.

/** Lado do mundo em pixels no zoom 0. Constante do Google Maps. */
const TILE_PX = 256;

function mundoX(longitude: number, escala: number): number {
  return ((longitude + 180) / 360) * escala;
}

function mundoY(latitude: number, escala: number): number {
  const sen = Math.sin((latitude * Math.PI) / 180);
  // Clamp: nos polos o log diverge. Irrelevante para telhados, mas evita
  // Infinity virar NaN silencioso no SVG se a coordenada vier corrompida.
  const limitado = Math.min(Math.max(sen, -0.9999), 0.9999);
  return (0.5 - Math.log((1 + limitado) / (1 - limitado)) / (4 * Math.PI)) * escala;
}

export interface Enquadramento {
  centro: Coordenada;
  zoom: number;
  larguraPx: number;
  alturaPx: number;
}

/** Converte uma coordenada no pixel correspondente da imagem enquadrada. */
export function projetar(e: Enquadramento, c: Coordenada): { x: number; y: number } {
  const escala = TILE_PX * Math.pow(2, e.zoom);
  return {
    x: e.larguraPx / 2 + (mundoX(c.longitude, escala) - mundoX(e.centro.longitude, escala)),
    y: e.alturaPx / 2 + (mundoY(c.latitude, escala) - mundoY(e.centro.latitude, escala)),
  };
}

/** Zoom máximo com cobertura de satélite consistente no Static Maps. */
const ZOOM_MAX = 21;
/** Abaixo disto a figura fica pequena demais para o papel. */
const LADO_MINIMO_PX = 260;

/**
 * Escolhe centro, zoom e TAMANHO do quadro para os módulos preencherem a figura.
 *
 * O tamanho sai calculado em vez de fixo em `maxPx` porque o zoom do Static
 * Maps é inteiro: num arranjo de 12 módulos já estamos no zoom máximo, e pedir
 * sempre 640x640 deixaria o telhado como uma manchinha no meio de um quarteirão.
 * Recortando o quadro no tamanho necessário, o arranjo ocupa a figura.
 *
 * O quadro sai quadrado — o componente e o proxy assumem proporção 1:1.
 */
export function enquadrar(
  modulos: ModuloPosicionado[],
  maxPx = 640,
  margem = 1.5,
): Enquadramento {
  const pontos = modulos.flatMap((m) => m.cantos);
  if (pontos.length === 0) {
    return { centro: { latitude: 0, longitude: 0 }, zoom: 20, larguraPx: maxPx, alturaPx: maxPx };
  }

  const lats = pontos.map((p) => p.latitude);
  const lngs = pontos.map((p) => p.longitude);
  const centro: Coordenada = {
    latitude: (Math.min(...lats) + Math.max(...lats)) / 2,
    longitude: (Math.min(...lngs) + Math.max(...lngs)) / 2,
  };

  const ladoNecessario = (zoom: number): number => {
    const escala = TILE_PX * Math.pow(2, zoom);
    const largura = Math.abs(mundoX(Math.max(...lngs), escala) - mundoX(Math.min(...lngs), escala));
    const altura = Math.abs(mundoY(Math.max(...lats), escala) - mundoY(Math.min(...lats), escala));
    return Math.max(largura, altura) * margem;
  };

  // Zoom mais fechado que ainda caiba no limite do Static Maps.
  for (let zoom = ZOOM_MAX; zoom >= 16; zoom--) {
    const lado = ladoNecessario(zoom);
    if (lado <= maxPx) {
      const px = Math.round(Math.min(maxPx, Math.max(LADO_MINIMO_PX, lado)));
      return { centro, zoom, larguraPx: px, alturaPx: px };
    }
  }
  // Arranjo grande demais até no zoom 16: usa o quadro inteiro e aceita a folga.
  return { centro, zoom: 16, larguraPx: maxPx, alturaPx: maxPx };
}

/** Pontos cardeais em português, na ordem dos octantes a partir do norte. */
const ROSA = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO'] as const;

/**
 * Azimute em graus -> ponto cardeal.
 *
 * Vai na proposta impressa porque "Norte" diz ao cliente o que "338°" não diz.
 * No hemisfério sul a água voltada para o norte é a que mais rende, e é essa a
 * leitura que ele precisa fazer da tabela.
 */
export function rosaDosVentos(azimuteGraus: number): string {
  const normalizado = ((azimuteGraus % 360) + 360) % 360;
  return ROSA[Math.round(normalizado / 45) % 8]!;
}
