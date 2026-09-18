import React, { useEffect, useState } from 'react';
import {
  CheckCheck, Clock, FileText, History, Loader2, RefreshCw, ScrollText, X, XCircle,
} from 'lucide-react';
import { ErroApi } from '../../services/http';
import {
  WhatsApp,
  type EnvioRegistrado,
  type StatusMensagem,
} from '../../services/whatsapp';
import { maskPhone } from '../../utils/format';

/*
 * O que saiu, na ordem em que saiu.
 *
 * Não existe tabela de "fila de notificações" e não precisa existir: toda
 * mensagem enviada já grava uma linha em SolarCosta_WhatsAppMensagens com o
 * status traduzido da uazapi, o erro quando falhou, quem clicou em enviar e
 * qual documento aquele envio entregou. Esta aba só lê isso de lado — o
 * vendedor quer ver "o que eu mandei hoje", não abrir dez conversas para
 * descobrir.
 *
 * O status avança sozinho: quem o atualiza é o evento `messages_update` do
 * webhook, não esta tela. Por isso existe o botão Atualizar em vez de polling —
 * uma lista de histórico não muda a cada oito segundos como uma conversa aberta.
 */

interface Props {
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
  /** Muda quando a aba Enviar termina um envio, forçando uma recarga. */
  recarregarEm: number;
}

const PAGINA = 50;

const STATUS: Record<
  StatusMensagem,
  { rotulo: string; classe: string; Icone: typeof Clock }
> = {
  fila: { rotulo: 'Na fila', classe: 'bg-amber-50 text-amber-700', Icone: Clock },
  enviada: { rotulo: 'Enviada', classe: 'bg-blue-50 text-blue-700', Icone: CheckCheck },
  entregue: { rotulo: 'Entregue', classe: 'bg-emerald-50 text-emerald-700', Icone: CheckCheck },
  lida: { rotulo: 'Lida', classe: 'bg-emerald-100 text-emerald-800', Icone: CheckCheck },
  falhou: { rotulo: 'Falhou', classe: 'bg-rose-50 text-rose-700', Icone: XCircle },
  cancelada: { rotulo: 'Cancelada', classe: 'bg-slate-100 text-slate-600', Icone: XCircle },
};

function quando(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR');
}

export const AbaHistorico: React.FC<Props> = ({ showToast, recarregarEm }) => {
  const [enviadas, setEnviadas] = useState<EnvioRegistrado[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [detalhe, setDetalhe] = useState<EnvioRegistrado | null>(null);

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const p = await WhatsApp.enviadas({ limite: PAGINA });
      setEnviadas(p.enviadas);
      setCursor(p.proximoCursor);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.mensagemCompleta : 'Não foi possível carregar o histórico.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    void carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recarregarEm]);

  const verMais = async () => {
    if (!cursor) return;
    setCarregandoMais(true);
    try {
      const p = await WhatsApp.enviadas({ limite: PAGINA, antesDe: cursor });
      setEnviadas((atuais) => [...atuais, ...p.enviadas]);
      setCursor(p.proximoCursor);
    } catch (e) {
      showToast(
        'Não foi possível carregar mais',
        'error',
        e instanceof ErroApi ? e.mensagemCompleta : undefined,
      );
    } finally {
      setCarregandoMais(false);
    }
  };

  if (carregando) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Loader2 className="w-6 h-6 text-[#004276] animate-spin" />
        <p className="text-sm font-semibold text-slate-500">Carregando histórico…</p>
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
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200">
        <span className="text-sm font-bold text-slate-800">
          {enviadas.length} mensagem{enviadas.length === 1 ? '' : 's'}
          {cursor ? ' (há mais)' : ''}
        </span>
        <button
          type="button"
          onClick={() => void carregar()}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#004276] transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Atualizar
        </button>
      </div>

      {enviadas.length === 0 ? (
        <div className="py-16 text-center text-slate-400">
          <History className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">Nenhuma mensagem enviada ainda.</p>
        </div>
      ) : (
        <>
          <div className="p-3 sm:p-0">
            <table className="tabela-mobile w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-2.5 font-bold">Data</th>
                  <th className="px-4 py-2.5 font-bold">Destinatário</th>
                  <th className="px-4 py-2.5 font-bold">Documento</th>
                  <th className="px-4 py-2.5 font-bold">Status</th>
                  <th className="px-4 py-2.5 font-bold">Enviada por</th>
                </tr>
              </thead>
              <tbody>
                {enviadas.map((m) => {
                  const s = STATUS[m.status] ?? STATUS.enviada;
                  return (
                    <tr
                      key={m.id}
                      onClick={() => setDetalhe(m)}
                      className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer transition"
                    >
                      <td className="px-4 py-2.5 text-slate-500 whitespace-nowrap" data-label="Data">
                        {quando(m.ocorridoEm)}
                      </td>
                      <td className="px-4 py-2.5" data-label="Destinatário">
                        <span className="block text-slate-800 font-semibold">
                          {m.lead?.nome ?? m.nomeExibicao ?? '—'}
                        </span>
                        <span className="block text-[11px] text-slate-500">
                          {maskPhone(m.telefone ?? '') || m.telefone || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5" data-label="Documento">
                        {m.referenciaTipo ? (
                          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#004276] bg-blue-50 px-2 py-1 rounded-lg">
                            {m.referenciaTipo === 'proposta' ? (
                              <FileText className="w-3 h-3" />
                            ) : (
                              <ScrollText className="w-3 h-3" />
                            )}
                            {m.referenciaTipo === 'proposta' ? 'Proposta' : 'Contrato'}{' '}
                            {m.referenciaNumero ?? ''}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5" data-label="Status">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg ${s.classe}`}
                        >
                          <s.Icone className="w-3 h-3" />
                          {s.rotulo}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500" data-label="Enviada por">
                        {m.enviadaPorNome ?? 'Automático'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {cursor && (
            <div className="px-5 py-3 border-t border-slate-200 text-center">
              <button
                type="button"
                onClick={() => void verMais()}
                disabled={carregandoMais}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200 disabled:opacity-50"
              >
                {carregandoMais && <Loader2 className="w-4 h-4 animate-spin" />}
                Carregar mais
              </button>
            </div>
          )}
        </>
      )}

      {/* ------------------------------------------------------ detalhe -- */}
      {detalhe && (
        <div
          className="modal-overlay fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setDetalhe(null)}
        >
          <div
            className="modal-painel bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-cabecalho bg-[#004276] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <History className="w-5 h-5 text-[#FFD100]" />
                <h2 className="font-bold text-sm">Detalhes do envio</h2>
              </div>
              <button
                onClick={() => setDetalhe(null)}
                className="text-blue-200 hover:text-white p-1"
                aria-label="Fechar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="modal-corpo p-5 space-y-3 max-h-[80vh] overflow-y-auto text-sm">
              <p className="text-slate-700">
                <span className="text-slate-400">Para:</span>{' '}
                {detalhe.lead?.nome ?? detalhe.nomeExibicao ?? '—'}{' '}
                <span className="text-slate-400">
                  ({maskPhone(detalhe.telefone ?? '') || detalhe.telefone || '—'})
                </span>
              </p>
              <p className="text-slate-700">
                <span className="text-slate-400">Quando:</span> {quando(detalhe.ocorridoEm)}
              </p>
              {detalhe.referenciaTipo && (
                <p className="text-slate-700">
                  <span className="text-slate-400">Documento:</span>{' '}
                  {detalhe.referenciaTipo === 'proposta' ? 'Proposta' : 'Contrato'}{' '}
                  {detalhe.referenciaNumero ?? ''}
                </p>
              )}
              <div>
                <p className="text-slate-400 text-xs mb-1">Mensagem</p>
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 whitespace-pre-wrap break-words text-slate-700">
                  {detalhe.texto ?? '—'}
                </div>
              </div>
              {detalhe.erro && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-xl p-3 text-xs">
                  <strong>Erro:</strong> {detalhe.erro}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
