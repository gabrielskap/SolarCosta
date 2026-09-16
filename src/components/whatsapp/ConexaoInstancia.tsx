import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, Loader2, QrCode, RefreshCw, Smartphone, X } from 'lucide-react';
import { ErroApi } from '../../services/http';
import { formatarTelefoneInternacional } from '../../utils/contato';
import { WhatsApp, type InstanciaWhatsApp } from '../../services/whatsapp';

/*
 * Pareamento do número da empresa.
 *
 * O laço aqui não é enfeite: o QR da uazapi expira em 2 minutos e é redesenhado
 * a cada consulta de status. Sem consultar, o usuário olharia para um código
 * morto sem nenhum sinal disso — escanearia, nada aconteceria, e a conclusão
 * seria "o sistema não funciona".
 *
 * A consulta bate em GET /instancia/qr, NÃO em POST /instancia/conectar:
 * chamar conectar outra vez reinicia o pareamento e invalida justamente o
 * código que a pessoa está com a câmera em cima.
 */

/** De quanto em quanto tempo perguntamos se já conectou (e pegamos o QR novo). */
const INTERVALO_MS = 3_000;

/** Validade do QR da uazapi. Depois disso o código na tela não serve mais. */
const VALIDADE_S = 120;

interface Props {
  instanciaInicial: InstanciaWhatsApp;
  onFechar: () => void;
  /** Chamado sempre que o estado muda, para a tela de trás acompanhar. */
  onAtualizar: (instancia: InstanciaWhatsApp) => void;
}

export const ConexaoInstancia: React.FC<Props> = ({ instanciaInicial, onFechar, onAtualizar }) => {
  const [instancia, setInstancia] = useState(instanciaInicial);
  const [iniciando, setIniciando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [restante, setRestante] = useState(VALIDADE_S);

  // Guarda o callback do pai numa ref para que o efeito do laço não precise
  // listá-lo como dependência — sem isso, um pai que recria a função a cada
  // render reiniciaria o polling a cada render.
  const aoAtualizar = useRef(onAtualizar);
  aoAtualizar.current = onAtualizar;

  const conectada = instancia.status === 'conectada';
  const temQr = !!instancia.qrcode && !conectada;

  const aplicar = useCallback((nova: InstanciaWhatsApp) => {
    setInstancia(nova);
    aoAtualizar.current(nova);
  }, []);

  const iniciar = useCallback(async () => {
    setIniciando(true);
    setErro(null);
    try {
      aplicar(await WhatsApp.conectar());
      setRestante(VALIDADE_S);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.mensagemCompleta : 'Não foi possível gerar o QR code.');
    } finally {
      setIniciando(false);
    }
  }, [aplicar]);

  // Começa o pareamento assim que o modal abre — quem clicou em "Conectar"
  // não deveria precisar de um segundo clique para ver o código.
  useEffect(() => {
    if (instanciaInicial.status !== 'conectada') void iniciar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Laço de status. Para sozinho quando conecta ou quando o QR vence: manter
  // o polling depois disso só gastaria chamada da uazapi sem mudar a tela.
  useEffect(() => {
    if (conectada || restante <= 0) return;

    const timer = setInterval(() => {
      void (async () => {
        try {
          aplicar(await WhatsApp.qr());
        } catch {
          // Falha isolada no laço é silenciosa de propósito: a próxima volta
          // tenta de novo, e um toast a cada 3 segundos seria pior que o erro.
        }
      })();
    }, INTERVALO_MS);

    return () => clearInterval(timer);
  }, [conectada, restante, aplicar]);

  // Contador regressivo do QR.
  useEffect(() => {
    if (conectada || restante <= 0) return;
    const timer = setTimeout(() => setRestante((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [conectada, restante]);

  const minutos = Math.floor(restante / 60);
  const segundos = String(restante % 60).padStart(2, '0');

  return (
    <div className="modal-overlay fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="modal-painel bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="modal-cabecalho bg-[#004276] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <QrCode className="w-5 h-5 text-[#FFD100]" />
            <h2 className="font-bold text-sm">Conectar WhatsApp</h2>
          </div>
          <button onClick={onFechar} className="text-blue-200 hover:text-white p-1" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="modal-corpo p-6 space-y-5 max-h-[80vh] overflow-y-auto">
          {conectada ? (
            <div className="text-center space-y-3 py-4">
              <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
              <div>
                <p className="font-extrabold text-slate-900">Número conectado</p>
                <p className="text-sm text-slate-600 mt-1">
                  {instancia.perfil ?? 'WhatsApp'} · {formatarTelefoneInternacional(instancia.numero)}
                </p>
              </div>
              <button
                onClick={onFechar}
                className="px-5 py-2.5 rounded-xl bg-[#004276] text-white text-sm font-bold hover:bg-[#003158]"
              >
                Concluir
              </button>
            </div>
          ) : (
            <>
              <ol className="text-xs text-slate-600 space-y-1.5 bg-slate-50 border border-slate-200 rounded-xl p-4">
                <li>1. Abra o WhatsApp no celular da empresa.</li>
                <li>
                  2. Toque em <strong>Configurações → Aparelhos conectados</strong>.
                </li>
                <li>
                  3. Toque em <strong>Conectar aparelho</strong> e aponte a câmera para o código.
                </li>
              </ol>

              <div className="flex flex-col items-center gap-3">
                <div className="w-56 h-56 rounded-2xl border-2 border-slate-200 bg-white flex items-center justify-center overflow-hidden">
                  {iniciando ? (
                    <Loader2 className="w-8 h-8 text-[#004276] animate-spin" />
                  ) : temQr && restante > 0 ? (
                    // A uazapi devolve o PNG já montado em data URI — não há
                    // biblioteca de QR no bundle por causa disso.
                    <img src={instancia.qrcode!} alt="QR code do WhatsApp" className="w-full h-full object-contain" />
                  ) : (
                    <div className="text-center px-6">
                      <QrCode className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-slate-500">
                        {restante <= 0 ? 'O código expirou.' : 'Nenhum código disponível.'}
                      </p>
                    </div>
                  )}
                </div>

                {temQr && restante > 0 && (
                  <p className="text-[11px] font-bold text-slate-500 tabular-nums">
                    Expira em {minutos}:{segundos}
                  </p>
                )}

                <button
                  onClick={() => void iniciar()}
                  disabled={iniciando}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${iniciando ? 'animate-spin' : ''}`} />
                  Gerar novo código
                </button>
              </div>

              {erro && (
                <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-3">{erro}</p>
              )}

              <p className="text-[11px] text-slate-500 flex items-start gap-2">
                <Smartphone className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Use o número comercial da empresa, de preferência uma conta WhatsApp Business — é a
                recomendação da própria uazapi, e conta comum desconecta com mais frequência.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

