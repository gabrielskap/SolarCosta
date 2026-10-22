// Modal para criar uma página nova a partir da Configuração do Site.
//
// Nome e caminho só se definem aqui: depois de criada, a página se edita como
// qualquer outra (SEO, blocos, publicar) na aba Páginas, mas o endereço fica
// fixo — trocar depois quebraria um link do menu ou uma busca já indexada.

import React, { useState } from 'react';
import { FilePlus2, Loader2 } from 'lucide-react';
import { ModalCabecalho } from '../comuns/ModalCabecalho';
import { CAMINHO_VALIDO, slugificar } from '../../services/site';
import { ErroApi } from '../../services/http';

interface Props {
  nomeInicial?: string;
  caminhoInicial?: string;
  onCriar: (dados: { nome: string; caminho: string }) => Promise<void>;
  onFechar: () => void;
}

const CAMPO =
  'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#004276] focus:ring-2 focus:ring-blue-100 transition';

export const NovaPaginaModal: React.FC<Props> = ({
  nomeInicial,
  caminhoInicial,
  onCriar,
  onFechar,
}) => {
  const [nome, setNome] = useState(nomeInicial ?? '');
  const [caminho, setCaminho] = useState(caminhoInicial ?? '');
  // Enquanto o usuário não mexer no endereço manualmente, ele segue o nome.
  const [caminhoEditado, setCaminhoEditado] = useState(!!caminhoInicial);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const mudarNome = (valor: string) => {
    setNome(valor);
    if (!caminhoEditado) setCaminho(valor.trim() ? `/${slugificar(valor)}` : '');
  };

  const valido = nome.trim().length > 0 && CAMINHO_VALIDO.test(caminho);

  const enviar = async () => {
    if (!valido || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await onCriar({ nome: nome.trim(), caminho });
    } catch (e) {
      setErro(e instanceof ErroApi ? e.mensagemCompleta : 'Não foi possível criar a página.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="modal-overlay modal-entrada-fundo fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="modal-painel modal-entrada-painel bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <ModalCabecalho
          icone={FilePlus2}
          titulo="Nova página"
          subtitulo="Entra no site com o endereço que você escolher"
          onFechar={onFechar}
        />

        <div className="modal-corpo campos-modal p-5 space-y-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Nome
            </label>
            <input
              type="text"
              autoFocus
              value={nome}
              onChange={(e) => mudarNome(e.target.value)}
              placeholder="Ex.: Promoção de verão"
              className={CAMPO}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Endereço no site
            </label>
            <input
              type="text"
              value={caminho}
              onChange={(e) => {
                setCaminhoEditado(true);
                setCaminho(e.target.value);
              }}
              placeholder="/promocao-verao"
              className={`${CAMPO} font-mono text-xs`}
            />
            {caminho.length > 0 && !CAMINHO_VALIDO.test(caminho) && (
              <p className="text-[11px] text-amber-700 mt-1">
                Use letras minúsculas, números e hífen, começando com "/". Ex.: /promocao-verao
              </p>
            )}
          </div>

          {erro && (
            <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2.5">
              {erro}
            </p>
          )}
        </div>

        <div className="rodape-modal barra-acoes px-5 pb-5 text-sm">
          <button type="button" onClick={onFechar} className="btn-modal-cancelar">
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void enviar()}
            disabled={!valido || enviando}
            className="btn-modal-salvar inline-flex items-center gap-2"
          >
            {enviando && <Loader2 className="w-4 h-4 animate-spin" />}
            Criar página
          </button>
        </div>
      </div>
    </div>
  );
};
