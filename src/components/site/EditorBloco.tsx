// Edição de um bloco.
//
// O formulário é GERADO a partir de CAMPOS_BLOCO[tipo] — não existe um
// componente de formulário por tipo de bloco. O estado é uma cópia local do
// `conteudo`; só sai daqui no "Salvar", para que fechar sem salvar não deixe
// meia edição no ar (lembrando que salvar aqui publica direto no site).

import React, { useState } from 'react';
import { Info, LayoutTemplate, Loader2 } from 'lucide-react';
import { ModalCabecalho } from '../comuns/ModalCabecalho';
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
      <div className="modal-overlay modal-entrada-fundo fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="modal-painel modal-entrada-painel bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          <ModalCabecalho
            icone={LayoutTemplate}
            titulo={def?.rotulo ?? bloco.tipo}
            subtitulo={def?.descricao}
            onFechar={onFechar}
          />

          <div className="modal-corpo campos-modal p-5 space-y-4 overflow-y-auto">
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

          <div className="rodape-modal barra-acoes shrink-0 px-5 pb-5 text-sm">
            <button type="button" onClick={onFechar} className="btn-modal-cancelar">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void salvar()}
              disabled={salvando}
              className="btn-modal-salvar inline-flex items-center gap-2"
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
