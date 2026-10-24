// Campos dos módulos do editor de contrato. Mesmo visual do resto do CRM
// (ROTULO/CAMPO de site/EditorSeo.tsx), com `somenteLeitura` em todos: o
// contrato assinado abre no mesmo editor, só que travado.

import React from 'react';
import type { Contrato, TermosContrato, ContratadaContrato } from '../../types';
import type { ConfigApp } from '../../services/api';
import type { RascunhoContrato } from '../../contrato/rascunho';

export const ROTULO = 'block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1';
export const CAMPO =
  'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:border-[#004276] focus:ring-2 focus:ring-blue-100 transition disabled:bg-slate-100 disabled:text-slate-600 disabled:cursor-not-allowed';
export const BOTAO_SECUNDARIO =
  'inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-lg text-xs transition disabled:opacity-50 disabled:cursor-not-allowed';

/** O que todo módulo recebe. */
export interface PropsModulo {
  r: RascunhoContrato;
  alterar: (parcial: Partial<Contrato>) => void;
  alterarTermos: (parcial: Partial<TermosContrato>) => void;
  alterarContratada: (parcial: Partial<ContratadaContrato>) => void;
  somenteLeitura: boolean;
  config: ConfigApp | null;
}

interface PropsCampo {
  rotulo: string;
  valor: string | number;
  onChange: (valor: string) => void;
  somenteLeitura?: boolean;
  tipo?: 'text' | 'email' | 'date' | 'number' | 'tel';
  /** Texto à direita do campo ("dias", "%"). */
  sufixo?: string;
  dica?: React.ReactNode;
  placeholder?: string;
  /** Ocupa a linha inteira do grid. */
  larga?: boolean;
  id?: string;
  lista?: string;
  min?: number;
  max?: number;
  passo?: number;
  aviso?: string | null;
}

function useIdCampo(id?: string): string {
  const gerado = React.useId();
  return id ?? gerado;
}

export const Campo: React.FC<PropsCampo> = ({
  rotulo, valor, onChange, somenteLeitura, tipo = 'text', sufixo, dica, placeholder, larga, id, lista,
  min, max, passo, aviso,
}) => {
  const idCampo = useIdCampo(id);
  return (
    <div className={larga ? 'sm:col-span-2' : undefined}>
      <label htmlFor={idCampo} className={ROTULO}>{rotulo}</label>
      <div className="flex items-center gap-2">
        <input
          id={idCampo}
          type={tipo}
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          disabled={somenteLeitura}
          placeholder={placeholder}
          list={lista}
          min={min}
          max={max}
          step={passo}
          className={CAMPO}
          aria-invalid={aviso ? true : undefined}
        />
        {sufixo && <span className="text-xs font-semibold text-slate-500 shrink-0">{sufixo}</span>}
      </div>
      {aviso && <p className="mt-1 text-[11px] font-semibold text-amber-700">{aviso}</p>}
      {dica && !aviso && <p className="mt-1 text-[11px] text-slate-500">{dica}</p>}
    </div>
  );
};

/** Campo numérico: guarda número, aceita vírgula. */
export const CampoNumero: React.FC<
  Omit<PropsCampo, 'valor' | 'onChange' | 'tipo'> & { valor: number; onChange: (n: number) => void; inteiro?: boolean }
> = ({ valor, onChange, inteiro, ...resto }) => {
  // O texto digitado fica em estado local: "1," ainda não é número e não pode
  // ser apagado no meio da digitação.
  const [texto, setTexto] = React.useState(String(valor).replace('.', ','));
  React.useEffect(() => {
    const atual = Number(texto.replace(',', '.'));
    if (atual !== valor) setTexto(String(valor).replace('.', ','));
  }, [valor]);
  return (
    <Campo
      {...resto}
      tipo="text"
      valor={texto}
      onChange={(v) => {
        const limpo = inteiro ? v.replace(/\D/g, '') : v.replace(/[^\d,.]/g, '');
        setTexto(limpo);
        const n = Number(limpo.replace(',', '.'));
        if (limpo !== '' && Number.isFinite(n)) onChange(inteiro ? Math.trunc(n) : n);
        if (limpo === '') onChange(0);
      }}
    />
  );
};

export const CampoTexto: React.FC<{
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  somenteLeitura?: boolean;
  linhas?: number;
  dica?: React.ReactNode;
  placeholder?: string;
}> = ({ rotulo, valor, onChange, somenteLeitura, linhas = 3, dica, placeholder }) => {
  const idCampo = useIdCampo();
  return (
    <div className="sm:col-span-2">
      <label htmlFor={idCampo} className={ROTULO}>{rotulo}</label>
      <textarea
        id={idCampo}
        value={valor}
        rows={linhas}
        onChange={(e) => onChange(e.target.value)}
        disabled={somenteLeitura}
        placeholder={placeholder}
        className={`${CAMPO} resize-y`}
      />
      {dica && <p className="mt-1 text-[11px] text-slate-500">{dica}</p>}
    </div>
  );
};

/** Cabeçalho de cada módulo: título, de onde o texto sai no contrato, ações. */
export const CabecalhoModulo: React.FC<{
  titulo: string;
  onde?: string;
  children?: React.ReactNode;
}> = ({ titulo, onde, children }) => (
  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
    <div>
      <h3 className="font-bold text-slate-900 text-base">{titulo}</h3>
      {onde && <p className="text-xs text-slate-500 mt-0.5">{onde}</p>}
    </div>
    {children && <div className="flex flex-wrap gap-2">{children}</div>}
  </div>
);

export const Grade: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{children}</div>
);
