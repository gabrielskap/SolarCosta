// Faixa azul que abre /servicos, /simulador, /sobre e /contato.
//
// As quatro páginas repetiam a mesma marcação. Além de unificar, o componente
// traz a marca d'água do símbolo da marca: o mesmo sol-folha do logotipo, em
// opacidade baixa, para que a identidade acompanhe o visitante em toda página
// e não fique só no cabeçalho.

import React from 'react';
import logoIcon from '../../assets/logo-icon.png';

interface Props {
  rotulo: string;
  titulo: React.ReactNode;
  descricao?: string;
  /** Ícone opcional ao lado do rótulo (o simulador usa a calculadora). */
  Icone?: React.ComponentType<{ className?: string }>;
  children?: React.ReactNode;
}

export const CabecalhoPagina: React.FC<Props> = ({
  rotulo,
  titulo,
  descricao,
  Icone,
  children,
}) => (
  <section className="relative bg-marca text-white overflow-hidden">
    {/* Marca d'água: decorativa, fora da árvore de acessibilidade. */}
    <img
      src={logoIcon}
      alt=""
      aria-hidden="true"
      className="hidden md:block absolute -right-10 top-1/2 -translate-y-1/2 h-[130%] w-auto opacity-[0.06] pointer-events-none select-none"
    />

    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-14 md:py-20">
      <span className="inline-flex items-center gap-2 text-xs font-bold text-solar tracking-widest uppercase">
        {Icone && <Icone className="w-4 h-4" />}
        {rotulo}
      </span>

      <h1 className="text-3xl md:text-5xl font-black tracking-tight mt-3 max-w-3xl leading-tight">
        {titulo}
      </h1>

      <div className="w-16 h-1 bg-emerald-500 rounded-full mt-6" />

      {descricao && (
        <p className="mt-6 text-lg text-blue-100 max-w-2xl leading-relaxed">{descricao}</p>
      )}

      {children}
    </div>
  </section>
);
