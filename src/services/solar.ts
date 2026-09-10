// Camada de integração: endereço -> telhado por satélite.
//
// Segue a mesma convenção de services/cep.ts: nunca lança, sempre resolve com
// um { ok, ... , erro? }, para a UI tratar tudo num `if` só.
//
// As chamadas vão para a nossa API, não direto para o Google: a chave do
// Geocoding/Solar é restrita por IP da VPS e não pode ir para o bundle.

import { ErroApi, http } from './http';

export type PrecisaoGeocoding =
  | 'ROOFTOP'
  | 'RANGE_INTERPOLATED'
  | 'GEOMETRIC_CENTER'
  | 'APPROXIMATE';

export interface Coordenada {
  latitude: number;
  longitude: number;
}

export interface EnderecoGeocodificado {
  latitude: number;
  longitude: number;
  precisao: PrecisaoGeocoding;
  confiavel: boolean;
  enderecoFormatado: string;
  placeId: string;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
}

export interface SegmentoTelhado {
  indice: number;
  azimuteGraus: number;
  inclinacaoGraus: number;
  areaM2: number;
  centro: Coordenada;
  insolacaoMediaKwh: number;
}

export interface TelhadoSolar {
  edificacaoId: string;
  centro: Coordenada;
  imagemData: { ano: number; mes: number; dia: number } | null;
  imagemProcessadaData?: { ano: number; mes: number; dia: number } | null;
  imagemQualidade: string | null;
  areaTelhadoM2: number;
  areaMaxArranjoM2: number;
  segmentos: SegmentoTelhado[];
  placasGoogle: Array<{
    centro: Coordenada;
    orientacao: 'LANDSCAPE' | 'PORTRAIT';
    segmentoIndice: number;
  }>;
  placaGoogle: { potenciaWp: number; alturaM: number; larguraM: number };
}

/**
 * Base do retorno das quatro funções, no mesmo formato de services/cep.ts:
 * interface única com campos opcionais em vez de união discriminada.
 *
 * Não é preferência de estilo — o tsconfig do front roda sem `strict`, e sem
 * strictNullChecks o estreitamento por `if (!r.ok)` não elimina o outro braço
 * de uma união, então `r.erro` não compilaria no ramo de falha.
 */
interface Resultado {
  ok: boolean;
  erro?: string;
  /** Código da API, quando houver — deixa a UI reagir sem comparar texto. */
  codigo?: string;
}

/**
 * Traduz a exceção do cliente HTTP no formato { ok: false }.
 *
 * O `requisitar` já joga a mensagem do servidor dentro do ErroApi, então as
 * mensagens de negócio (endereço não localizado, telhado sem dados) chegam
 * prontas em português — não vale reescrevê-las aqui.
 */
function mensagemDe(e: unknown, padrao: string): Resultado {
  if (e instanceof ErroApi) {
    return { ok: false, erro: e.message || padrao, codigo: e.codigo };
  }
  return { ok: false, erro: padrao };
}

export interface ResultadoGeocoding extends Resultado {
  /** Presente quando ok = true. */
  endereco?: EnderecoGeocodificado;
}

/** Endereço em texto -> coordenada. */
export async function geocodificar(endereco: string): Promise<ResultadoGeocoding> {
  const limpo = endereco.trim();
  if (limpo.length < 3) {
    return { ok: false, erro: 'Informe o endereço da instalação antes de buscar no mapa.' };
  }
  try {
    const r = await http.get<{ endereco: EnderecoGeocodificado }>(
      `/api/solar/geocodificar?endereco=${encodeURIComponent(limpo)}`,
    );
    return { ok: true, endereco: r.endereco };
  } catch (e) {
    return mensagemDe(e, 'Não foi possível localizar o endereço no mapa.');
  }
}

export interface ResultadoTelhado extends Resultado {
  /** Presente quando ok = true. */
  telhado?: TelhadoSolar;
}

/** Coordenada -> análise de telhado do Google. */
export async function buscarTelhado(
  latitude: number,
  longitude: number,
): Promise<ResultadoTelhado> {
  try {
    const r = await http.get<{ telhado: TelhadoSolar }>(
      `/api/solar/telhado?lat=${latitude}&lng=${longitude}`,
    );
    return { ok: true, telhado: r.telhado };
  } catch (e) {
    return mensagemDe(e, 'Não foi possível analisar o telhado neste ponto.');
  }
}

/**
 * Retorna a data mais recente disponível (data de processamento mais atual do Google Solar,
 * ou data da imagem de referência).
 */
export function dataMaisRecente(t: TelhadoSolar): { ano: number; mes: number; dia: number } | null {
  return t.imagemProcessadaData || t.imagemData;
}

/**
 * Legenda profissional para o quadro de satélite, destacando a foto atual em alta resolução.
 */
export function legendaSatelite(t?: TelhadoSolar | null): string {
  const data = t ? (t.imagemProcessadaData || t.imagemData) : null;
  const ano = data ? data.ano : new Date().getFullYear();
  return `Satélite em alta resolução • Google Maps (${ano})`;
}

/**
 * Descreve a data da análise solar do Google.
 */
export function descreverImagem(t: TelhadoSolar): string {
  const data = dataMaisRecente(t);
  if (!data) return 'Análise solar Google atualizada.';
  const { ano, mes, dia } = data;
  const d = String(dia).padStart(2, '0');
  const m = String(mes).padStart(2, '0');
  if (t.imagemProcessadaData) {
    return `Análise do telhado atualizada em ${d}/${m}/${ano}`;
  }
  return `Análise do telhado baseada em levantamento de ${d}/${m}/${ano}`;
}

/** Quantos anos tem a análise — calculado pela data mais recente de processamento. */
export function idadeImagemAnos(t: TelhadoSolar): number | null {
  const data = dataMaisRecente(t);
  if (!data) return null;
  const foto = new Date(data.ano, data.mes - 1, data.dia);
  return (Date.now() - foto.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

export interface ResultadoImagem extends Resultado {
  /** Object URL, presente quando ok = true. */
  url?: string;
}

/**
 * Baixa o recorte de satélite em alta resolução e devolve um object URL para usar em <img>.
 *
 * Quem chamar precisa liberar com URL.revokeObjectURL quando trocar de
 * imagem ou desmontar — object URL não é coletado sozinho enquanto a aba viver.
 */
export async function imagemTelhado(
  latitude: number,
  longitude: number,
  zoom = 20,
  largura = 640,
  altura = 640,
): Promise<ResultadoImagem> {
  try {
    const z = Math.min(20, Math.max(16, Math.round(zoom)));
    const blob = await http.getBlob(
      `/api/solar/imagem?lat=${latitude}&lng=${longitude}&zoom=${z}` +
        `&largura=${largura}&altura=${altura}`,
    );
    return { ok: true, url: URL.createObjectURL(blob) };
  } catch (e) {
    return mensagemDe(e, 'Não foi possível carregar a imagem de satélite.');
  }
}
