// Blocos de composição repetidos pelas páginas. Todos seguem os padrões
// visuais do CRM (ver DashboardView.tsx): rótulo minúsculo em caixa alta,
// título em font-black e cartão branco com régua de gradiente no rodapé.

import React from 'react';

export const Secao: React.FC<{
  children: React.ReactNode;
  className?: string;
  id?: string;
  /** Fundo branco quebra o cinza do site e separa as seções sem borda. */
  claro?: boolean;
}> = ({ children, className = '', id, claro = false }) => (
  <section id={id} className={`${claro ? 'bg-white' : ''} ${className}`}>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16 md:py-20">{children}</div>
  </section>
);

export const TituloSecao: React.FC<{
  rotulo: string;
  titulo: string;
  descricao?: string;
  centralizado?: boolean;
}> = ({ rotulo, titulo, descricao, centralizado = false }) => (
  <div className={`max-w-2xl ${centralizado ? 'mx-auto text-center' : ''}`}>
    <span className="text-xs font-bold text-emerald-600 tracking-widest uppercase">{rotulo}</span>
    <h2 className="text-3xl md:text-4xl font-black tracking-tight text-slate-900 mt-2">{titulo}</h2>
    {descricao && <p className="text-base text-slate-600 mt-3 leading-relaxed">{descricao}</p>}
    <div className={`w-12 h-1 bg-solar rounded-full mt-5 ${centralizado ? 'mx-auto' : ''}`} />
  </div>
);

/** Cartão branco no padrão dos KPIs do dashboard. */
export const Cartao: React.FC<{
  children: React.ReactNode;
  className?: string;
  /** Classes do gradiente da régua inferior. Sem isto, sem régua. */
  regua?: string;
}> = ({ children, className = '', regua }) => (
  <div
    className={`bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs relative overflow-hidden ${className}`}
  >
    {children}
    {regua && <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${regua}`} />}
  </div>
);

/** Quadradinho de ícone colorido — mesmo tratamento dos cards do dashboard. */
export const ChipIcone: React.FC<{
  Icone: React.ComponentType<{ className?: string }>;
  cor?: 'blue' | 'emerald' | 'amber' | 'violet';
}> = ({ Icone, cor = 'blue' }) => {
  const cores = {
    blue: 'bg-blue-50 text-blue-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    violet: 'bg-violet-50 text-violet-600',
  } as const;
  return (
    <div className={`p-2.5 rounded-xl w-fit ${cores[cor]}`}>
      <Icone className="w-5 h-5" />
    </div>
  );
};
