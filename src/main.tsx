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

import { useSeo } from './site/seo';

// O CRM carrega recharts, motion e ~15 telas. Nada disso deve pesar na home.
const Crm = lazy(() => import('./App'));

// E o inverso também vale: o site arrasta o registry de blocos do CMS, e quem
// abre /sistema no celular não renderiza nenhum deles. Com os dois lados lazy,
// o entry fica só com o roteador — cada app baixa o que é seu.
//
// O site não perde LCP com isso: o conteúdo já espera /api/publico/site antes
// de renderizar, e o chunk viaja em paralelo com essa chamada.
const SiteLayout = lazy(() => import('./site/SiteLayout').then((m) => ({ default: m.SiteLayout })));
const PaginaCms = lazy(() => import('./site/PaginaCms').then((m) => ({ default: m.PaginaCms })));
const NaoEncontrado = lazy(() => import('./site/pages/NaoEncontrado').then((m) => ({ default: m.NaoEncontrado })));

const Carregando = () => (
  <div className="altura-viewport w-full flex items-center justify-center bg-fundo">
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
      <Suspense fallback={<Carregando />}>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route index element={<PaginaCms slug="home" />} />
            <Route path="servicos" element={<PaginaCms slug="servicos" />} />
            <Route path="simulador" element={<PaginaCms slug="simulador" />} />
            <Route path="sobre" element={<PaginaCms slug="sobre" />} />
            <Route path="contato" element={<PaginaCms slug="contato" />} />
            <Route path="*" element={<NaoEncontrado />} />
          </Route>

          {/* Wildcard: as subrotas reais (/dashboard, /leads, ...) vivem dentro do próprio CRM. */}
          <Route path="/sistema/*" element={<Sistema />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  </StrictMode>,
);
