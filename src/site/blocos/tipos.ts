// Formato do conteúdo do site — compartilhado pelo site público, pela tela de
// administração e pelo gerador do seed da migration V008.
//
// Nada aqui importa React: é dado puro, do mesmo formato que trafega em
// /api/publico/site e que fica em SolarCosta_SiteBlocos.conteudo (jsonb).
// Isso é o que permite `conteudoPadrao.ts` ser, ao mesmo tempo, o fallback do
// site e a origem do INSERT inicial no banco.

/** Tipos de bloco conhecidos pelo código. O banco guarda a string crua. */
export const TIPOS_BLOCO = [
  'heroi',
  'selos',
  'cabecalho_pagina',
  'cards_servicos',
  'passos',
  'faq',
  'cta',
  'lista_itens',
  'banner_conversao',
  'dados_empresa',
  'contato_canais',
  'simulador',
  'texto_rico',
  'galeria',
  'video_youtube',
  'area_livre',
] as const;

export type TipoBloco = (typeof TIPOS_BLOCO)[number];

/** Paleta dos chips de ícone — mesma de ChipIcone em components/Secao.tsx. */
export type CorChip = 'blue' | 'emerald' | 'amber' | 'violet';

export interface LinkConteudo {
  rotulo: string;
  destino: string;
}

/* ------------------------------------------------------------- blocos --- */

export interface ConteudoHeroi {
  logo_legenda: string;
  titulo: string;
  titulo_destaque: string;
  subtitulo: string;
  cta_primario: LinkConteudo;
  cta_secundario: LinkConteudo;
  faixa_regiao: string;
  faixa_credencial: string;
  painel_rotulo: string;
  painel_cta: LinkConteudo;
  destaques: { titulo: string; texto: string }[];
}

/**
 * Os VALORES (CNPJ, responsável técnico, cidade) continuam saindo de
 * SolarCosta_Empresa em tempo de render — o que o admin edita aqui são os
 * rótulos e o texto de apoio. Cadastro e conteúdo editorial são coisas
 * diferentes e não podem divergir.
 */
export interface ConteudoSelos {
  rotulo: string;
  descricao: string;
  marca_legenda: string;
  itens: { icone: string; rotulo: string; nota: string; cor: string }[];
}

export interface ConteudoCabecalhoPagina {
  rotulo: string;
  titulo: string;
  descricao: string;
  icone?: string;
  /** Faixa institucional com logotipo e razão social (usada em /sobre). */
  mostrar_marca?: boolean;
}

export interface ConteudoCardsServicos {
  rotulo: string;
  titulo: string;
  descricao: string;
  centralizado: boolean;
  /** `true` exibe a lista de detalhes de cada serviço (página /servicos). */
  completo: boolean;
  claro: boolean;
  link_rodape?: LinkConteudo;
  itens: {
    id: string;
    titulo: string;
    resumo: string;
    detalhes: string[];
    icone: string;
    cor: CorChip;
  }[];
}

export interface ConteudoPassos {
  rotulo: string;
  titulo: string;
  descricao: string;
  itens: { numero: string; titulo: string; descricao: string; icone: string }[];
}

export interface ConteudoFaq {
  rotulo: string;
  titulo: string;
  descricao: string;
  claro: boolean;
  perguntas: { pergunta: string; resposta: string }[];
}

export interface ConteudoCta {
  titulo: string;
  texto: string;
  regua: string;
  botoes: LinkConteudo[];
}

export interface ConteudoListaItens {
  rotulo: string;
  titulo: string;
  descricao: string;
  claro: boolean;
  centralizado: boolean;
  colunas: 2 | 3 | 4;
  itens: { icone: string; titulo: string; texto: string; cor: CorChip }[];
}

export interface ConteudoBannerConversao {
  rotulo: string;
  titulo: string;
  texto: string;
  botao: LinkConteudo;
  formulario_titulo: string;
  formulario_descricao: string;
}

export interface ConteudoDadosEmpresa {
  rotulo_cadastro: string;
  titulo_cadastro: string;
  descricao_cadastro: string;
  rotulo_escritorio: string;
  titulo_escritorio: string;
  area_atendimento: string;
}

export interface ConteudoContatoCanais {
  formulario_titulo: string;
  formulario_descricao: string;
  mensagem_whatsapp: string;
  canais: { icone: string; rotulo: string; nota: string; cor: string; tipo: string }[];
  horario_rotulo: string;
  horario_texto: string;
}

export interface ConteudoSimulador {
  entrada_titulo: string;
  entrada_descricao: string;
  vazio_titulo: string;
  vazio_texto: string;
  economia_rotulo: string;
  nota_projecao: string;
  nota_investimento: string;
  proximo_rotulo: string;
  proximo_titulo: string;
  proximo_descricao: string;
  proximo_itens: string[];
  formulario_titulo: string;
  formulario_descricao: string;
}

export interface ConteudoTextoRico {
  rotulo: string;
  titulo: string;
  claro: boolean;
  paragrafos: string[];
  imagem_id: string | null;
  /**
   * Largura da imagem em % da coluna, arrastada na alça do editor visual.
   * Ausente = 100%, que é como o bloco sempre desenhou. Em % e não em px
   * porque a coluna muda de largura com o viewport.
   */
  imagem_largura_pct?: number | null;
}

export type TamanhoImagemGaleria = 'baixa' | 'media' | 'alta' | 'automatica';
export type PosicaoImagemGaleria = 'topo' | 'centro' | 'base';

/**
 * Limites das alças de foto. Ficam aqui, e não no componente da alça, porque
 * o bloco também precisa deles para prender o valor que vem do banco — e a
 * alça é carregada só no editor, enquanto o bloco roda no site de todo mundo.
 */
export const FOTO_ALTURA_MIN = 80;
export const FOTO_ALTURA_MAX = 900;
export const FOTO_COLUNAS_MAX = 3;

export interface ConteudoGaleria {
  rotulo: string;
  titulo: string;
  descricao: string;
  claro: boolean;
  imagens: {
    midia_id: string;
    legenda: string;
    tamanho: TamanhoImagemGaleria;
    posicao: PosicaoImagemGaleria;
    /**
     * Altura em px arrastada na alça do editor visual. Quando presente, VENCE
     * `tamanho` — escolher um tamanho no painel apaga este valor. Fica numa
     * chave própria, e não dentro do enum, para que o <select> do painel
     * continue válido e o conteúdo já salvo não precise de migração.
     */
    altura_px?: number | null;
    /**
     * Quantas colunas da grade a foto ocupa (1 a 3). Ausente = 1.
     *
     * Em COLUNAS e não em pixels porque a grade muda de formato com a tela —
     * 3 colunas no desktop, 2 no tablet, 1 no celular. "Ocupa duas colunas"
     * continua querendo dizer a mesma coisa nas três; "600px de largura", não.
     */
    largura_colunas?: number | null;
  }[];
}

export type TamanhoVideo = 'pequena' | 'media' | 'grande' | 'completa';
export type AlinhamentoVideo = 'esquerda' | 'centro' | 'direita';

export interface ConteudoVideoYoutube {
  rotulo: string;
  titulo: string;
  descricao: string;
  claro: boolean;
  url: string;
  legenda: string;
  tamanho: TamanhoVideo;
  alinhamento: AlinhamentoVideo;
}

/* ---------------------------------------------------------- área livre --- */

/**
 * Largura do canvas de projeto da área livre, em px.
 *
 * Toda a geometria dos elementos é guardada em px DESTE canvas, e no desktop o
 * bloco inteiro é escalado por `larguraReal / 1200`. A alternativa — guardar x
 * e largura em % — parece mais responsiva e é pior: o texto refluiria em cada
 * largura de tela e passaria a sobrepor o elemento de baixo, que é a falha
 * clássica de posicionamento absoluto. Escalando, a composição se mantém
 * idêntica em qualquer largura de desktop, porque o texto escala junto.
 *
 * O preço é texto um pouco menor num desktop estreito (~0,8× a 1,0× entre
 * 1024px e a largura máxima). É menos ruim do que elementos se sobrepondo, e
 * no celular nada disto é usado: lá os elementos empilham.
 *
 * 1200 porque o container do site é max-w-7xl (1280) menos o padding lateral.
 */
export const LARGURA_AREA_LIVRE = 1200;

/** Teto de elementos por bloco. Ver o comentário em AreaLivre.tsx. */
export const MAX_ELEMENTOS_LIVRES = 40;

export type TipoElementoLivre = 'texto' | 'imagem' | 'botao';
export type CorTextoLivre = 'escuro' | 'suave' | 'marca' | 'solar' | 'branco';
export type FundoAreaLivre = 'transparente' | 'branco' | 'cinza' | 'marca';

export interface ElementoAreaLivre {
  /** crypto.randomUUID(). Estável para o React e para a seleção no editor. */
  id: string;
  tipo: TipoElementoLivre;

  /** Canto superior esquerdo e tamanho, em px no canvas de LARGURA_AREA_LIVRE. */
  x: number;
  y: number;
  largura: number;
  altura: number;

  /**
   * Ordem de empilhamento no desktop (z-index). NÃO é a ordem no celular:
   * lá os elementos saem na ordem de leitura da composição, por (y, x).
   */
  camada: number;

  // texto
  texto?: string;
  tamanho_fonte?: number;
  peso?: 'normal' | 'bold' | 'black';
  cor?: CorTextoLivre;
  alinhamento?: 'esquerda' | 'centro' | 'direita';

  // imagem
  midia_id?: string | null;
  ajuste?: 'cobrir' | 'conter';
  raio?: number;

  // botão
  rotulo?: string;
  destino?: string;
  estilo?: 'solido' | 'contorno';
}

export interface ConteudoAreaLivre {
  rotulo: string;
  titulo: string;
  claro: boolean;
  /** Altura do canvas em px no projeto de LARGURA_AREA_LIVRE. */
  altura: number;
  fundo?: FundoAreaLivre;
  elementos: ElementoAreaLivre[];
}

/* -------------------------------------------------------- agregadores --- */

export interface BlocoSite {
  id: string;
  tipo: TipoBloco;
  conteudo: Record<string, unknown>;
}

export interface PaginaSite {
  slug: string;
  caminho: string;
  nome: string;
  tituloSeo: string;
  descricaoSeo: string;
  blocos: BlocoSite[];
}

export interface ItemMenu {
  id: string;
  rotulo: string;
  destino: string;
  novaAba: boolean;
  destaque: boolean;
}

export type ChaveMenu = 'principal' | 'rodape_navegacao' | 'rodape_servicos';

export interface ConteudoSite {
  paginas: PaginaSite[];
  menus: Record<ChaveMenu, ItemMenu[]>;
}

export interface MidiaSite {
  id: string;
  nomeArquivo: string;
  mimeType: string;
  tamanhoBytes: number;
  largura: number | null;
  altura: number | null;
  textoAlternativo: string | null;
  enviadoEm: string;
}

/** URL pública dos bytes de uma imagem da biblioteca. */
export function urlMidia(id: string | null | undefined): string | null {
  return id ? `/api/publico/midia/${id}` : null;
}

/**
 * Extrai o ID de 11 caracteres de um link de vídeo do YouTube em qualquer
 * formato comum (watch?v=, youtu.be/, embed/, shorts/). Devolve `null` para
 * link vazio ou que não é reconhecido como YouTube — é o que faz o bloco
 * não renderizar nada em vez de montar um iframe com `src` inválido.
 */
export function idVideoYoutube(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  );
  return m ? m[1] : null;
}
