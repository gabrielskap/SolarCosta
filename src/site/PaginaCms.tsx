// Uma página do site, montada a partir do banco.
//
// É o que sobrou das antigas src/site/pages/*.tsx: o SEO vem de
// SolarCosta_SitePaginas e o corpo é a lista de blocos. Página despublicada
// cai no 404, que é o comportamento certo — o endereço continua existindo,
// mas não tem conteúdo no ar.

import React from 'react';
import { useLocation } from 'react-router-dom';
import { useConfigPublica, usePagina } from './contexto';
import { useSeo } from './seo';
import { RenderizadorBlocos } from './RenderizadorBlocos';
import { NaoEncontrado } from './pages/NaoEncontrado';

export const PaginaCms: React.FC<{ slug: string }> = ({ slug }) => {
  const pagina = usePagina(slug);

  // Hooks não podem ficar atrás de um return condicional: com a página fora do
  // ar, o useSeo roda com o texto do 404 (que o próprio NaoEncontrado também
  // define) em vez de não rodar.
  useSeo({
    titulo: pagina?.tituloSeo ?? 'Página não encontrada',
    descricao: pagina?.descricaoSeo ?? 'Esta página não está disponível.',
    naoIndexar: !pagina,
  });

  if (!pagina) return <NaoEncontrado />;

  return <RenderizadorBlocos blocos={pagina.blocos} />;
};

/**
 * Cobre qualquer endereço fora das 5 rotas fixas de src/main.tsx — o destino
 * de uma página criada em Configuração do Site › Páginas. Sem slug conhecido
 * de antemão, resolve pelo `caminho` batendo com a URL atual.
 *
 * Sem fallback de conteudoPadrao.ts (página nova não existe lá): enquanto o
 * /api/publico/site não responde, não dá para saber se o endereço é uma
 * página de verdade ou um 404, então não decide nada — só depois de carregar.
 */
export const PaginaPorCaminho: React.FC = () => {
  const { pathname } = useLocation();
  const { site, carregando } = useConfigPublica();

  if (carregando) return null;

  const pagina = site?.paginas.find((p) => p.caminho === pathname);
  if (!pagina) return <NaoEncontrado />;

  return <PaginaCms slug={pagina.slug} />;
};
