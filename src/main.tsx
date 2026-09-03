// Raiz da aplicação: um único build serve o site público e o CRM.
//
//   /            site institucional  (bundle leve)
//   /sistema/*   CRM                 (React.lazy — só baixa quem vai usar)
//
// O CRM declara suas próprias rotas internas (/sistema/dashboard,
// /sistema/leads, etc.) num <Routes> aninhado dentro de App — por isso o
// wildcard "*" aqui só entrega o pacote lazy, sem conhecer as subrotas.
//
// Rota profunda funciona sem configuração nova: o Express já devolve o
// index.html para qualquer GET fora de /api (server/src/app.ts) e o Nginx faz
// o mesmo com try_files.

import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import './index.css';

import { SiteLayout } from './site/SiteLayout';
import { useSeo } from './site/seo';
import { Home } from './site/pages/Home';
import { Servicos } from './site/pages/Servicos';
import { Simulador } from './site/pages/Simulador';
import { Sobre } from './site/pages/Sobre';
import { Contato } from './site/pages/Contato';
import { NaoEncontrado } from './site/pages/NaoEncontrado';

// O CRM carrega recharts, motion e ~15 telas. Nada disso deve pesar na home.
const Crm = lazy(() => import('./App'));

const Carregando = () => (
  <div className="h-screen w-screen flex items-center justify-center bg-fundo">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="w-8 h-8 text-marca animate-spin" />
      <p className="text-sm font-semibold text-slate-500">Carregando…</p>
    </div>
  </div>
);

/** Casca do CRM: só existe para marcar noindex e segurar o Suspense. */
const Sistema = () => {
  useSeo({
    titulo: 'Sistema',
    descricao: 'Área restrita a colaboradores da Solar Costa.',
    naoIndexar: true,
  });
  return (
    <Suspense fallback={<Carregando />}>
      <Crm />
    </Suspense>
  );
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<SiteLayout />}>
          <Route index element={<Home />} />
          <Route path="servicos" element={<Servicos />} />
          <Route path="simulador" element={<Simulador />} />
          <Route path="sobre" element={<Sobre />} />
          <Route path="contato" element={<Contato />} />
          <Route path="*" element={<NaoEncontrado />} />
        </Route>

        {/* Wildcard: as subrotas reais (/dashboard, /leads, ...) vivem dentro do próprio CRM. */}
        <Route path="/sistema/*" element={<Sistema />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
