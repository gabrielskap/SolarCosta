// Combobox "Gerar a partir de…" — escolher a origem preenche o documento
// inteiro. É o da proposta no contrato (SeletorProposta) e o do contrato na
// procuração; o comportamento de teclado e de ARIA é um só.

import React, { useState } from 'react';
import { ROTULO } from '../contrato/campos';

export interface OpcaoOrigem {
  id: string;
  rotulo: string;
  /** Texto onde a busca procura (número, cliente…). */
  busca: string;
}

interface Props {
  /** id do campo; a lista e as opções derivam dele. */
  id: string;
  rotulo: string;
  placeholder: string;
  /** Nome acessível da lista ("Propostas disponíveis"). */
  rotuloLista: string;
  semResultado: string;
  dica: React.ReactNode;
  opcoes: OpcaoOrigem[];
  selecionadaId: string;
  /** '' = "Nenhuma — preencher manualmente". */
  onSelecionar: (id: string) => void;
  desabilitado?: boolean;
}

const normalizar = (texto: string) =>
  (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export const SeletorOrigem: React.FC<Props> = ({
  id, rotulo, placeholder, rotuloLista, semResultado, dica, opcoes, selecionadaId, onSelecionar, desabilitado,
}) => {
  const [busca, setBusca] = useState('');
  const [aberto, setAberto] = useState(false);
  const [indice, setIndice] = useState(0);

  const filtradas = opcoes.filter((o) => normalizar(o.busca).includes(normalizar(busca)));
  const lista = [{ id: '', rotulo: 'Nenhuma — preencher manualmente' }, ...filtradas];
  const selecionada = opcoes.find((o) => o.id === selecionadaId);
  const idLista = `${id}-opcoes`;
  const idOpcao = (i: number) => `${id}-opcao-${i}`;

  const escolher = (escolhida: string) => {
    setBusca('');
    setAberto(false);
    onSelecionar(escolhida);
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
      <label htmlFor={id} className={ROTULO}>{rotulo}</label>
      <input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={aberto}
        aria-controls={idLista}
        aria-activedescendant={aberto ? idOpcao(indice) : undefined}
        autoComplete="off"
        disabled={desabilitado}
        placeholder={placeholder}
        value={aberto ? busca : selecionada?.rotulo ?? ''}
        onFocus={() => { setAberto(true); setIndice(0); }}
        onClick={() => { setAberto(true); setIndice(0); }}
        onChange={(e) => { setBusca(e.target.value); setAberto(true); setIndice(0); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            setAberto(true);
            setIndice((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + lista.length) % lista.length);
          } else if (e.key === 'Enter' && aberto) {
            e.preventDefault();
            escolher(lista[indice]?.id ?? '');
          } else if (e.key === 'Escape') {
            setAberto(false);
            setBusca('');
          }
        }}
        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:border-[#004276] disabled:bg-slate-100"
      />
      {aberto && (
        <ul
          id={idLista}
          role="listbox"
          aria-label={rotuloLista}
          className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          {lista.map((opcao, i) => (
            <li
              key={opcao.id || 'nenhuma'}
              id={idOpcao(i)}
              role="option"
              aria-selected={opcao.id === selecionadaId}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setIndice(i)}
              onClick={() => escolher(opcao.id)}
              className={`cursor-pointer px-3 py-2.5 text-xs font-semibold ${i === indice ? 'bg-blue-50 text-[#004276]' : 'text-slate-700'}`}
            >
              {opcao.rotulo}
            </li>
          ))}
          {filtradas.length === 0 && <li className="px-3 py-2.5 text-xs text-slate-500">{semResultado}</li>}
        </ul>
      )}
      <p className="mt-1 text-[11px] text-slate-500">{dica}</p>
    </div>
  );
};
