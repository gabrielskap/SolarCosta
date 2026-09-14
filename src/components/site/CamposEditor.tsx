// Controles do editor de bloco, um por tipo de campo.
//
// É isto que evita escrever um formulário à mão para cada um dos 14 tipos de
// bloco: EditorBloco percorre CAMPOS_BLOCO[tipo] e delega cada campo aqui.
// Campo novo num bloco = uma linha em campos.ts.

import React from 'react';
import { ChevronDown, ChevronUp, ImageIcon, Plus, Trash2, X } from 'lucide-react';
import type { CampoEditor } from '../../site/blocos/campos';
import { NOMES_ICONES, icone as resolverIcone } from '../../site/blocos/icones';
import { urlMidia, type MidiaSite } from '../../site/blocos/tipos';

const ROTULO = 'block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1';
const CAMPO =
  'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#004276] focus:ring-2 focus:ring-blue-100 transition';

export interface ContextoCampos {
  midia: MidiaSite[];
  /** Abre a biblioteca; devolve o id escolhido pelo callback. */
  escolherImagem: (aoEscolher: (id: string) => void) => void;
}

interface Props {
  campo: CampoEditor;
  valor: unknown;
  onChange: (valor: unknown) => void;
  ctx: ContextoCampos;
}

/* ------------------------------------------------------------ auxiliares -- */

const Ajuda: React.FC<{ texto?: string }> = ({ texto }) =>
  texto ? <p className="text-[11px] text-slate-500 mt-1 leading-snug">{texto}</p> : null;

/** Seletor de imagem: miniatura, trocar e remover. */
const CampoImagem: React.FC<{
  valor: string | null;
  onChange: (v: string | null) => void;
  ctx: ContextoCampos;
}> = ({ valor, onChange, ctx }) => {
  const url = urlMidia(valor);
  const meta = ctx.midia.find((m) => m.id === valor);

  return (
    <div className="flex items-center gap-3">
      <div className="w-20 h-16 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center shrink-0">
        {url ? (
          <img src={url} alt="" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="w-5 h-5 text-slate-300" />
        )}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-slate-600 truncate">
          {meta ? meta.nomeArquivo : 'Nenhuma imagem escolhida'}
        </p>
        <div className="flex gap-2 mt-1.5">
          <button
            type="button"
            onClick={() => ctx.escolherImagem((id) => onChange(id))}
            className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-300 hover:border-[#004276] hover:text-[#004276] transition"
          >
            {valor ? 'Trocar' : 'Escolher'}
          </button>
          {valor && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-slate-300 text-slate-500 hover:border-rose-400 hover:text-rose-600 transition"
            >
              Remover
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

/** Lista de strings simples (itens inclusos, parágrafos, bullets). */
const CampoParagrafos: React.FC<{
  valor: string[];
  onChange: (v: string[]) => void;
}> = ({ valor, onChange }) => {
  const itens = Array.isArray(valor) ? valor : [];

  return (
    <div className="space-y-2">
      {itens.map((t, i) => (
        <div key={i} className="flex gap-2">
          <textarea
            rows={2}
            value={t}
            onChange={(e) => {
              const copia = [...itens];
              copia[i] = e.target.value;
              onChange(copia);
            }}
            className={CAMPO}
          />
          <button
            type="button"
            onClick={() => onChange(itens.filter((_, j) => j !== i))}
            title="Remover"
            className="px-2 rounded-xl border border-slate-200 text-slate-400 hover:border-rose-300 hover:text-rose-600 transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...itens, ''])}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#004276] hover:underline"
      >
        <Plus className="w-3.5 h-3.5" />
        Adicionar linha
      </button>
    </div>
  );
};

/** Lista de objetos: cada item abre um mini-formulário com os campos filhos. */
const CampoLista: React.FC<{
  campo: CampoEditor;
  valor: Record<string, unknown>[];
  onChange: (v: Record<string, unknown>[]) => void;
  ctx: ContextoCampos;
}> = ({ campo, valor, onChange, ctx }) => {
  const itens = Array.isArray(valor) ? valor : [];
  const filhos = campo.campos ?? [];

  const trocar = (i: number, chave: string, v: unknown) => {
    const copia = [...itens];
    copia[i] = { ...copia[i], [chave]: v };
    onChange(copia);
  };

  const mover = (i: number, delta: number) => {
    const destino = i + delta;
    if (destino < 0 || destino >= itens.length) return;
    const copia = [...itens];
    [copia[i], copia[destino]] = [copia[destino]!, copia[i]!];
    onChange(copia);
  };

  return (
    <div className="space-y-3">
      {itens.map((item, i) => (
        <div key={i} className="border border-slate-200 rounded-xl overflow-hidden">
          <div className="flex items-center justify-between bg-slate-50 px-3 py-2 border-b border-slate-200">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              {campo.rotuloItem ?? 'Item'} {i + 1}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => mover(i, -1)}
                disabled={i === 0}
                title="Mover para cima"
                className="p-1 text-slate-400 hover:text-[#004276] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => mover(i, 1)}
                disabled={i === itens.length - 1}
                title="Mover para baixo"
                className="p-1 text-slate-400 hover:text-[#004276] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onChange(itens.filter((_, j) => j !== i))}
                title="Remover"
                className="p-1 text-slate-400 hover:text-rose-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-3 space-y-3">
            {filhos.map((f) => (
              <Campo
                key={f.chave}
                campo={f}
                valor={item[f.chave]}
                onChange={(v) => trocar(i, f.chave, v)}
                ctx={ctx}
              />
            ))}
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...itens, campo.novoItem ? campo.novoItem() : {}])}
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#004276] hover:underline"
      >
        <Plus className="w-3.5 h-3.5" />
        Adicionar {(campo.rotuloItem ?? 'item').toLowerCase()}
      </button>
    </div>
  );
};

/* ---------------------------------------------------------------- campo -- */

export const Campo: React.FC<Props> = ({ campo, valor, onChange, ctx }) => {
  // O booleano põe o rótulo à direita da caixa; os demais, acima do controle.
  if (campo.tipo === 'booleano') {
    return (
      <label className="flex items-start gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={!!valor}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 accent-[#004276]"
        />
        <span className="min-w-0">
          <span className="block text-xs font-bold text-slate-700">{campo.rotulo}</span>
          <Ajuda texto={campo.ajuda} />
        </span>
      </label>
    );
  }

  return (
    <div>
      <label className={ROTULO}>{campo.rotulo}</label>

      {campo.tipo === 'texto' && (
        <input
          type="text"
          value={(valor as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={CAMPO}
        />
      )}

      {campo.tipo === 'texto_longo' && (
        <textarea
          rows={3}
          value={(valor as string) ?? ''}
          onChange={(e) => onChange(e.target.value)}
          className={CAMPO}
        />
      )}

      {campo.tipo === 'paragrafos' && (
        <CampoParagrafos valor={valor as string[]} onChange={onChange} />
      )}

      {campo.tipo === 'selecao' && (
        <select
          value={String(valor ?? '')}
          onChange={(e) => {
            const op = campo.opcoes?.find((o) => String(o.valor) === e.target.value);
            onChange(op ? op.valor : e.target.value);
          }}
          className={CAMPO}
        >
          {(campo.opcoes ?? []).map((o) => (
            <option key={String(o.valor)} value={String(o.valor)}>
              {o.rotulo}
            </option>
          ))}
        </select>
      )}

      {campo.tipo === 'icone' && (
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-blue-50 text-[#004276] shrink-0">
            {React.createElement(resolverIcone(valor), { className: 'w-5 h-5' })}
          </div>
          <select
            value={(valor as string) ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className={CAMPO}
          >
            <option value="">Sem ícone</option>
            {NOMES_ICONES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      )}

      {campo.tipo === 'imagem' && (
        <CampoImagem valor={(valor as string) ?? null} onChange={onChange} ctx={ctx} />
      )}

      {campo.tipo === 'link' && (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Texto do link"
            value={((valor as any)?.rotulo as string) ?? ''}
            onChange={(e) => onChange({ ...(valor as object), rotulo: e.target.value })}
            className={CAMPO}
          />
          <input
            type="text"
            placeholder="/contato"
            value={((valor as any)?.destino as string) ?? ''}
            onChange={(e) => onChange({ ...(valor as object), destino: e.target.value })}
            className={CAMPO}
          />
        </div>
      )}

      {campo.tipo === 'lista' && (
        <CampoLista
          campo={campo}
          valor={valor as Record<string, unknown>[]}
          onChange={onChange}
          ctx={ctx}
        />
      )}

      {campo.tipo !== 'lista' && <Ajuda texto={campo.ajuda} />}
    </div>
  );
};
