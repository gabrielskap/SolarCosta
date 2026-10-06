// Moldura das páginas públicas: cabeçalho, conteúdo, rodapé e o botão
// flutuante de WhatsApp que acompanha a rolagem.
//
// Com ?editor=1 na URL, a mesma moldura vira o preview do editor visual: o
// conteúdo passa a vir do pai por postMessage (PonteEditor) em vez da API, e o
// botão flutuante sai de cena — ele cobriria justamente o canto onde ficam as
// alças do último bloco da página.

import React, { Suspense, lazy, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';
import { BotaoWhatsApp } from './components/BotaoWhatsApp';
import { ProvedorConfigPublica } from './contexto';
import { pediuModoEditor } from './editor/contexto';

// Todo o editor é lazy: quem só está lendo o site nunca baixa este pedaço.
const PonteEditor = lazy(() => import('./editor/PonteEditor'));

/** Navegar entre rotas deve começar no topo, não no meio da página anterior. */
const RolarAoTopo: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
};

/** O miolo, igual nos dois modos — só muda quem fornece o conteúdo em volta. */
const Moldura: React.FC<{ editando: boolean }> = ({ editando }) => (
  <div className="min-h-screen flex flex-col bg-fundo text-slate-800 font-sans antialiased">
    {!editando && <RolarAoTopo />}
    <SiteHeader />
    <main className="flex-1">
      <Outlet />
    </main>
    <SiteFooter />
    {!editando && <BotaoWhatsApp />}
  </div>
);

export const SiteLayout: React.FC = () => {
  // Lido uma vez na montagem: trocar de modo exige recarregar o iframe de
  // qualquer forma, e um valor estável evita remontar a árvore inteira quando
  // o preview navega entre páginas.
  const [editando] = React.useState(pediuModoEditor);

  if (editando) {
    return (
      <Suspense fallback={null}>
        <PonteEditor>
          <Moldura editando />
        </PonteEditor>
      </Suspense>
    );
  }

  return (
    <ProvedorConfigPublica>
      <Moldura editando={false} />
    </ProvedorConfigPublica>
  );
};
