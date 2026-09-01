// Cartão de serviço, no padrão dos KPIs do dashboard: ícone em chip colorido,
// rótulo em caixa alta, régua de gradiente no rodapé.

import React from 'react';
import { Check } from 'lucide-react';
import type { Servico } from '../conteudo';
import { Cartao, ChipIcone } from './Secao';

const REGUAS: Record<Servico['cor'], string> = {
  blue: 'from-blue-600 to-indigo-500',
  emerald: 'from-emerald-500 to-teal-400',
  amber: 'from-amber-500 to-orange-400',
  violet: 'from-violet-500 to-fuchsia-400',
};

export const CardServico: React.FC<{
  servico: Servico;
  /** Na home o cartão mostra só o resumo; em /servicos abre a lista inteira. */
  completo?: boolean;
}> = ({ servico, completo = false }) => (
  <Cartao className="h-full flex flex-col" regua={REGUAS[servico.cor]}>
    <ChipIcone Icone={servico.Icone} cor={servico.cor} />

    <h3 className="mt-4 text-lg font-black text-slate-900 tracking-tight">{servico.titulo}</h3>
    <p className="mt-2 text-sm text-slate-600 leading-relaxed">{servico.resumo}</p>

    {completo && (
      <ul className="mt-5 space-y-2.5 pt-4 border-t border-slate-100">
        {servico.detalhes.map((d) => (
          <li key={d} className="flex items-start gap-2.5 text-sm text-slate-700">
            <Check className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
            <span>{d}</span>
          </li>
        ))}
      </ul>
    )}
  </Cartao>
);
