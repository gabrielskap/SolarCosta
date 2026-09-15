import React, { useEffect } from 'react';
import { Check, X } from 'lucide-react';

/*
 * Folha inferior para mudar a etapa de um cartão de kanban.
 *
 * Por que existe: os quadros de Leads e de Obras movem cartão com o
 * drag-and-drop nativo do HTML5 (`draggable` + onDragStart/onDrop), que NÃO
 * dispara em toque. No celular, hoje, não há como mudar a etapa de um lead —
 * não é uma questão de ergonomia, a função simplesmente não existe.
 *
 * A saída escolhida não foi portar o arrastar para eventos de ponteiro (nem
 * trazer uma biblioteca de DnD): num quadro de seis colunas, arrastar com o
 * dedo entre colunas que não cabem na tela é pior do que escolher numa lista.
 * Um toque abre, um toque escolhe. O arrastar do desktop fica intacto.
 */

interface SeletorEtapaProps<T extends string> {
  /** Nome do que está sendo movido — o usuário precisa confirmar que é o cartão certo. */
  titulo: string;
  subtitulo?: string;
  etapas: readonly T[];
  etapaAtual: T;
  onEscolher: (etapa: T) => void;
  onFechar: () => void;
}

export function SeletorEtapa<T extends string>({
  titulo,
  subtitulo,
  etapas,
  etapaAtual,
  onEscolher,
  onFechar,
}: SeletorEtapaProps<T>) {
  // Esc fecha, e o fundo para de rolar enquanto a folha está aberta.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFechar();
    };
    document.addEventListener('keydown', aoTeclar);
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', aoTeclar);
      document.body.style.overflow = overflowAnterior;
    };
  }, [onFechar]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onFechar} />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Mover ${titulo}`}
        className="relative w-full sm:max-w-sm bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl
                   max-h-[85dvh] overflow-y-auto area-segura-inferior"
      >
        <div className="sticky top-0 bg-white px-4 pt-4 pb-3 border-b border-slate-100 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Mover para</p>
            <h3 className="font-bold text-slate-900 text-sm truncate">{titulo}</h3>
            {subtitulo && <p className="text-xs text-slate-500 truncate">{subtitulo}</p>}
          </div>
          <button
            onClick={onFechar}
            aria-label="Fechar"
            className="shrink-0 p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-2">
          {etapas.map((etapa) => {
            const atual = etapa === etapaAtual;
            return (
              <button
                key={etapa}
                onClick={() => {
                  if (!atual) onEscolher(etapa);
                  onFechar();
                }}
                disabled={atual}
                className={`w-full flex items-center justify-between gap-3 px-3 py-3 rounded-xl text-sm font-semibold text-left transition
                  ${
                    atual
                      ? 'bg-slate-100 text-slate-400 cursor-default'
                      : 'text-slate-800 hover:bg-blue-50 active:bg-blue-100'
                  }`}
              >
                <span>{etapa}</span>
                {atual && (
                  <span className="flex items-center gap-1 text-[10px] font-bold uppercase shrink-0">
                    <Check className="w-3.5 h-3.5" />
                    atual
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
