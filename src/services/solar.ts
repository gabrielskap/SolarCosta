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
 * Data em que o Google fotografou o telhado PARA A ANÁLISE.
 *
 * Cuidado com a redação: a foto exibida atrás dos módulos vem do Maps Static e
 * é atual, enquanto a análise de águas e área usa uma imagem própria, que
 * costuma ter anos (a da sede é de 2014). São duas imagens diferentes, e
 * escrever "imagem de 2014" sobre uma foto de hoje rotula errado o que o
 * cliente está vendo. O texto fala da ANÁLISE, não da foto.
 */
export function descreverImagem(t: TelhadoSolar): string {
  if (!t.imagemData) return 'Data da análise não informada pelo Google.';
  const { ano, mes, dia } = t.imagemData;
  const d = String(dia).padStart(2, '0');
  const m = String(mes).padStart(2, '0');
  return `Análise do telhado baseada em imagem de ${d}/${m}/${ano}`;
}

/** Quantos anos tem a imagem — acima de ~3 a UI avisa o consultor. */
export function idadeImagemAnos(t: TelhadoSolar): number | null {
  if (!t.imagemData) return null;
  const foto = new Date(t.imagemData.ano, t.imagemData.mes - 1, t.imagemData.dia);
  return (Date.now() - foto.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
}

export interface ResultadoImagem extends Resultado {
  /** Object URL, presente quando ok = true. */
  url?: string;
}

/**
 * Baixa o recorte de satélite e devolve um object URL para usar em <img>.
 *
 * Quem chamar precisa liberar com URL.revokeObjectURL quando trocar de
 * imagem ou desmontar — object URL não é coletado sozinho enquanto a aba viver.
 */
export async function imagemTelhado(
  latitude: number,
  longitude: number,
  zoom: number,
  largura = 640,
  altura = 640,
): Promise<ResultadoImagem> {
  try {
    const blob = await http.getBlob(
      `/api/solar/imagem?lat=${latitude}&lng=${longitude}&zoom=${zoom}` +
        `&largura=${largura}&altura=${altura}`,
    );
    return { ok: true, url: URL.createObjectURL(blob) };
  } catch (e) {
    return mensagemDe(e, 'Não foi possível carregar a imagem de satélite.');
  }
}
