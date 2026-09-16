// Cliente de /api/site — o que a tela Configuração do Site consome.
//
// Diferente do resto de services/api.ts, aqui NÃO há mapper snake_case ↔
// camelCase para o miolo dos blocos: `conteudo` é jsonb de forma livre, e
// renomear chaves dentro dele quebraria o contrato com os componentes do site,
// que leem exatamente as mesmas chaves que o banco guarda. O que é metadado
// (id, ordem, visível) vem normalizado; o conteúdo trafega como está.

import { http } from './http';
import type { MidiaSite, TipoBloco } from '../site/blocos/tipos';

export interface BlocoAdmin {
  id: string;
  paginaId: string;
  tipo: TipoBloco;
  ordem: number;
  visivel: boolean;
  conteudo: Record<string, unknown>;
}

export interface PaginaAdmin {
  id: string;
  slug: string;
  caminho: string;
  nome: string;
  tituloSeo: string;
  descricaoSeo: string;
  publicada: boolean;
  ordem: number;
  blocos: BlocoAdmin[];
}

export interface ItemMenuAdmin {
  id: string;
  menuId: string;
  rotulo: string;
  destino: string;
  novaAba: boolean;
  destaque: boolean;
  visivel: boolean;
  ordem: number;
}

export interface MenuAdmin {
  id: string;
  chave: string;
  nome: string;
  descricao: string | null;
  itens: ItemMenuAdmin[];
}

export interface SiteAdmin {
  paginas: PaginaAdmin[];
  menus: MenuAdmin[];
  midia: MidiaSite[];
}

/**
 * Slugs das 5 páginas com rota própria em src/main.tsx — espelha
 * PAGINAS_FIXAS em server/src/routes/site.routes.ts. Só elas não podem ser
 * excluídas: uma página nova é servida pela rota curinga (PaginaPorCaminho),
 * que resolve qualquer `caminho` do banco.
 */
export const PAGINAS_FIXAS = new Set(['home', 'servicos', 'simulador', 'sobre', 'contato']);

/** Mesmo formato aceito pela API: um segmento minúsculo, começando com "/". */
export const CAMINHO_VALIDO = /^\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** "Serviço Pós-venda!" → "servico-pos-venda" */
export function slugificar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/* ---------------------------------------------------------- conversão --- */

function paraBloco(b: any): BlocoAdmin {
  return {
    id: b.id,
    paginaId: b.pagina_id,
    tipo: b.tipo,
    ordem: Number(b.ordem ?? 0),
    visivel: b.visivel !== false,
    conteudo: (b.conteudo ?? {}) as Record<string, unknown>,
  };
}

function paraPagina(p: any): PaginaAdmin {
  return {
    id: p.id,
    slug: p.slug,
    caminho: p.caminho,
    nome: p.nome,
    tituloSeo: p.titulo_seo ?? '',
    descricaoSeo: p.descricao_seo ?? '',
    publicada: p.publicada !== false,
    ordem: Number(p.ordem ?? 0),
    blocos: (p.blocos ?? []).map(paraBloco),
  };
}

function paraItemMenu(i: any): ItemMenuAdmin {
  return {
    id: i.id,
    menuId: i.menu_id,
    rotulo: i.rotulo,
    destino: i.destino,
    novaAba: !!i.nova_aba,
    destaque: !!i.destaque,
    visivel: i.visivel !== false,
    ordem: Number(i.ordem ?? 0),
  };
}

function paraMenu(m: any): MenuAdmin {
  return {
    id: m.id,
    chave: m.chave,
    nome: m.nome,
    descricao: m.descricao ?? null,
    itens: (m.itens ?? []).map(paraItemMenu),
  };
}

function paraMidia(m: any): MidiaSite {
  return {
    id: m.id,
    nomeArquivo: m.nome_arquivo,
    mimeType: m.mime_type,
    tamanhoBytes: Number(m.tamanho_bytes ?? 0),
    largura: m.largura ?? null,
    altura: m.altura ?? null,
    textoAlternativo: m.texto_alternativo ?? null,
    enviadoEm: m.enviado_em,
  };
}

/* ------------------------------------------------------------- chamadas -- */

export const Site = {
  carregar: async (): Promise<SiteAdmin> => {
    const r = await http.get<any>('/api/site');
    return {
      paginas: (r.paginas ?? []).map(paraPagina),
      menus: (r.menus ?? []).map(paraMenu),
      midia: (r.midia ?? []).map(paraMidia),
    };
  },

  criarPagina: async (dados: { nome: string; caminho: string }): Promise<PaginaAdmin> => {
    const r = await http.post<any>('/api/site/paginas', dados);
    return paraPagina(r.pagina);
  },

  salvarPagina: async (
    id: string,
    dados: { titulo_seo?: string; descricao_seo?: string; publicada?: boolean },
  ): Promise<PaginaAdmin> => {
    const r = await http.patch<any>(`/api/site/paginas/${id}`, dados);
    return paraPagina(r.pagina);
  },

  excluirPagina: (id: string): Promise<void> => http.delete<void>(`/api/site/paginas/${id}`),

  criarBloco: async (
    paginaId: string,
    tipo: TipoBloco,
    conteudo: Record<string, unknown>,
  ): Promise<BlocoAdmin> => {
    const r = await http.post<any>(`/api/site/paginas/${paginaId}/blocos`, { tipo, conteudo });
    return paraBloco(r.bloco);
  },

  salvarBloco: async (
    id: string,
    dados: { conteudo?: Record<string, unknown>; visivel?: boolean },
  ): Promise<BlocoAdmin> => {
    const r = await http.patch<any>(`/api/site/blocos/${id}`, dados);
    return paraBloco(r.bloco);
  },

  excluirBloco: (id: string): Promise<void> => http.delete<void>(`/api/site/blocos/${id}`),

  reordenarBlocos: async (paginaId: string, ordem: string[]): Promise<BlocoAdmin[]> => {
    const r = await http.patch<any>(`/api/site/paginas/${paginaId}/blocos/ordem`, { ordem });
    return (r.blocos ?? []).map(paraBloco);
  },

  criarItemMenu: async (
    chave: string,
    dados: { rotulo: string; destino: string; nova_aba?: boolean; destaque?: boolean },
  ): Promise<ItemMenuAdmin> => {
    const r = await http.post<any>(`/api/site/menus/${chave}/itens`, dados);
    return paraItemMenu(r.item);
  },

  salvarItemMenu: async (
    id: string,
    dados: {
      rotulo?: string;
      destino?: string;
      nova_aba?: boolean;
      destaque?: boolean;
      visivel?: boolean;
    },
  ): Promise<ItemMenuAdmin> => {
    const r = await http.patch<any>(`/api/site/menu-itens/${id}`, dados);
    return paraItemMenu(r.item);
  },

  excluirItemMenu: (id: string): Promise<void> => http.delete<void>(`/api/site/menu-itens/${id}`),

  reordenarMenu: async (chave: string, ordem: string[]): Promise<ItemMenuAdmin[]> => {
    const r = await http.patch<any>(`/api/site/menus/${chave}/ordem`, { ordem });
    return (r.itens ?? []).map(paraItemMenu);
  },

  /**
   * Sobe a imagem como corpo cru. Largura e altura são medidas no browser
   * antes do envio: o servidor não decodifica imagem, e ter a proporção
   * guardada evita que a biblioteca precise baixar o arquivo só para mostrar
   * uma miniatura com o aspecto certo.
   */
  enviarMidia: async (arquivo: File, alt?: string): Promise<MidiaSite> => {
    const dim = await medirImagem(arquivo);
    const q = new URLSearchParams({ nome: arquivo.name });
    if (alt) q.set('alt', alt);
    if (dim) {
      q.set('largura', String(dim.largura));
      q.set('altura', String(dim.altura));
    }
    const r = await http.postBinario<any>(`/api/site/midia?${q.toString()}`, arquivo);
    return paraMidia(r.midia);
  },

  salvarMidia: async (
    id: string,
    dados: { texto_alternativo?: string; nome_arquivo?: string },
  ): Promise<MidiaSite> => {
    const r = await http.patch<any>(`/api/site/midia/${id}`, dados);
    return paraMidia(r.midia);
  },

  excluirMidia: (id: string): Promise<{ blocos_em_uso: number }> =>
    http.delete<{ blocos_em_uso: number }>(`/api/site/midia/${id}`),
};

/** Lê as dimensões sem bloquear o upload: falhou, sobe sem elas. */
function medirImagem(arquivo: File): Promise<{ largura: number; altura: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(arquivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ largura: img.naturalWidth, altura: img.naturalHeight });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
