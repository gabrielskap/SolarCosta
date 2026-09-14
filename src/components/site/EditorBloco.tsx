// Edição de um bloco.
//
// O formulário é GERADO a partir de CAMPOS_BLOCO[tipo] — não existe um
// componente de formulário por tipo de bloco. O estado é uma cópia local do
// `conteudo`; só sai daqui no "Salvar", para que fechar sem salvar não deixe
// meia edição no ar (lembrando que salvar aqui publica direto no site).

import React, { useState } from 'react';
import { Info, Loader2, X } from 'lucide-react';
import { camposDe } from '../../site/blocos/campos';
import { definicao } from '../../site/blocos/registro';
import type { MidiaSite } from '../../site/blocos/tipos';
import type { BlocoAdmin } from '../../services/site';
import { Campo, type ContextoCampos } from './CamposEditor';
import { BibliotecaMidia } from './BibliotecaMidia';

interface Props {
  bloco: BlocoAdmin;
  midia: MidiaSite[];
  onMidiaAlterada: (midia: MidiaSite[]) => void;
  onSalvar: (conteudo: Record<string, unknown>) => Promise<void>;
  onFechar: () => void;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

export const EditorBloco: React.FC<Props> = ({
  bloco,
  midia,
  onMidiaAlterada,
  onSalvar,
  onFechar,
  showToast,
}) => {
  const def = definicao(bloco.tipo);
  const campos = camposDe(bloco.tipo);

  const [conteudo, setConteudo] = useState<Record<string, unknown>>({ ...bloco.conteudo });
  const [salvando, setSalvando] = useState(false);
  // Guarda o callback que recebe o id escolhido na biblioteca.
  const [escolhendo, setEscolhendo] = useState<((id: string) => void) | null>(null);

  const ctx: ContextoCampos = {
    midia,
    // O setState de função precisa do wrapper: React trataria a própria função
    // como atualizador e a chamaria em vez de guardá-la.
    escolherImagem: (aoEscolher) => setEscolhendo(() => aoEscolher),
  };

  const salvar = async () => {
    setSalvando(true);
    try {
      await onSalvar(conteudo);
      onFechar();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
          <div className="bg-[#004276] text-white p-4 flex items-center justify-between shrink-0">
            <div>
              <h3 className="font-bold text-base">{def?.rotulo ?? bloco.tipo}</h3>
              {def?.descricao && (
                <p className="text-[11px] text-blue-200 mt-0.5">{def.descricao}</p>
              )}
            </div>
            <button onClick={onFechar} className="text-slate-300 hover:text-white shrink-0">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-5 space-y-4 overflow-y-auto">
            {def?.usaDadosDoSistema && (
              <div className="flex items-start gap-2 rounded-xl bg-blue-50 border border-blue-100 p-3 text-xs text-[#004276] leading-relaxed">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  Este bloco também mostra dados do sistema — cadastro da empresa, contato ou
                  parâmetros de cálculo. Esses valores são editados em Configurações, não aqui.
                </span>
              </div>
            )}

            {campos.length === 0 ? (
              <p className="text-sm text-slate-500">
                Este tipo de bloco não tem campos editáveis.
              </p>
            ) : (
              campos.map((campo) => (
                <Campo
                  key={campo.chave}
                  campo={campo}
                  valor={conteudo[campo.chave]}
                  onChange={(v) => setConteudo((prev) => ({ ...prev, [campo.chave]: v }))}
                  ctx={ctx}
                />
              ))
            )}
          </div>

          <div className="flex justify-end gap-2 p-4 border-t border-slate-100 shrink-0">
            <button
              type="button"
              onClick={onFechar}
              className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-sm text-slate-600 hover:bg-slate-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void salvar()}
              disabled={salvando}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#004276] hover:bg-[#003158] disabled:bg-slate-300 text-white font-bold text-sm rounded-xl shadow"
            >
              {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
              Salvar e publicar
            </button>
          </div>
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
