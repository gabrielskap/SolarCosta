// SEO por rota num SPA.
//
// Não há renderização no servidor: o index.html sobe com as metas da home e
// este hook reescreve título, description, canonical e Open Graph a cada
// navegação. É o suficiente para o Google, que executa JS ao indexar.

import { useEffect } from 'react';

const SUFIXO = 'Solar Costa Energia Solar';

function definirMeta(seletor: string, atributo: string, valor: string): void {
  let tag = document.head.querySelector<HTMLMetaElement>(seletor);
  if (!tag) {
    tag = document.createElement('meta');
    const [chave, conteudo] = seletor.includes('property=')
      ? ['property', seletor.match(/property="([^"]+)"/)?.[1] ?? '']
      : ['name', seletor.match(/name="([^"]+)"/)?.[1] ?? ''];
    tag.setAttribute(chave, conteudo);
    document.head.appendChild(tag);
  }
  tag.setAttribute(atributo, valor);
}

function definirCanonical(url: string): void {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.rel = 'canonical';
    document.head.appendChild(link);
  }
  link.href = url;
}

export interface Seo {
  titulo: string;
  descricao: string;
  /** `true` no /sistema: área interna não entra em índice de busca. */
  naoIndexar?: boolean;
}

export function useSeo({ titulo, descricao, naoIndexar = false }: Seo): void {
  useEffect(() => {
    const tituloCompleto = titulo.includes(SUFIXO) ? titulo : `${titulo} | ${SUFIXO}`;
    document.title = tituloCompleto;

    definirMeta('meta[name="description"]', 'content', descricao);
    definirMeta('meta[property="og:title"]', 'content', tituloCompleto);
    definirMeta('meta[property="og:description"]', 'content', descricao);
    definirMeta('meta[property="og:url"]', 'content', window.location.href);
    definirMeta('meta[name="twitter:title"]', 'content', tituloCompleto);
    definirMeta('meta[name="twitter:description"]', 'content', descricao);
    definirMeta(
      'meta[name="robots"]',
      'content',
      naoIndexar ? 'noindex, nofollow' : 'index, follow',
    );
    definirCanonical(`${window.location.origin}${window.location.pathname}`);
  }, [titulo, descricao, naoIndexar]);
}
