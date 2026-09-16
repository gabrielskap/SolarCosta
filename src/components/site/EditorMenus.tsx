// Menus do site: cabeçalho e as duas colunas do rodapé.
//
// Antes do CMS, os mesmos links estavam escritos em dois arquivos
// (SiteHeader.tsx e SiteFooter.tsx) e mudar o menu exigia editar os dois.
// Agora há uma lista só, e quem lê é o site.

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Eye, EyeOff, FilePlus2, Plus, Star, Trash2 } from 'lucide-react';
import { CAMINHO_VALIDO, Site, type ItemMenuAdmin, type MenuAdmin, type PaginaAdmin } from '../../services/site';
import { ErroApi } from '../../services/http';

interface Props {
  menus: MenuAdmin[];
  paginas: PaginaAdmin[];
  onMenusAlterados: (menus: MenuAdmin[]) => void;
  /** Abre o modal de nova página com nome/caminho já sugeridos pelo link. */
  onCriarPagina: (sugestao: { nome: string; caminho: string }) => void;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

const CAMPO =
  'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#004276] focus:ring-2 focus:ring-blue-100 transition';

export const EditorMenus: React.FC<Props> = ({
  menus,
  paginas,
  onMenusAlterados,
  onCriarPagina,
  showToast,
}) => {
  const erro = (e: unknown, acao: string) =>
    showToast(acao, 'error', e instanceof ErroApi ? e.mensagemCompleta : 'Erro inesperado.');

  const trocarItens = (chave: string, itens: ItemMenuAdmin[]) =>
    onMenusAlterados(menus.map((m) => (m.chave === chave ? { ...m, itens } : m)));

  const adicionar = async (menu: MenuAdmin) => {
    try {
      const item = await Site.criarItemMenu(menu.chave, { rotulo: 'Novo link', destino: '/' });
      trocarItens(menu.chave, [...menu.itens, item]);
    } catch (e) {
      erro(e, 'Não foi possível adicionar o link');
    }
  };

  /** Salva no blur: digitar com salvamento a cada tecla brigaria com o servidor. */
  const salvar = async (
    menu: MenuAdmin,
    item: ItemMenuAdmin,
    dados: Parameters<typeof Site.salvarItemMenu>[1],
  ) => {
    try {
      const atualizado = await Site.salvarItemMenu(item.id, dados);
      trocarItens(
        menu.chave,
        menu.itens.map((i) => (i.id === item.id ? atualizado : i)),
      );
    } catch (e) {
      erro(e, 'Não foi possível salvar o link');
    }
  };

  const excluir = async (menu: MenuAdmin, item: ItemMenuAdmin) => {
    if (!window.confirm(`Remover o link "${item.rotulo}" do ${menu.nome.toLowerCase()}?`)) return;
    try {
      await Site.excluirItemMenu(item.id);
      trocarItens(
        menu.chave,
        menu.itens.filter((i) => i.id !== item.id),
      );
      showToast('Link removido', 'success', item.rotulo);
    } catch (e) {
      erro(e, 'Não foi possível remover o link');
    }
  };

  const mover = async (menu: MenuAdmin, indice: number, delta: number) => {
    const destino = indice + delta;
    if (destino < 0 || destino >= menu.itens.length) return;

    const copia = [...menu.itens];
    [copia[indice], copia[destino]] = [copia[destino]!, copia[indice]!];
    trocarItens(menu.chave, copia);

    try {
      const salvos = await Site.reordenarMenu(
        menu.chave,
        copia.map((i) => i.id),
      );
      trocarItens(menu.chave, salvos);
    } catch (e) {
      trocarItens(menu.chave, menu.itens);
      erro(e, 'Não foi possível reordenar');
    }
  };

  return (
    <div className="space-y-6">
      {menus.map((menu) => (
        <div key={menu.chave} className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <div>
              <h3 className="text-base font-black text-[#004276]">{menu.nome}</h3>
              {menu.descricao && <p className="text-xs text-slate-500 mt-0.5">{menu.descricao}</p>}
            </div>
            <button
              type="button"
              onClick={() => void adicionar(menu)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[#004276] border border-slate-300 hover:border-[#004276] rounded-xl px-3 py-2 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar link
            </button>
          </div>

          {menu.itens.length === 0 ? (
            <p className="text-sm text-slate-500">
              Sem links. O site usa a lista de fábrica enquanto este menu estiver vazio.
            </p>
          ) : (
            <ul className="space-y-2">
              {menu.itens.map((item, i) => (
                <ItemLinha
                  key={item.id}
                  item={item}
                  paginaExiste={paginas.some((p) => p.caminho === item.destino)}
                  primeiro={i === 0}
                  ultimo={i === menu.itens.length - 1}
                  destaqueDisponivel={menu.chave === 'principal'}
                  onMover={(delta) => void mover(menu, i, delta)}
                  onSalvar={(dados) => void salvar(menu, item, dados)}
                  onExcluir={() => void excluir(menu, item)}
                  onCriarPagina={() => onCriarPagina({ nome: item.rotulo, caminho: item.destino })}
                />
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
};

/* ---------------------------------------------------------------- item -- */

const ItemLinha: React.FC<{
  item: ItemMenuAdmin;
  paginaExiste: boolean;
  primeiro: boolean;
  ultimo: boolean;
  destaqueDisponivel: boolean;
  onMover: (delta: number) => void;
  onSalvar: (dados: Parameters<typeof Site.salvarItemMenu>[1]) => void;
  onExcluir: () => void;
  onCriarPagina: () => void;
}> = ({
  item,
  paginaExiste,
  primeiro,
  ultimo,
  destaqueDisponivel,
  onMover,
  onSalvar,
  onExcluir,
  onCriarPagina,
}) => {
  const [rotulo, setRotulo] = useState(item.rotulo);
  const [destino, setDestino] = useState(item.destino);

  // Só sugere criar página para um caminho interno de verdade — URL externa
  // (wa.me, https://...) ou âncora não tem por que virar página do CMS.
  const semPagina = !paginaExiste && CAMINHO_VALIDO.test(item.destino);

  return (
    <li className="border border-slate-200 rounded-xl p-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-col shrink-0">
          <button
            type="button"
            onClick={() => onMover(-1)}
            disabled={primeiro}
            title="Mover para cima"
            className="text-slate-400 hover:text-[#004276] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onMover(1)}
            disabled={ultimo}
            title="Mover para baixo"
            className="text-slate-400 hover:text-[#004276] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        <input
          type="text"
          value={rotulo}
          onChange={(e) => setRotulo(e.target.value)}
          onBlur={() => rotulo !== item.rotulo && onSalvar({ rotulo })}
          placeholder="Texto do link"
          className={`${CAMPO} flex-1 min-w-[10rem]`}
        />
        <input
          type="text"
          value={destino}
          onChange={(e) => setDestino(e.target.value)}
          onBlur={() => destino !== item.destino && onSalvar({ destino })}
          placeholder="/servicos"
          className={`${CAMPO} flex-1 min-w-[10rem] font-mono text-xs`}
        />

        <div className="flex items-center gap-1 shrink-0">
          {destaqueDisponivel && (
            <button
              type="button"
              onClick={() => onSalvar({ destaque: !item.destaque })}
              title={item.destaque ? 'Deixar de ser o botão de destaque' : 'Usar como botão amarelo'}
              className={`p-2 rounded-lg hover:bg-slate-50 ${
                item.destaque ? 'text-[#FFD100]' : 'text-slate-300 hover:text-slate-500'
              }`}
            >
              <Star className="w-4 h-4" fill={item.destaque ? 'currentColor' : 'none'} />
            </button>
          )}
          <button
            type="button"
            onClick={() => onSalvar({ visivel: !item.visivel })}
            title={item.visivel ? 'Ocultar do site' : 'Exibir no site'}
            className="p-2 text-slate-400 hover:text-[#004276] rounded-lg hover:bg-slate-50"
          >
            {item.visivel ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onExcluir}
            title="Remover"
            className="p-2 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {semPagina && (
        <div className="flex flex-wrap items-center justify-between gap-2 mt-2 pt-2 border-t border-dashed border-amber-200">
          <p className="text-[11px] text-amber-700">
            Não existe página em <span className="font-mono">{item.destino}</span> — quem clicar
            cai em "página não encontrada".
          </p>
          <button
            type="button"
            onClick={onCriarPagina}
            className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 hover:text-amber-950 shrink-0"
          >
            <FilePlus2 className="w-3.5 h-3.5" />
            Criar página
          </button>
        </div>
      )}
    </li>
  );
};
