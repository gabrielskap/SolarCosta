import React, { useEffect, useRef, useState } from 'react';
import { FileText, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { ErroApi } from '../../services/http';
import { WhatsApp, type DadosModelo, type ModeloMensagem } from '../../services/whatsapp';
import { BotoesMarcador, inserirMarcador, PreviaMensagem } from './PreviaMensagem';

/*
 * Modelos de mensagem.
 *
 * Até aqui os quatro modelos vinham semeados no V009 e mudá-los exigia SQL à
 * mão — o README do servidor listava isso como lacuna. O motivo de existirem é
 * o mesmo do resto do CRM: sem modelo cada vendedor manda um texto diferente, e
 * a empresa fala com voz de dez pessoas.
 *
 * O `contexto` não é decoração: é ele que decide onde o modelo aparece. Um
 * modelo de `proposta` só é oferecido quando há uma proposta anexada, porque
 * {{validade}} e {{economia_mensal}} não existem fora dela e sairiam vazios.
 */

interface Props {
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

const CONTEXTOS: { id: ModeloMensagem['contexto']; rotulo: string; ajuda: string }[] = [
  { id: 'proposta', rotulo: 'Proposta', ajuda: 'Aparece quando há uma proposta anexada.' },
  { id: 'contrato', rotulo: 'Contrato', ajuda: 'Aparece quando há um contrato anexado.' },
  { id: 'lead', rotulo: 'Lead', ajuda: 'Primeiro contato, sem documento anexado.' },
  { id: 'livre', rotulo: 'Livre', ajuda: 'Disponível em qualquer envio sem anexo.' },
];

const CAMPO =
  'w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#004276] focus:ring-2 focus:ring-blue-100 transition';
const ROTULO = 'block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1';

const novoModelo = (): DadosModelo => ({
  nome: '',
  contexto: 'livre',
  texto: '',
  ordem: 0,
  ativo: true,
});

export const AbaModelos: React.FC<Props> = ({ showToast }) => {
  const [modelos, setModelos] = useState<ModeloMensagem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  /** `null` = modal fechado. `id` nulo dentro dele = modelo novo. */
  const [editando, setEditando] = useState<{ id: string | null; dados: DadosModelo } | null>(null);
  const [salvando, setSalvando] = useState(false);
  const campoTexto = useRef<HTMLTextAreaElement>(null);

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      // Com os inativos: sem eles não haveria como reativar o que foi desligado.
      setModelos(await WhatsApp.modelos(undefined, true));
    } catch (e) {
      setErro(e instanceof ErroApi ? e.mensagemCompleta : 'Não foi possível carregar os modelos.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
  }, []);

  const salvar = async () => {
    if (!editando) return;
    const { id, dados } = editando;

    if (!dados.nome.trim()) {
      showToast('Informe o nome', 'error', 'É por ele que o modelo aparece no seletor de envio.');
      return;
    }
    if (!dados.texto.trim()) {
      showToast('Mensagem vazia', 'error', 'Escreva o texto que o cliente vai receber.');
      return;
    }

    setSalvando(true);
    try {
      if (id) {
        await WhatsApp.atualizarModelo(id, dados);
      } else {
        await WhatsApp.criarModelo(dados);
      }
      showToast(id ? 'Modelo salvo' : 'Modelo criado', 'success');
      setEditando(null);
      await carregar();
    } catch (e) {
      showToast(
        'Não foi possível salvar',
        'error',
        e instanceof ErroApi ? e.mensagemCompleta : undefined,
      );
    } finally {
      setSalvando(false);
    }
  };

  const alternar = async (m: ModeloMensagem) => {
    // Otimista: o toggle responde na hora e volta atrás se a API recusar —
    // esperar a resposta faria o botão parecer travado.
    setModelos((atuais) =>
      atuais.map((x) => (x.id === m.id ? { ...x, ativo: !x.ativo } : x)),
    );
    try {
      await WhatsApp.alternarModelo(m.id, !m.ativo);
    } catch (e) {
      setModelos((atuais) => atuais.map((x) => (x.id === m.id ? { ...x, ativo: m.ativo } : x)));
      showToast(
        'Não foi possível atualizar',
        'error',
        e instanceof ErroApi ? e.mensagemCompleta : undefined,
      );
    }
  };

  const excluir = async (m: ModeloMensagem) => {
    if (
      !window.confirm(
        `Excluir o modelo "${m.nome}"? As mensagens já enviadas com ele não mudam — o texto foi gravado no histórico.`,
      )
    ) {
      return;
    }
    try {
      await WhatsApp.excluirModelo(m.id);
      showToast('Modelo excluído', 'info');
      await carregar();
    } catch (e) {
      showToast(
        'Não foi possível excluir',
        'error',
        e instanceof ErroApi ? e.mensagemCompleta : undefined,
      );
    }
  };

  /* ------------------------------------------------------------- tela -- */

  if (carregando) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="w-6 h-6 text-[#004276] animate-spin" />
        <p className="text-sm font-semibold text-slate-500">Carregando modelos…</p>
      </div>
    );
  }

  if (erro) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
        <p className="text-sm text-slate-600 mb-4">{erro}</p>
        <button
          onClick={() => void carregar()}
          className="px-4 py-2 rounded-xl bg-[#004276] text-white text-sm font-bold hover:bg-[#003158]"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setEditando({ id: null, dados: novoModelo() })}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#004276] text-white text-sm font-bold hover:bg-[#003158] transition"
        >
          <Plus className="w-4 h-4" />
          Novo modelo
        </button>
      </div>

      {modelos.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl py-16 text-center text-slate-400">
          <FileText className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhum modelo cadastrado.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {modelos.map((m) => (
            <article key={m.id} className="bg-white border border-slate-200 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-extrabold text-slate-900 truncate">{m.nome}</h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    {CONTEXTOS.find((c) => c.id === m.contexto)?.rotulo ?? m.contexto} · ordem{' '}
                    {m.ordem}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void alternar(m)}
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-lg shrink-0 transition ${
                    m.ativo
                      ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}
                >
                  {m.ativo ? 'Ativo' : 'Inativo'}
                </button>
              </div>

              <p className="text-sm text-slate-600 mt-2 line-clamp-3 whitespace-pre-wrap break-words">
                {m.texto}
              </p>

              <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() =>
                    setEditando({
                      id: m.id,
                      dados: {
                        nome: m.nome,
                        contexto: m.contexto,
                        texto: m.texto,
                        ordem: m.ordem,
                        ativo: m.ativo,
                      },
                    })
                  }
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#004276] hover:bg-blue-50 px-2 py-1.5 rounded-lg transition"
                >
                  <Pencil className="w-3.5 h-3.5" />
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => void excluir(m)}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 px-2 py-1.5 rounded-lg transition"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Excluir
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* ------------------------------------------------------- editor -- */}
      {editando && (
        <div className="modal-overlay fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="modal-painel bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden">
            <div className="modal-cabecalho bg-[#004276] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <FileText className="w-5 h-5 text-[#FFD100]" />
                <h2 className="font-bold text-sm">
                  {editando.id ? 'Editar modelo' : 'Novo modelo'}
                </h2>
              </div>
              <button
                onClick={() => setEditando(null)}
                className="text-blue-200 hover:text-white p-1"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-corpo p-5 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-3">
                  <div>
                    <label className={ROTULO} htmlFor="modelo-nome">
                      Nome do modelo
                    </label>
                    <input
                      id="modelo-nome"
                      value={editando.dados.nome}
                      onChange={(e) =>
                        setEditando({
                          ...editando,
                          dados: { ...editando.dados, nome: e.target.value },
                        })
                      }
                      maxLength={80}
                      placeholder="Envio de proposta"
                      className={CAMPO}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={ROTULO} htmlFor="modelo-contexto">
                        Contexto
                      </label>
                      <select
                        id="modelo-contexto"
                        value={editando.dados.contexto}
                        onChange={(e) =>
                          setEditando({
                            ...editando,
                            dados: {
                              ...editando.dados,
                              contexto: e.target.value as ModeloMensagem['contexto'],
                            },
                          })
                        }
                        className={CAMPO}
                      >
                        {CONTEXTOS.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.rotulo}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={ROTULO} htmlFor="modelo-ordem">
                        Ordem
                      </label>
                      <input
                        id="modelo-ordem"
                        type="number"
                        min={0}
                        max={999}
                        value={editando.dados.ordem}
                        onChange={(e) =>
                          setEditando({
                            ...editando,
                            dados: { ...editando.dados, ordem: Number(e.target.value) || 0 },
                          })
                        }
                        className={CAMPO}
                      />
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    {CONTEXTOS.find((c) => c.id === editando.dados.contexto)?.ajuda}
                  </p>

                  <div>
                    <label className={ROTULO} htmlFor="modelo-texto">
                      Mensagem
                    </label>
                    <BotoesMarcador
                      onInserir={(m) =>
                        inserirMarcador(campoTexto.current, editando.dados.texto, m, (texto) =>
                          setEditando({ ...editando, dados: { ...editando.dados, texto } }),
                        )
                      }
                    />
                    <textarea
                      id="modelo-texto"
                      ref={campoTexto}
                      rows={9}
                      value={editando.dados.texto}
                      onChange={(e) =>
                        setEditando({
                          ...editando,
                          dados: { ...editando.dados, texto: e.target.value },
                        })
                      }
                      className={CAMPO}
                    />
                  </div>

                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={editando.dados.ativo}
                      onChange={(e) =>
                        setEditando({
                          ...editando,
                          dados: { ...editando.dados, ativo: e.target.checked },
                        })
                      }
                      className="rounded border-slate-300"
                    />
                    Modelo ativo
                  </label>
                </div>

                <div>
                  <span className={ROTULO}>Pré-visualização</span>
                  <PreviaMensagem
                    texto={editando.dados.texto}
                    vazio="O texto do modelo aparece aqui…"
                  />
                  <p className="text-[11px] text-slate-500 mt-2">
                    Os campos destacados são trocados no envio pelo dado real do cliente e do
                    documento. Marcador que não existe simplesmente some da mensagem.
                  </p>
                </div>
              </div>

              <div className="barra-acoes flex items-center justify-end gap-2 pt-5 bg-white">
                <button
                  type="button"
                  onClick={() => setEditando(null)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void salvar()}
                  disabled={salvando}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#004276] text-white text-sm font-bold hover:bg-[#003158] disabled:opacity-40 transition"
                >
                  {salvando && <Loader2 className="w-4 h-4 animate-spin" />}
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
