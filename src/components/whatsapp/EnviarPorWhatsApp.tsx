import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, MessageCircle, Paperclip, Send, X } from 'lucide-react';
import { ErroApi } from '../../services/http';
import { WhatsApp, type ModeloMensagem } from '../../services/whatsapp';
import { maskPhone } from '../../utils/format';

/*
 * Enviar proposta ou contrato pelo WhatsApp.
 *
 * Substitui o `wa.me` do AcoesContato neste caminho específico. A diferença
 * não é cosmética: o wa.me abre o app e o sistema perde a mensagem de vista —
 * ninguém sabe se foi enviada, o que foi escrito, nem se o cliente abriu. Aqui
 * o envio passa pela API, entra na timeline do lead e o PDF vai anexado.
 *
 * O texto final é montado no SERVIDOR, não aqui: é ele que imprime o PDF e
 * conhece os valores da proposta. A prévia abaixo é só o texto cru do modelo,
 * com os marcadores à mostra — mentir sobre o resultado seria pior do que
 * mostrar o modelo como ele é.
 */

interface Props {
  referencia: { tipo: 'proposta' | 'contrato'; id: string };
  /** Só para a tela; quem decide o destino final é o servidor. */
  clienteNome: string;
  telefoneSugerido?: string | null;
  leadId?: string | null;
  onFechar: () => void;
  showToast: (title: string, type: 'success' | 'error' | 'info', description?: string) => void;
}

export const EnviarPorWhatsApp: React.FC<Props> = ({
  referencia,
  clienteNome,
  telefoneSugerido,
  leadId,
  onFechar,
  showToast,
}) => {
  const [modelos, setModelos] = useState<ModeloMensagem[]>([]);
  const [modeloId, setModeloId] = useState<string>('');
  const [textoLivre, setTextoLivre] = useState('');
  const [telefone, setTelefone] = useState(maskPhone(telefoneSugerido ?? ''));
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const lista = await WhatsApp.modelos(referencia.tipo);
        setModelos(lista);
        if (lista[0]) setModeloId(lista[0].id);
      } catch {
        // Sem modelos a tela continua útil: escreve-se a mensagem à mão.
      } finally {
        setCarregando(false);
      }
    })();
  }, [referencia.tipo]);

  const modelo = useMemo(() => modelos.find((m) => m.id === modeloId), [modelos, modeloId]);
  const usandoModelo = !!modeloId;

  const enviar = async () => {
    setEnviando(true);
    try {
      const r = await WhatsApp.enviar({
        telefone: telefone || undefined,
        modeloId: usandoModelo ? modeloId : undefined,
        texto: usandoModelo ? undefined : textoLivre,
        referencia,
        leadId: leadId ?? undefined,
      });
      showToast(
        'Mensagem enviada',
        'success',
        r.documento
          ? `${clienteNome} recebeu ${r.documento.nome} no WhatsApp.`
          : `${clienteNome} recebeu a mensagem no WhatsApp.`,
      );
      onFechar();
    } catch (e) {
      showToast(
        'Não foi possível enviar',
        'error',
        e instanceof ErroApi ? e.mensagemCompleta : undefined,
      );
    } finally {
      setEnviando(false);
    }
  };

  const podeEnviar = !enviando && (usandoModelo || textoLivre.trim().length > 0);

  return (
    <div className="modal-overlay fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="modal-painel bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="modal-cabecalho bg-[#004276] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <MessageCircle className="w-5 h-5 text-[#FFD100]" />
            <h2 className="font-bold text-sm">
              Enviar {referencia.tipo === 'proposta' ? 'proposta' : 'contrato'} por WhatsApp
            </h2>
          </div>
          <button onClick={onFechar} className="text-blue-200 hover:text-white p-1" aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="modal-corpo p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              WhatsApp do cliente
            </label>
            <input
              value={telefone}
              onChange={(e) => setTelefone(maskPhone(e.target.value))}
              placeholder="(31) 98658-8456"
              inputMode="tel"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#004276] focus:ring-2 focus:ring-blue-100 transition"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              {clienteNome} · o número precisa ter DDD.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
              Mensagem
            </label>
            {carregando ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Carregando modelos…
              </div>
            ) : (
              <select
                value={modeloId}
                onChange={(e) => setModeloId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#004276] focus:ring-2 focus:ring-blue-100 transition"
              >
                {modelos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
                <option value="">Escrever do zero</option>
              </select>
            )}
          </div>

          {usandoModelo ? (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                {modelo?.texto}
              </p>
              <p className="text-[11px] text-slate-500 mt-2 pt-2 border-t border-slate-200">
                Os campos entre chaves são preenchidos no envio, com os dados reais do documento.
              </p>
            </div>
          ) : (
            <textarea
              value={textoLivre}
              onChange={(e) => setTextoLivre(e.target.value)}
              rows={5}
              placeholder="Escreva a mensagem. Ela vai como legenda do PDF anexado."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#004276] focus:ring-2 focus:ring-blue-100 transition"
            />
          )}

          <p className="text-[11px] text-slate-500 flex items-start gap-2">
            <Paperclip className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            O cliente recebe o PDF como arquivo no WhatsApp, com esta mensagem de legenda. O
            documento é impresso na hora do envio, então sai com os dados atuais.
          </p>

          <div className="barra-acoes flex items-center justify-end gap-2 pt-1">
            <button
              onClick={onFechar}
              className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200"
            >
              Cancelar
            </button>
            <button
              onClick={() => void enviar()}
              disabled={!podeEnviar}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#004276] text-white text-sm font-bold hover:bg-[#003158] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Enviar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
