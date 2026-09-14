// Uma página do site: SEO no topo, lista de blocos abaixo.
//
// Reordenação por arrastar, no mesmo padrão nativo (HTML5 drag and drop) que o
// Kanban de leads usa, com setas ↑ ↓ ao lado — arrastar é bom com mouse e
// ruim com teclado, e as setas resolvem os dois casos.

import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { Site, type BlocoAdmin, type PaginaAdmin } from '../../services/site';
import { ErroApi } from '../../services/http';
import { REGISTRO_BLOCOS, TIPOS_EM_ORDEM, definicao } from '../../site/blocos/registro';
import type { MidiaSite, TipoBloco } from '../../site/blocos/tipos';
import { EditorBloco } from './EditorBloco';

interface Props {
  pagina: PaginaAdmin;
  midia: MidiaSite[];
  onPaginaAlterada: (pagina: PaginaAdmin) => void;
  onMidiaAlterada: (midia: MidiaSite[]) => void;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

export const EditorPagina: React.FC<Props> = ({
  pagina,
  midia,
  onPaginaAlterada,
  onMidiaAlterada,
  showToast,
}) => {
  const [editando, setEditando] = useState<BlocoAdmin | null>(null);
  const [catalogoAberto, setCatalogoAberto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [arrastando, setArrastando] = useState<string | null>(null);

  const erro = (e: unknown, acao: string) =>
    showToast(acao, 'error', e instanceof ErroApi ? e.mensagemCompleta : 'Erro inesperado.');

  const trocarBlocos = (blocos: BlocoAdmin[]) => onPaginaAlterada({ ...pagina, blocos });

  /* ------------------------------------------------------------ ações -- */

  const adicionar = async (tipo: TipoBloco) => {
    setCatalogoAberto(false);
    setOcupado(true);
    try {
      const novo = await Site.criarBloco(pagina.id, tipo, REGISTRO_BLOCOS[tipo].padrao());
      trocarBlocos([...pagina.blocos, novo]);
      showToast('Bloco adicionado', 'success', REGISTRO_BLOCOS[tipo].rotulo);
      setEditando(novo);
    } catch (e) {
      erro(e, 'Não foi possível adicionar o bloco');
    } finally {
      setOcupado(false);
    }
  };

  const salvarConteudo = async (bloco: BlocoAdmin, conteudo: Record<string, unknown>) => {
    try {
      const atualizado = await Site.salvarBloco(bloco.id, { conteudo });
      trocarBlocos(pagina.blocos.map((b) => (b.id === bloco.id ? atualizado : b)));
      showToast('Bloco salvo', 'success', 'A alteração já está no ar.');
    } catch (e) {
      erro(e, 'Não foi possível salvar o bloco');
      throw e;
    }
  };

  const alternarVisivel = async (bloco: BlocoAdmin) => {
    try {
      const atualizado = await Site.salvarBloco(bloco.id, { visivel: !bloco.visivel });
      trocarBlocos(pagina.blocos.map((b) => (b.id === bloco.id ? atualizado : b)));
      showToast(
        atualizado.visivel ? 'Bloco exibido' : 'Bloco ocultado',
        'info',
        atualizado.visivel ? 'Voltou a aparecer no site.' : 'O texto continua salvo.',
      );
    } catch (e) {
      erro(e, 'Não foi possível alterar a visibilidade');
    }
  };

  const excluir = async (bloco: BlocoAdmin) => {
    const nome = definicao(bloco.tipo)?.rotulo ?? bloco.tipo;
    if (!window.confirm(`Excluir o bloco "${nome}"? O conteúdo dele é perdido.`)) return;
    try {
      await Site.excluirBloco(bloco.id);
      trocarBlocos(pagina.blocos.filter((b) => b.id !== bloco.id));
      showToast('Bloco excluído', 'success', nome);
    } catch (e) {
      erro(e, 'Não foi possível excluir o bloco');
    }
  };

  /** Aplica a nova ordem na tela e manda a lista inteira para o servidor. */
  const reordenar = async (blocos: BlocoAdmin[]) => {
    const anterior = pagina.blocos;
    trocarBlocos(blocos);
    try {
      const salvos = await Site.reordenarBlocos(
        pagina.id,
        blocos.map((b) => b.id),
      );
      trocarBlocos(salvos);
    } catch (e) {
      trocarBlocos(anterior);
      erro(e, 'Não foi possível reordenar');
    }
  };

  const mover = (indice: number, delta: number) => {
    const destino = indice + delta;
    if (destino < 0 || destino >= pagina.blocos.length) return;
    const copia = [...pagina.blocos];
    [copia[indice], copia[destino]] = [copia[destino]!, copia[indice]!];
    void reordenar(copia);
  };

  const soltarEm = (alvoId: string) => {
    if (!arrastando || arrastando === alvoId) return;
    const copia = [...pagina.blocos];
    const de = copia.findIndex((b) => b.id === arrastando);
    const para = copia.findIndex((b) => b.id === alvoId);
    if (de < 0 || para < 0) return;
    const [movido] = copia.splice(de, 1);
    copia.splice(para, 0, movido!);
    setArrastando(null);
    void reordenar(copia);
  };

  /* ----------------------------------------------------------- render -- */

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-black text-[#004276]">{pagina.nome}</h2>
          <p className="text-xs text-slate-500 font-mono">{pagina.caminho}</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={pagina.caminho}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-300 text-slate-600 hover:border-[#004276] hover:text-[#004276] transition"
          >
            Ver no site
          </a>
          <button
            type="button"
            onClick={() => setCatalogoAberto(true)}
            disabled={ocupado}
            className="inline-flex items-center gap-2 bg-[#004276] hover:bg-[#003158] disabled:bg-slate-300 text-white font-bold text-sm px-4 py-2 rounded-xl shadow-sm transition"
          >
            {ocupado ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Adicionar bloco
          </button>
        </div>
      </div>

      {pagina.blocos.length === 0 ? (
        <div className="border border-dashed border-slate-300 rounded-2xl p-10 text-center">
          <p className="text-sm font-bold text-slate-600">Esta página não tem blocos</p>
          <p className="text-xs text-slate-500 mt-1">
            Adicione um bloco para que ela deixe de sair vazia no site.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {pagina.blocos.map((bloco, i) => {
            const def = definicao(bloco.tipo);
            const Icone = def?.Icone;

            return (
              <li
                key={bloco.id}
                draggable
                onDragStart={() => setArrastando(bloco.id)}
                onDragEnd={() => setArrastando(null)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => soltarEm(bloco.id)}
                className={`flex items-center gap-3 bg-white border rounded-xl p-3 transition ${
                  arrastando === bloco.id
                    ? 'border-[#FFD100] opacity-60'
                    : 'border-slate-200 hover:border-slate-300'
                } ${bloco.visivel ? '' : 'bg-slate-50'}`}
              >
                <GripVertical className="w-4 h-4 text-slate-300 cursor-grab shrink-0" />

                <div className="flex flex-col shrink-0">
                  <button
                    type="button"
                    onClick={() => mover(i, -1)}
                    disabled={i === 0}
                    title="Mover para cima"
                    className="text-slate-400 hover:text-[#004276] disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => mover(i, 1)}
                    disabled={i === pagina.blocos.length - 1}
                    title="Mover para baixo"
                    className="text-slate-400 hover:text-[#004276] disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>

                <div
                  className={`p-2 rounded-xl shrink-0 ${
                    bloco.visivel ? 'bg-blue-50 text-[#004276]' : 'bg-slate-200 text-slate-400'
                  }`}
                >
                  {Icone ? <Icone className="w-4 h-4" /> : <span className="block w-4 h-4" />}
                </div>

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-bold truncate ${
                      bloco.visivel ? 'text-slate-800' : 'text-slate-400'
                    }`}
                  >
                    {def?.rotulo ?? bloco.tipo}
                    {!bloco.visivel && ' · oculto'}
                  </p>
                  <p className="text-[11px] text-slate-500 truncate">
                    {def
                      ? resumoDoBloco(bloco)
                      : 'Tipo desconhecido nesta versão — não aparece no site.'}
                  </p>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => void alternarVisivel(bloco)}
                    title={bloco.visivel ? 'Ocultar do site' : 'Exibir no site'}
                    className="p-2 text-slate-400 hover:text-[#004276] rounded-lg hover:bg-slate-50"
                  >
                    {bloco.visivel ? (
                      <Eye className="w-4 h-4" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditando(bloco)}
                    disabled={!def}
                    title="Editar"
                    className="p-2 text-slate-400 hover:text-[#004276] rounded-lg hover:bg-slate-50 disabled:opacity-30"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void excluir(bloco)}
                    title="Excluir"
                    className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* ------------------------------------------------- catálogo --- */}
      {catalogoAberto && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="bg-[#004276] text-white p-4 flex items-center justify-between sticky top-0">
              <h3 className="font-bold text-base">Adicionar bloco em {pagina.nome}</h3>
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
                    onClick={() => void adicionar(tipo)}
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

      {editando && (
        <EditorBloco
          bloco={editando}
          midia={midia}
          onMidiaAlterada={onMidiaAlterada}
          onSalvar={(conteudo) => salvarConteudo(editando, conteudo)}
          onFechar={() => setEditando(null)}
          showToast={showToast}
        />
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
