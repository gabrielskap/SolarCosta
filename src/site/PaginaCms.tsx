// Uma página do site, montada a partir do banco.
//
// É o que sobrou das antigas src/site/pages/*.tsx: o SEO vem de
// SolarCosta_SitePaginas e o corpo é a lista de blocos. Página despublicada
// cai no 404, que é o comportamento certo — o endereço continua existindo,
// mas não tem conteúdo no ar.

import React from 'react';
import { usePagina } from './contexto';
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
