// Lista de blocos do editor visual: o trilho esquerdo.
//
// Faz o papel que a sobreposição sobre o preview não consegue fazer sozinha:
// mostrar bloco OCULTO (que por definição não aparece no preview), alcançar um
// bloco que esteja fora da área visível, e dar um alvo de teclado para quem não
// usa mouse. É a lista de EditorPagina reduzida ao essencial — sem as chamadas
// à API, porque aqui tudo acontece no rascunho em memória.

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { REGISTRO_BLOCOS, TIPOS_EM_ORDEM, definicao } from '../../site/blocos/registro';
import type { TipoBloco } from '../../site/blocos/tipos';
import type { BlocoAdmin } from '../../services/site';

interface Props {
  blocos: BlocoAdmin[];
  selecionado: string | null;
  onSelecionar: (id: string) => void;
  onReordenar: (blocos: BlocoAdmin[]) => void;
  onAlternarVisivel: (id: string) => void;
  onExcluir: (id: string) => void;
  onAdicionar: (tipo: TipoBloco) => void;
}

export const ArvoreBlocos: React.FC<Props> = ({
  blocos,
  selecionado,
  onSelecionar,
  onReordenar,
  onAlternarVisivel,
  onExcluir,
  onAdicionar,
}) => {
  const [catalogoAberto, setCatalogoAberto] = useState(false);
  const [arrastando, setArrastando] = useState<string | null>(null);

  const mover = (indice: number, delta: number) => {
    const destino = indice + delta;
    if (destino < 0 || destino >= blocos.length) return;
    const copia = [...blocos];
    [copia[indice], copia[destino]] = [copia[destino]!, copia[indice]!];
    onReordenar(copia);
  };

  const soltarEm = (alvoId: string) => {
    if (!arrastando || arrastando === alvoId) return;
    const copia = [...blocos];
    const de = copia.findIndex((b) => b.id === arrastando);
    const para = copia.findIndex((b) => b.id === alvoId);
    if (de < 0 || para < 0) return;
    const [movido] = copia.splice(de, 1);
    copia.splice(para, 0, movido!);
    setArrastando(null);
    onReordenar(copia);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2.5 border-b border-slate-200 shrink-0">
        <button
          type="button"
          onClick={() => setCatalogoAberto(true)}
          className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-bold text-[#004276] border border-dashed border-slate-300 hover:border-[#004276] hover:bg-blue-50/40 rounded-xl px-3 py-2 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Adicionar bloco
        </button>
      </div>

      <ul className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1">
        {blocos.length === 0 && (
          <li className="text-[11px] text-slate-500 text-center px-3 py-8 leading-relaxed">
            Esta página não tem blocos.
            <br />
            Adicione um para ela deixar de sair vazia.
          </li>
        )}

        {blocos.map((bloco, i) => {
          const def = definicao(bloco.tipo);
          const Icone = def?.Icone;
          const ativo = bloco.id === selecionado;

          return (
            <li
              key={bloco.id}
              draggable
              onDragStart={() => setArrastando(bloco.id)}
              onDragEnd={() => setArrastando(null)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => soltarEm(bloco.id)}
              onClick={() => onSelecionar(bloco.id)}
              className={`group flex items-center gap-1.5 rounded-xl px-2 py-2 cursor-pointer border transition ${
                ativo
                  ? 'bg-[#004276] border-[#004276] text-white'
                  : arrastando === bloco.id
                    ? 'border-[#FFD100] opacity-60 bg-white'
                    : 'border-transparent hover:bg-slate-50'
              }`}
            >
              <GripVertical
                className={`w-3.5 h-3.5 shrink-0 cursor-grab ${
                  ativo ? 'text-blue-300' : 'text-slate-300'
                }`}
              />

              {Icone && (
                <Icone
                  className={`w-3.5 h-3.5 shrink-0 ${
                    ativo ? 'text-[#FFD100]' : bloco.visivel ? 'text-[#004276]' : 'text-slate-300'
                  }`}
                />
              )}

              <div className="min-w-0 flex-1">
                <p
                  className={`text-xs font-bold truncate ${
                    ativo ? 'text-white' : bloco.visivel ? 'text-slate-700' : 'text-slate-400'
                  }`}
                >
                  {def?.rotulo ?? bloco.tipo}
                </p>
                <p
                  className={`text-[10px] truncate ${ativo ? 'text-blue-200' : 'text-slate-400'}`}
                >
                  {bloco.visivel ? resumoDoBloco(bloco) : 'oculto no site'}
                </p>
              </div>

              {/* Os controles só aparecem no hover ou no bloco ativo: a lista
                  fica legível quando se está só procurando onde clicar. */}
              <div
                className={`flex items-center shrink-0 ${
                  ativo ? '' : 'opacity-0 group-hover:opacity-100'
                } transition`}
              >
                <div className="flex flex-col">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      mover(i, -1);
                    }}
                    disabled={i === 0}
                    title="Mover para cima"
                    className={`disabled:opacity-20 ${ativo ? 'text-blue-200 hover:text-white' : 'text-slate-400 hover:text-[#004276]'}`}
                  >
                    <ChevronUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      mover(i, 1);
                    }}
                    disabled={i === blocos.length - 1}
                    title="Mover para baixo"
                    className={`disabled:opacity-20 ${ativo ? 'text-blue-200 hover:text-white' : 'text-slate-400 hover:text-[#004276]'}`}
                  >
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onAlternarVisivel(bloco.id);
                  }}
                  title={bloco.visivel ? 'Ocultar do site' : 'Exibir no site'}
                  className={`p-1 rounded ${ativo ? 'text-blue-200 hover:text-white' : 'text-slate-400 hover:text-[#004276]'}`}
                >
                  {bloco.visivel ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onExcluir(bloco.id);
                  }}
                  title="Excluir"
                  className={`p-1 rounded ${ativo ? 'text-blue-200 hover:text-rose-300' : 'text-slate-400 hover:text-rose-600'}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {catalogoAberto && (
        <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="bg-[#004276] text-white p-4 flex items-center justify-between sticky top-0">
              <h3 className="font-bold text-base">Adicionar bloco</h3>
              <button
                onClick={() => setCatalogoAberto(false)}
                className="text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 grid gap-2 sm:grid-cols-2">
              {TIPOS_EM_ORDEM.map((tipo) => {
                const def = REGISTRO_BLOCOS[tipo];
                return (
                  <button
                    key={tipo}
                    type="button"
                    onClick={() => {
                      setCatalogoAberto(false);
                      onAdicionar(tipo);
                    }}
                    className="flex items-start gap-3 text-left p-3 rounded-xl border border-slate-200 hover:border-[#004276] hover:bg-blue-50/40 transition"
                  >
                    <div className="p-2 rounded-xl bg-blue-50 text-[#004276] shrink-0">
                      <def.Icone className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800">{def.rotulo}</p>
                      <p className="text-[11px] text-slate-500 leading-snug">{def.descricao}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/** Primeira linha de texto do bloco, para reconhecê-lo sem abrir. */
function resumoDoBloco(bloco: BlocoAdmin): string {
  const c = bloco.conteudo ?? {};
  for (const chave of ['titulo', 'titulo_cadastro', 'entrada_titulo', 'rotulo', 'texto']) {
    const v = c[chave];
    if (typeof v === 'string' && v.trim()) return v;
  }
  return 'Sem título';
}
