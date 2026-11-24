import React from 'react';
import type { LucideIcon } from 'lucide-react';

export function CabecalhoSecaoProposta({ id, titulo, descricao, icone: Icone, acao }: {
  id: string;
  titulo: string;
  descricao: string;
  icone: LucideIcon;
  acao?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col items-stretch justify-between gap-3 border-b border-slate-200 pb-4 @min-[36rem]:flex-row @min-[36rem]:items-start">
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span aria-hidden="true" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#004276] text-white">
          <Icone className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 id={id} className="text-base font-bold leading-snug text-[#004276]">{titulo}</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">{descricao}</p>
        </div>
      </div>
      {acao && <div className="flex shrink-0 flex-wrap items-center gap-2">{acao}</div>}
    </header>
  );
}
