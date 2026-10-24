// Combobox "Gerar a partir da proposta" — escolher uma proposta preenche o
// contrato inteiro (ver aplicarProposta em src/contrato/rascunho.ts).
// Era parte do formulário do ContractsView; o comportamento de teclado e de
// ARIA é o mesmo.

import React, { useState } from 'react';
import type { Proposta } from '../../types';
import { ROTULO } from './campos';

interface Props {
  propostas: Proposta[];
  selecionadaId: string;
  onSelecionar: (proposta: Proposta | null) => void;
  desabilitado?: boolean;
}

const normalizar = (texto: string) =>
  (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const SeletorProposta: React.FC<Props> = ({ propostas, selecionadaId, onSelecionar, desabilitado }) => {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const [indice, setIndice] = useState(0);

  const filtradas = propostas.filter((p) => normalizar(`${p.numero} ${p.clienteNome}`).includes(normalizar(busca)));
  const opcoes = [
    { id: '', label: 'Nenhuma — preencher manualmente' },
    ...filtradas.map((p) => ({ id: p.id, label: `${p.numero} · ${p.clienteNome} · ${p.potenciaKwp} kWp` })),
  ];
  const selecionada = propostas.find((p) => p.id === selecionadaId);

  const escolher = (id: string) => {
    setBusca('');
    setAberto(false);
    onSelecionar(propostas.find((p) => p.id === id) ?? null);
  };

  return (
    <div
      className="relative sm:col-span-2"
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setAberto(false);
          setBusca('');
        }
      }}
    >
      <label htmlFor="proposta-origem" className={ROTULO}>Gerar a partir da proposta</label>
      <input
        id="proposta-origem"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={aberto}
        aria-controls="opcoes-proposta"
        aria-activedescendant={aberto ? `opcao-proposta-${indice}` : undefined}
        autoComplete="off"
        disabled={desabilitado}
        placeholder="Buscar por número ou cliente"
        value={aberto ? busca : selecionada ? `${selecionada.numero} · ${selecionada.clienteNome} · ${selecionada.potenciaKwp} kWp` : ''}
        onFocus={() => { setAberto(true); setIndice(0); }}
        onClick={() => { setAberto(true); setIndice(0); }}
        onChange={(e) => { setBusca(e.target.value); setAberto(true); setIndice(0); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setAberto(true);
            setIndice((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + opcoes.length) % opcoes.length);
          } else if (e.key === 'Enter' && aberto) {
            e.preventDefault();
            escolher(opcoes[indice]?.id ?? '');
          } else if (e.key === 'Escape') {
            setAberto(false);
            setBusca('');
          }
        }}
        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-[#004276] disabled:bg-slate-100"
      />
      {aberto && (
        <ul
          id="opcoes-proposta"
          role="listbox"
          aria-label="Propostas disponíveis"
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {opcoes.map((opcao, i) => (
            <li
              key={opcao.id || 'nenhuma'}
              id={`opcao-proposta-${i}`}
              role="option"
              aria-selected={opcao.id === selecionadaId}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setIndice(i)}
              onClick={() => escolher(opcao.id)}
              className={`cursor-pointer px-3 py-2.5 text-xs font-semibold ${i === indice ? 'bg-blue-50 text-[#004276]' : 'text-slate-700'}`}
            >
              {opcao.label}
            </li>
          ))}
          {filtradas.length === 0 && <li className="px-3 py-2.5 text-xs text-slate-500">Nenhuma proposta encontrada.</li>}
        </ul>
      )}
      <p className="mt-1 text-[11px] text-slate-500">
        Preenche contratante, sistema, preço, condições de pagamento e o Anexo I. Prazos, multas e textos ficam como estão.
      </p>
    </div>
  );
};
