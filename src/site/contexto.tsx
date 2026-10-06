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

interface PropsProvedor {
  children: React.ReactNode;
  /**
   * Conteúdo imposto de fora, em vez de buscado.
   *
   * É o preview do editor visual (src/site/editor/PonteEditor.tsx), que recebe
   * o RASCUNHO do pai por postMessage. Só a parte editorial vem daqui: o
   * cadastro da empresa continua saindo de /api/publico/config, porque ele não
   * tem rascunho — é o mesmo valor no preview e no site no ar.
   *
   * Sem esta prop nada muda, e é esse o ponto: o site público segue com
   * exatamente o mesmo comportamento de antes do editor existir.
   */
  fonte?: SitePublico | null;
}

export const ProvedorConfigPublica: React.FC<PropsProvedor> = ({ children, fonte }) => {
  const [estado, setEstado] = useState<Estado>({ config: null, site: null, carregando: true });
  const imposto = fonte !== undefined;

  useEffect(() => {
    let ativo = true;

    // allSettled e não all: o simulador não pode sumir porque o CMS falhou,
    // nem o texto da home porque a tabela de concessionárias travou.
    //
    // Com `fonte` imposta, o conteúdo editorial já chegou por outro caminho e
    // buscá-lo seria uma requisição jogada fora — mas o cadastro da empresa
    // continua vindo da rede nos dois casos.
    const promessaSite = imposto
      ? Promise.resolve(null)
      : Publico.getSite().catch(() => null);

    void Promise.allSettled([Publico.getConfig()]).then(async ([c]) => {
      const site = await promessaSite;
      if (!ativo) return;
      setEstado({
        config: c.status === 'fulfilled' ? c.value : null,
        site,
        carregando: false,
      });
    });

    return () => {
      ativo = false;
    };
  }, [imposto]);

  // O conteúdo imposto vence sempre que a prop está presente.
  //
  // Enquanto ele não chega, o preview continua CARREGANDO — e não "carregado
  // e vazio". A diferença não é cosmética: PaginaCms distingue "ainda não sei"
  // de "o site respondeu e não tem esta página", e a segunda leitura leva ao
  // 404. Uma das 5 páginas fixas disfarçaria o erro, porque usePagina cai no
  // conteúdo de fábrica; uma página criada no CMS não existe em
  // conteudoPadrao.ts e cairia direto na tela de "página não existe".
  const valor: Estado = imposto
    ? { config: estado.config, site: fonte ?? null, carregando: !fonte }
    : estado;

  return <ContextoConfig.Provider value={valor}>{children}</ContextoConfig.Provider>;
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
