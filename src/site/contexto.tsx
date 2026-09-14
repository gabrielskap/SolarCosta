// Estado compartilhado pelas páginas do site.
//
// Duas chamadas, uma só vez, no topo da árvore:
//   · /api/publico/config → cadastro da empresa, concessionárias e os
//     parâmetros que o simulador usa.
//   · /api/publico/site   → o conteúdo editorial (páginas, blocos e menus)
//     que o administrador edita em /sistema/site.
//
// Se qualquer uma falhar, o site continua de pé: o cadastro cai em
// CONTATO_PADRAO (services/publico.ts) e o conteúdo cai em conteudoPadrao.ts.
// Um site institucional não pode ficar em branco porque o banco caiu — e com
// "salvar publica direto" essa rede vale ainda mais: é o que separa um erro
// de digitação de uma página inacessível.

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Publico, type ConfigPublica, type SitePublico } from '../services/publico';
import { CONTEUDO_PADRAO, paginaPadrao } from './conteudoPadrao';
import type { BlocoSite, ChaveMenu, ItemMenu, PaginaSite } from './blocos/tipos';

interface Estado {
  config: ConfigPublica | null;
  site: SitePublico | null;
  carregando: boolean;
}

const ContextoConfig = createContext<Estado>({ config: null, site: null, carregando: true });

export const ProvedorConfigPublica: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [estado, setEstado] = useState<Estado>({ config: null, site: null, carregando: true });

  useEffect(() => {
    let ativo = true;

    // allSettled e não all: o simulador não pode sumir porque o CMS falhou,
    // nem o texto da home porque a tabela de concessionárias travou.
    void Promise.allSettled([Publico.getConfig(), Publico.getSite()]).then(([c, s]) => {
      if (!ativo) return;
      setEstado({
        config: c.status === 'fulfilled' ? c.value : null,
        site: s.status === 'fulfilled' ? s.value : null,
        carregando: false,
      });
    });

    return () => {
      ativo = false;
    };
  }, []);

  return <ContextoConfig.Provider value={estado}>{children}</ContextoConfig.Provider>;
};

export function useConfigPublica(): Estado {
  return useContext(ContextoConfig);
}

/* --------------------------------------------------- leitura com fallback -- */

/**
 * A página pedida, venha do banco ou do conteúdo de fábrica.
 *
 * Devolve `null` só quando o slug não existe em lugar nenhum — aí a rota cai
 * no 404, que é o comportamento certo para uma página despublicada.
 */
export function usePagina(slug: string): PaginaSite | null {
  const { site, carregando } = useConfigPublica();

  const doBanco = site?.paginas.find((p) => p.slug === slug);
  if (doBanco) {
    return {
      slug: doBanco.slug,
      caminho: doBanco.caminho,
      nome: doBanco.slug,
      tituloSeo: doBanco.titulo_seo,
      descricaoSeo: doBanco.descricao_seo,
      blocos: doBanco.blocos as BlocoSite[],
    };
  }

  // Enquanto carrega, mostra o conteúdo de fábrica em vez de uma tela vazia
  // que pisca — é o mesmo texto que o banco devolve na esmagadora maioria dos
  // casos, e evita o salto de layout.
  if (carregando || !site) return paginaPadrao(slug) ?? null;

  // O site respondeu e não trouxe este slug: a página foi despublicada.
  return null;
}

/** Itens de um menu, do banco ou de fábrica. */
export function useMenu(chave: ChaveMenu): ItemMenu[] {
  const { site } = useConfigPublica();
  const doBanco = site?.menus?.[chave];

  if (doBanco && doBanco.length > 0) {
    return doBanco.map((i) => ({
      id: i.id,
      rotulo: i.rotulo,
      destino: i.destino,
      novaAba: !!i.nova_aba,
      destaque: !!i.destaque,
    }));
  }

  return CONTEUDO_PADRAO.menus[chave];
}
