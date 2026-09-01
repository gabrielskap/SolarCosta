// Moldura das páginas públicas: cabeçalho, conteúdo, rodapé e o botão
// flutuante de WhatsApp que acompanha a rolagem.

import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';
import { BotaoWhatsApp } from './components/BotaoWhatsApp';
import { ProvedorConfigPublica } from './contexto';

/** Navegar entre rotas deve começar no topo, não no meio da página anterior. */
const RolarAoTopo: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [pathname]);
  return null;
};

export const SiteLayout: React.FC = () => (
  <ProvedorConfigPublica>
    <div className="min-h-screen flex flex-col bg-fundo text-slate-800 font-sans antialiased">
      <RolarAoTopo />
      <SiteHeader />
      <main className="flex-1">
        <Outlet />
      </main>
      <SiteFooter />
      <BotaoWhatsApp />
    </div>
  </ProvedorConfigPublica>
);
