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
}

export interface ConteudoGaleria {
  rotulo: string;
  titulo: string;
  descricao: string;
  claro: boolean;
  imagens: { midia_id: string; legenda: string }[];
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
