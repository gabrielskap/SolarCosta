// Aviso de atualização do service worker, montado uma vez na raiz do app —
// fora de SiteLayout e fora do CRM — porque o service worker cobre o domínio
// inteiro (ver src/sw.ts), mas até aqui só o CRM (App.tsx) sabia avisar sobre
// uma versão nova. Visitante do site institucional ficava preso na versão
// cacheada sem nenhum jeito de aceitar a atualização.
//
// Canto diferente do ToastContainer do CRM (bottom-5 LEFT, não right) de
// propósito: os dois podem estar montados ao mesmo tempo em /sistema, e são
// containers `fixed` independentes — no mesmo canto, um cobriria o outro.

import React, { useState } from 'react';
import { Info, X } from 'lucide-react';
import { registrarServiceWorker } from './registrar';

export const AvisoNovaVersao: React.FC = () => {
  const [atualizar, setAtualizar] = useState<(() => void) | null>(null);

  React.useEffect(() => {
    registrarServiceWorker({
      aoTerNovaVersao: (fn) => setAtualizar(() => fn),
    });
  }, []);

  if (!atualizar) return null;

  return (
    <div className="fixed bottom-5 left-5 z-50 max-w-sm w-full pointer-events-none">
      <div className="pointer-events-auto flex items-start p-4 rounded-xl shadow-lg border bg-blue-50 border-blue-200 text-blue-900 text-sm">
        <div className="shrink-0 mr-3 mt-0.5">
          <Info className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-sm leading-tight">Nova versão disponível</h4>
          <p className="mt-1 text-xs text-slate-600">Atualize para receber as últimas correções.</p>
          <button
            onClick={atualizar}
            className="mt-2 px-3 py-1.5 bg-[#004276] hover:bg-[#003159] text-white text-xs font-bold rounded-lg transition"
          >
            Atualizar agora
          </button>
        </div>
        <button
          onClick={() => setAtualizar(null)}
          aria-label="Fechar aviso"
          className="shrink-0 text-slate-400 hover:text-slate-600 ml-2 p-1 rounded-md"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
