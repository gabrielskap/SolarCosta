// Operações de edição manual do layout de módulos.
//
// Por que existe: o empacotamento automático (layoutModulos.ts) parte das
// placas que o Google devolve como máscara de área útil. É um bom palpite e
// erra de formas previsíveis — azimute da cumeeira alguns graus fora,
// puxadinho contado como telhado, laje boa ignorada porque a foto é de antes
// da obra. Quem sabe o que tem no telhado é o consultor que foi lá. Estas
// funções são as ferramentas que ele usa para corrigir.
//
// Tudo aqui é PURO: recebe um array de módulos, devolve outro. Nada de
// `google.maps`, nada de estado. O editor (EditorTelhado.tsx) cuida do mapa e
// dos cliques; a geometria mora aqui, testável e reutilizável na impressão.
//
// Regra que orienta o arquivo inteiro: uma placa posicionada à mão precisa ser
// indistinguível de uma posicionada pelo algoritmo. Por isso a geometria sai
// sempre de `criarModulo`, e o encaixe usa a MESMA malha do empacotamento —
// meio passo de diferença e as fileiras ajustadas sairiam tortas em relação às
// automáticas, justamente no documento que o cliente compara.

import { ModuloLayout } from '../types';
import {
  criarModulo,
  criarPlano,
  malhaSegmento,
  paraMetros,
  raioMascara,
  rotacaoSegmento,
  type Coordenada,
  type DimensoesModulo,
  type MalhaSegmento,
  type Plano,
  type SegmentoEntrada,
} from './layoutModulos';

/** Ponto da máscara do Google: centro de uma placa dele, com a água a que pertence. */
export interface PontoMascara {
  centro: Coordenada;
  segmentoIndice: number;
}

/**
 * Tudo que as operações precisam saber sobre o telhado, montado uma vez quando
 * o editor abre.
 *
 * A FASE da malha (`fases`) é o detalhe que faz a diferença: é o deslocamento
 * da grade automática dentro de cada água. Fica congelada na abertura, e não
 * recalculada a cada arrasto, porque uma fase que se move junto com as placas
 * faria a grade escorregar aos poucos — cada encaixe validando o erro do
 * anterior.
 */
export interface ContextoEdicao {
  plano: Plano;
  segmentos: SegmentoEntrada[];
  mascara: PontoMascara[];
  modulo: DimensoesModulo;
  espacamentoM: number;
  /** Raio de tolerância da máscara, igual ao do empacotamento. */
  raio: number;
  /** Fase da grade por índice de segmento. */
  fases: Map<number, { u: number; v: number }>;
  /** Ordem de preenchimento: mais ensolarado primeiro, área desempata. */
  ordem: number[];
}

/** Segmento pelo índice, ou o primeiro como último recurso. */
function segmentoPor(ctx: ContextoEdicao, indice: number): SegmentoEntrada | undefined {
  return ctx.segmentos.find((s) => s.indice === indice) ?? ctx.segmentos[0];
}

/** Azimute em [0, 360). Guardar 450° faria a rosa dos ventos e a tela lerem torto. */
export function normalizarAzimute(graus: number): number {
  return ((graus % 360) + 360) % 360;
}

/**
 * Desvio angular em (-180, 180].
 *
 * É a forma de medir giro que faz sentido para quem ajusta: girar 350° é, na
 * prática, girar 10° para o outro lado, e mostrar "350°" no controle faria o
 * consultor procurar o caminho longo.
 */
export function normalizarDesvio(graus: number): number {
  const r = ((((graus + 180) % 360) + 360) % 360) - 180;
  return r === -180 ? 180 : r;
}

/**
 * Segmentos com o azimute que as placas REALMENTE têm.
 *
 * O ângulo do Google é só o palpite de partida. Assim que uma água é girada no
 * editor, quem manda na orientação passa a ser a placa que está na tela — e
 * todo o resto (malha de encaixe, arrasto, placa acrescentada depois, giro
 * seguinte) precisa enxergar esse ângulo, não o antigo. Sem esta troca, girar
 * uma água 90° e arrastar uma placa em seguida devolvia a placa à orientação
 * original: ela "desvirava" sozinha no meio das outras.
 */
export function segmentosOrientados<T extends { indice: number; azimuteGraus: number }>(
  segmentos: T[],
  modulos: ModuloLayout[],
): T[] {
  if (modulos.length === 0) return segmentos;
  return segmentos.map((s) => {
    const m = modulos.find((x) => x.segmento === s.indice);
    return !m || m.azimuteGraus === s.azimuteGraus ? s : { ...s, azimuteGraus: m.azimuteGraus };
  });
}

/**
 * Quanto uma água já foi girada em relação ao que o Google mediu, em
 * (-180, 180].
 *
 * O controle de giro precisa disto para ser absoluto: reabrir o editor, ou
 * clicar de novo numa placa de uma água já girada, tem que mostrar +90° e não
 * zero — senão o consultor não sabe de onde está partindo.
 */
export function giroAplicado(
  segmentos: Array<{ indice: number; azimuteGraus: number }>,
  modulos: ModuloLayout[],
  segIndice: number,
): number {
  const m = modulos.find((x) => x.segmento === segIndice);
  const s = segmentos.find((x) => x.indice === segIndice);
  if (!m || !s) return 0;
  return normalizarDesvio(m.azimuteGraus - s.azimuteGraus);
}

/** Malha de uma água, já com a fase congelada do contexto. */
export function malhaDe(ctx: ContextoEdicao, segIndice: number): MalhaSegmento {
  return malhaSegmento(ctx.modulo, ctx.espacamentoM, ctx.fases.get(segIndice) ?? { u: 0, v: 0 });
}

/** Centro de um módulo em (u,v) da sua água. */
export function centroUV(ctx: ContextoEdicao, m: ModuloLayout): { u: number; v: number } {
  const seg = segmentoPor(ctx, m.segmento);
  const rot = rotacaoSegmento(seg?.azimuteGraus ?? m.azimuteGraus);
  return rot.paraUV(paraMetros(ctx.plano, m.centro));
}

/**
 * Monta o contexto a partir da análise do Google e do layout que está na tela.
 *
 * A fase de cada água sai, de preferência, do centro de um módulo já
 * posicionado ali — é o alinhamento que o consultor está vendo, então encaixar
 * nele é o que não move nada de lugar. Sem módulos naquela água, cai para o
 * mesmo cálculo do empacotamento (grade centrada na máscara), para que a
 * primeira placa adicionada já nasça onde o automático a colocaria.
 *
 * O azimute também vem das placas quando elas existem (ver
 * `segmentosOrientados`): numa água girada à mão, a malha tem que acompanhar o
 * giro, senão o encaixe empurra as placas de volta para a grade antiga.
 */
export function criarContexto(entrada: {
  segmentos: SegmentoEntrada[];
  mascara: PontoMascara[];
  placaMascara: DimensoesModulo;
  modulo: DimensoesModulo;
  espacamentoM: number;
  modulos: ModuloLayout[];
}): ContextoEdicao {
  const { mascara, placaMascara, modulo, espacamentoM, modulos } = entrada;
  const segmentos = segmentosOrientados(entrada.segmentos, modulos);
  const referencia = segmentos[0]?.centro ?? mascara[0]?.centro ?? { latitude: 0, longitude: 0 };
  const plano = criarPlano(referencia);
  const raio = raioMascara(placaMascara);

  const fases = new Map<number, { u: number; v: number }>();
  for (const seg of segmentos) {
    const rot = rotacaoSegmento(seg.azimuteGraus);

    const jaPosicionado = modulos.find((m) => m.segmento === seg.indice);
    if (jaPosicionado) {
      fases.set(seg.indice, rot.paraUV(paraMetros(plano, jaPosicionado.centro)));
      continue;
    }

    // Sem módulos nesta água: repete a conta de empacotarSegmento — grade
    // centrada na máscara, sobra dividida entre as duas bordas.
    const pontos = mascara
      .filter((p) => p.segmentoIndice === seg.indice)
      .map((p) => rot.paraUV(paraMetros(plano, p.centro)));
    if (pontos.length === 0) {
      fases.set(seg.indice, { u: 0, v: 0 });
      continue;
    }
    const us = pontos.map((p) => p.u);
    const vs = pontos.map((p) => p.v);
    const uMin = Math.min(...us) - raio;
    const uMax = Math.max(...us) + raio;
    const vMin = Math.min(...vs) - raio;
    const vMax = Math.max(...vs) + raio;
    const passoU = modulo.larguraM + espacamentoM;
    const passoV = modulo.alturaM + espacamentoM;
    const colunas = Math.floor((uMax - uMin + espacamentoM) / passoU);
    const linhas = Math.floor((vMax - vMin + espacamentoM) / passoV);
    const sobraU = uMax - uMin - (colunas * passoU - espacamentoM);
    const sobraV = vMax - vMin - (linhas * passoV - espacamentoM);
    fases.set(seg.indice, {
      u: uMin + sobraU / 2 + modulo.larguraM / 2,
      v: vMin + sobraV / 2 + modulo.alturaM / 2,
    });
  }

  const ordem = [...segmentos]
    .sort((a, b) => b.insolacaoMediaKwh - a.insolacaoMediaKwh || b.areaM2 - a.areaM2)
    .map((s) => s.indice);

  return { plano, segmentos, mascara, modulo, espacamentoM, raio, fases, ordem };
}

/* ============================================================== COLISÃO == */

/**
 * Duas placas ocupam o mesmo lugar?
 *
 * Retângulos girados no mesmo azimute compartilham os eixos, então basta
 * comparar a separação em u e v — não precisa de SAT. A folga de 1 mm evita
 * que duas placas vizinhas legítimas, encostadas pelo espaçamento, contem como
 * sobreposição por erro de ponto flutuante.
 */
export function sobrepoe(ctx: ContextoEdicao, a: ModuloLayout, b: ModuloLayout): boolean {
  if (a.segmento !== b.segmento) return false;
  const ca = centroUV(ctx, a);
  const cb = centroUV(ctx, b);
  const folga = 0.001;
  return (
    Math.abs(ca.u - cb.u) < ctx.modulo.larguraM - folga &&
    Math.abs(ca.v - cb.v) < ctx.modulo.alturaM - folga
  );
}

/** Alguma placa da lista já ocupa esse lugar? `ignorar` pula a que está sendo movida. */
function ocupado(
  ctx: ContextoEdicao,
  modulos: ModuloLayout[],
  candidato: ModuloLayout,
  ignorar = -1,
): boolean {
  return modulos.some((m, i) => i !== ignorar && sobrepoe(ctx, m, candidato));
}

/* ============================================================= CONSULTA == */

/**
 * Qual água está sob este ponto.
 *
 * Decide pelo ponto de máscara mais próximo, não pelo centro do segmento: numa
 * casa em L o centro geométrico de uma água pode cair sobre a outra, e o
 * clique iria para o telhado errado. Fora do alcance da máscara — uma laje que
 * o Google não mapeou — cai para o centro de segmento mais próximo, que é o
 * palpite razoável quando não há informação melhor.
 */
export function segmentoDoPonto(ctx: ContextoEdicao, ponto: Coordenada): number {
  const alvo = paraMetros(ctx.plano, ponto);
  let melhor = -1;
  let menor = Infinity;

  for (const p of ctx.mascara) {
    const q = paraMetros(ctx.plano, p.centro);
    const d = Math.hypot(q.x - alvo.x, q.y - alvo.y);
    if (d < menor) {
      menor = d;
      melhor = p.segmentoIndice;
    }
  }
  if (melhor >= 0 && menor <= ctx.raio * 2) return melhor;

  for (const seg of ctx.segmentos) {
    const q = paraMetros(ctx.plano, seg.centro);
    const d = Math.hypot(q.x - alvo.x, q.y - alvo.y);
    if (d < menor) {
      menor = d;
      melhor = seg.indice;
    }
  }
  return melhor >= 0 ? melhor : ctx.segmentos[0]?.indice ?? 0;
}

/** O ponto cai sobre área que o Google considerou aproveitável? */
export function dentroDaMascara(ctx: ContextoEdicao, ponto: Coordenada): boolean {
  const alvo = paraMetros(ctx.plano, ponto);
  return ctx.mascara.some((p) => {
    const q = paraMetros(ctx.plano, p.centro);
    return Math.hypot(q.x - alvo.x, q.y - alvo.y) <= ctx.raio;
  });
}

/* ============================================================ OPERAÇÕES == */

/**
 * Move uma placa para um novo centro.
 *
 * Por padrão encaixa na malha da água, que é o comportamento útil em quase
 * todo arrasto: mantém as fileiras alinhadas sem exigir pontaria. `livre`
 * (Alt, no editor) desliga o encaixe para os casos que a grade não prevê —
 * contornar um exaustor, respeitar um afastamento de norma.
 *
 * Devolve o array original quando o destino está ocupado: recusar é melhor do
 * que empilhar duas placas no mesmo lugar e dar uma contagem que não existe no
 * telhado.
 */
export function moverModulo(
  ctx: ContextoEdicao,
  modulos: ModuloLayout[],
  indice: number,
  destino: Coordenada,
  opcoes: { livre?: boolean } = {},
): ModuloLayout[] {
  const alvo = modulos[indice];
  if (!alvo) return modulos;
  const seg = segmentoPor(ctx, alvo.segmento);
  if (!seg) return modulos;

  const rot = rotacaoSegmento(seg.azimuteGraus);
  const bruto = rot.paraUV(paraMetros(ctx.plano, destino));
  const { u, v } = opcoes.livre ? bruto : malhaDe(ctx, seg.indice).encaixar(bruto.u, bruto.v);

  const novo = criarModulo(ctx.plano, seg, u, v, ctx.modulo, rot);
  if (ocupado(ctx, modulos, novo, indice)) return modulos;

  const copia = [...modulos];
  copia[indice] = novo;
  return copia;
}

/**
 * Acrescenta uma placa na célula sob o ponto.
 *
 * Não recusa fora da máscara de propósito: adicionar onde o Google não viu
 * telhado é exatamente o caso de uso — a laje nova, o anexo que não estava na
 * foto. O editor sinaliza visualmente que está fora da área analisada; a
 * decisão é do consultor.
 */
export function adicionarModulo(
  ctx: ContextoEdicao,
  modulos: ModuloLayout[],
  ponto: Coordenada,
  segIndice = segmentoDoPonto(ctx, ponto),
): ModuloLayout[] {
  const seg = segmentoPor(ctx, segIndice);
  if (!seg) return modulos;

  const rot = rotacaoSegmento(seg.azimuteGraus);
  const bruto = rot.paraUV(paraMetros(ctx.plano, ponto));
  const { u, v } = malhaDe(ctx, seg.indice).encaixar(bruto.u, bruto.v);

  const novo = criarModulo(ctx.plano, seg, u, v, ctx.modulo, rot);
  if (ocupado(ctx, modulos, novo)) return modulos;
  return [...modulos, novo];
}

/** Remove pelo índice. */
export function removerModulo(modulos: ModuloLayout[], indice: number): ModuloLayout[] {
  if (indice < 0 || indice >= modulos.length) return modulos;
  return modulos.filter((_, i) => i !== indice);
}

/**
 * Gira o arranjo de uma água, em qualquer ângulo da volta completa.
 *
 * Nasceu do desvio fino: o azimute do Google vem do modelo de elevação, e num
 * telhado pequeno ou de beiral largo ele sai alguns graus fora da cumeeira que
 * aparece na foto. As placas ficam visivelmente tortas em relação às telhas, e
 * é a primeira coisa que o cliente nota na proposta impressa.
 *
 * Mas o giro grande também é de uso legítimo, e por isso não há trava de
 * ângulo aqui: 90° deita ou levanta a placa (paisagem ↔ retrato, mudando a
 * direção das fileiras), e volta maior serve quando o Google apontou a água
 * para o lado errado.
 *
 * Gira em torno do CENTRO DO ARRANJO, não do centro da água: um pivô fora do
 * bloco o arremessaria para longe, e o consultor teria que reposicionar tudo
 * depois de cada ajuste de meio grau.
 */
export function girarSegmento(
  ctx: ContextoEdicao,
  modulos: ModuloLayout[],
  segIndice: number,
  deltaGraus: number,
): ModuloLayout[] {
  if (deltaGraus === 0) return modulos;

  const doSegmento = modulos.filter((m) => m.segmento === segIndice);
  if (doSegmento.length === 0) return modulos;

  const centros = doSegmento.map((m) => paraMetros(ctx.plano, m.centro));
  const pivo = {
    x: centros.reduce((t, c) => t + c.x, 0) / centros.length,
    y: centros.reduce((t, c) => t + c.y, 0) / centros.length,
  };

  // O giro parte do ângulo que as placas TÊM, não do que o Google mediu: é o
  // que faz dois ajustes seguidos somarem (30° e depois 60° dão 90°). Partindo
  // do azimute do Google, o segundo ajuste girava os centros e devolvia a
  // placa à orientação do primeiro — bloco torto em relação a si mesmo.
  const novoAzimute = normalizarAzimute(doSegmento[0]!.azimuteGraus + deltaGraus);
  const rotNova = rotacaoSegmento(novoAzimute);
  const ang = (-deltaGraus * Math.PI) / 180;
  const cos = Math.cos(ang);
  const sen = Math.sin(ang);

  return modulos.map((m) => {
    if (m.segmento !== segIndice) return m;
    const c = paraMetros(ctx.plano, m.centro);
    const dx = c.x - pivo.x;
    const dy = c.y - pivo.y;
    const girado = { x: pivo.x + dx * cos - dy * sen, y: pivo.y + dx * sen + dy * cos };
    const uv = rotNova.paraUV(girado);
    return criarModulo(
      ctx.plano,
      { indice: segIndice, azimuteGraus: novoAzimute },
      uv.u,
      uv.v,
      ctx.modulo,
      rotNova,
    );
  });
}

/**
 * Translada o arranjo inteiro de uma água, em metros no plano local.
 *
 * Para o caso comum de o bloco todo estar deslocado — a máscara do Google
 * puxada para um lado pela sombra da árvore vizinha. Sem encaixe: o
 * deslocamento é do bloco, e as placas continuam alinhadas entre si.
 */
export function moverArranjo(
  ctx: ContextoEdicao,
  modulos: ModuloLayout[],
  segIndice: number,
  delta: { x: number; y: number },
): ModuloLayout[] {
  if (delta.x === 0 && delta.y === 0) return modulos;
  const seg = segmentoPor(ctx, segIndice);
  if (!seg) return modulos;
  const rot = rotacaoSegmento(seg.azimuteGraus);

  return modulos.map((m) => {
    if (m.segmento !== segIndice) return m;
    const c = paraMetros(ctx.plano, m.centro);
    const uv = rot.paraUV({ x: c.x + delta.x, y: c.y + delta.y });
    return criarModulo(ctx.plano, seg, uv.u, uv.v, ctx.modulo, rot);
  });
}

/**
 * Reconstrói as placas com outra dimensão física, mantendo cada centro.
 *
 * Serve para quando o kit fecha com um módulo diferente do cadastrado nos
 * parâmetros — 550 Wp em vez de 710 Wp, por exemplo. Mantém o centro em vez de
 * re-empacotar para não jogar fora o posicionamento que o consultor já
 * aprovou; se as placas maiores passarem a se sobrepor, quem avisa é o editor.
 */
export function redimensionarModulos(
  ctx: ContextoEdicao,
  modulos: ModuloLayout[],
  novo: DimensoesModulo,
): ModuloLayout[] {
  return modulos.map((m) => {
    const seg = segmentoPor(ctx, m.segmento) ?? {
      indice: m.segmento,
      azimuteGraus: m.azimuteGraus,
    };
    const rot = rotacaoSegmento(seg.azimuteGraus);
    const uv = rot.paraUV(paraMetros(ctx.plano, m.centro));
    return criarModulo(ctx.plano, seg, uv.u, uv.v, novo, rot);
  });
}

/** Quantas placas em cada água, na ordem de preenchimento. */
export function contarPorSegmento(
  ctx: ContextoEdicao,
  modulos: ModuloLayout[],
): Array<{ segmento: number; modulos: number; azimuteGraus: number }> {
  return ctx.ordem
    .map((indice) => {
      const doSegmento = modulos.filter((m) => m.segmento === indice);
      return {
        segmento: indice,
        modulos: doSegmento.length,
        // Ângulo da placa, não o do contexto: durante o giro o contexto ainda
        // é o do último ajuste confirmado, e a rosa dos ventos do painel tem
        // que bater com o que está desenhado no mapa.
        azimuteGraus: doSegmento[0]?.azimuteGraus ?? segmentoPor(ctx, indice)?.azimuteGraus ?? 0,
      };
    })
    .filter((s) => s.modulos > 0);
}

/**
 * Acerta a contagem depois que o kit mudou de tamanho, SEM mexer no que foi
 * posicionado à mão.
 *
 * É a regra escolhida para o conflito entre as duas fontes de verdade: o
 * dimensionamento manda na QUANTIDADE, o consultor manda na POSIÇÃO. Antes, um
 * ajuste manual seria apagado inteiro no instante em que alguém corrigisse o
 * consumo em um kWh — trabalho perdido sem aviso.
 *
 * Cresceu: preenche com as vagas do empacotamento automático que não colidam
 * com o que já está lá, na mesma ordem de insolação que `calcularLayout` usa.
 * Diminuiu: tira das águas menos ensolaradas primeiro, o inverso da ordem de
 * preenchimento — é a placa que menos rende, a que um projetista cortaria.
 */
export function ajustarQuantidade(
  ctx: ContextoEdicao,
  manuais: ModuloLayout[],
  candidatos: ModuloLayout[],
  novaQtd: number,
): ModuloLayout[] {
  if (novaQtd === manuais.length) return manuais;

  if (novaQtd > manuais.length) {
    const resultado = [...manuais];
    const porOrdem = [...candidatos].sort(
      (a, b) => ctx.ordem.indexOf(a.segmento) - ctx.ordem.indexOf(b.segmento),
    );
    for (const c of porOrdem) {
      if (resultado.length >= novaQtd) break;
      if (!ocupado(ctx, resultado, c)) resultado.push(c);
    }
    return resultado;
  }

  // Ordena por "descartabilidade": água menos ensolarada primeiro e, dentro
  // dela, as últimas colocadas. Depois corta o excedente do começo da lista.
  const ranqueados = manuais.map((m, i) => ({ m, i }));
  ranqueados.sort((a, b) => {
    const pa = ctx.ordem.indexOf(a.m.segmento);
    const pb = ctx.ordem.indexOf(b.m.segmento);
    if (pa !== pb) return pb - pa;
    return b.i - a.i;
  });
  const remover = new Set(ranqueados.slice(0, manuais.length - novaQtd).map((r) => r.i));
  return manuais.filter((_, i) => !remover.has(i));
}
