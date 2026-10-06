// Trilho direito do editor visual: os campos do bloco selecionado.
//
// É o MESMO formulário gerado de EditorBloco, só que num trilho em vez de num
// modal e escrevendo no rascunho em memória em vez de chamar a API. Reaproveita
// camposDe() e <Campo> inteiros — nenhum formulário escrito à mão aqui também.
//
// Por que ele vem antes da edição no lugar, e não depois: o inspetor cobre
// 100% dos campos de 100% dos blocos no dia em que existe. A edição inline
// cobre texto, e só o texto que um componente tenha sido preparado para expor —
// select, booleano, ícone, imagem e link nunca serão editáveis clicando no
// site. Ou seja, o inspetor não é o plano B da edição visual: é o caminho
// completo, e o inline é o atalho confortável por cima dele.

import React, { useState } from 'react';
import { Info, Trash2 } from 'lucide-react';
import { camposDe } from '../../site/blocos/campos';
import { definicao } from '../../site/blocos/registro';
import type { MidiaSite } from '../../site/blocos/tipos';
import type { BlocoAdmin } from '../../services/site';
import { Campo, type ContextoCampos } from './CamposEditor';
import { BibliotecaMidia } from './BibliotecaMidia';

interface Props {
  bloco: BlocoAdmin | null;
  midia: MidiaSite[];
  onMidiaAlterada: (midia: MidiaSite[]) => void;
  onAlterar: (conteudo: Record<string, unknown>) => void;
  onExcluir: () => void;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

export const InspetorBloco: React.FC<Props> = ({
  bloco,
  midia,
  onMidiaAlterada,
  onAlterar,
  onExcluir,
  showToast,
}) => {
  const [escolhendo, setEscolhendo] = useState<((id: string) => void) | null>(null);

  const ctx: ContextoCampos = {
    midia,
    // O wrapper é obrigatório: o setState trataria a própria função como
    // atualizador e a chamaria em vez de guardá-la.
    escolherImagem: (aoEscolher) => setEscolhendo(() => aoEscolher),
  };

  if (!bloco) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <p className="text-xs text-slate-400 text-center leading-relaxed">
          Clique num bloco do site ao lado
          <br />
          para editar o conteúdo dele.
        </p>
      </div>
    );
  }

  const def = definicao(bloco.tipo);
  const campos = camposDe(bloco.tipo);

  return (
    <>
      <div className="flex flex-col h-full">
        <div className="shrink-0 px-4 py-3 border-b border-slate-200 flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-black text-[#004276] truncate">
              {def?.rotulo ?? bloco.tipo}
            </h3>
            {def?.descricao && (
              <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{def.descricao}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onExcluir}
            title="Excluir bloco"
            className="p-1.5 shrink-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {def?.usaDadosDoSistema && (
            <div className="flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-100 p-3 text-[11px] text-[#004276] leading-relaxed">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                Este bloco também mostra dados do sistema — cadastro da empresa, contato ou
                parâmetros de cálculo. Esses valores são editados em Configurações, não aqui.
              </span>
            </div>
          )}

          {campos.length === 0 ? (
            <p className="text-xs text-slate-500">Este tipo de bloco não tem campos editáveis.</p>
          ) : (
            campos.map((campo) => (
              <Campo
                key={campo.chave}
                campo={campo}
                valor={bloco.conteudo[campo.chave]}
                onChange={(v) => onAlterar({ ...bloco.conteudo, [campo.chave]: v })}
                ctx={ctx}
              />
            ))
          )}
        </div>
      </div>

      {escolhendo && (
        <BibliotecaMidia
          midia={midia}
          onMidiaAlterada={onMidiaAlterada}
          showToast={showToast}
          aoEscolher={(id) => {
            escolhendo(id);
            setEscolhendo(null);
          }}
          aoFechar={() => setEscolhendo(null)}
        />
      )}
    </>
  );
};
