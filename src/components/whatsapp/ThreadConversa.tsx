import React, { useEffect, useRef } from 'react';
import {
  AlertTriangle, ArrowLeft, Archive, ArchiveRestore, Check, CheckCheck,
  Clock, Link2, Loader2, MapPin, Send, User, Users, XCircle,
} from 'lucide-react';
import { formatarTelefoneInternacional } from '../../utils/contato';
import type { Conversa, Mensagem, StatusMensagem } from '../../services/whatsapp';
import { MidiaMensagem } from './MidiaMensagem';

/*
 * A thread: as mensagens de uma conversa e a caixa de resposta.
 *
 * As mensagens chegam da API em ordem DECRESCENTE (mais recente primeiro) e são
 * invertidas aqui para render. A API mantém uma ordem só porque o cursor de
 * paginação depende dela; inverter na tela é uma linha.
 */

interface Props {
  conversa: Conversa;
  mensagens: Mensagem[];
  temMais: boolean;
  carregando: boolean;
  enviando: boolean;
  /** Falso desabilita a resposta: sem número conectado não há como enviar. */
  podeEnviar: boolean;
  motivoBloqueio: string | null;
  texto: string;
  ehCelular: boolean;
  onTexto: (v: string) => void;
  onEnviar: () => void;
  onVerMais: () => void;
  onVoltar: () => void;
  onArquivar: () => void;
  onVincular: () => void;
}

const ICONE_STATUS: Record<StatusMensagem, React.ReactNode> = {
  fila: <Clock className="w-3 h-3" />,
  enviada: <Check className="w-3 h-3" />,
  entregue: <CheckCheck className="w-3 h-3" />,
  lida: <CheckCheck className="w-3 h-3 text-sky-300" />,
  falhou: <XCircle className="w-3 h-3 text-rose-300" />,
  cancelada: <XCircle className="w-3 h-3 text-rose-300" />,
};

function titulo(c: Conversa): string {
  if (c.lead) return c.lead.nome;
  if (c.nomeExibicao) return c.nomeExibicao;
  return formatarTelefoneInternacional(c.telefone) || c.chatid;
}

function hora(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

/** Separador de dia entre as bolhas. */
function diaDe(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const agora = new Date();
  if (d.toDateString() === agora.toDateString()) return 'Hoje';

  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);
  if (d.toDateString() === ontem.toDateString()) return 'Ontem';

  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

export const ThreadConversa: React.FC<Props> = ({
  conversa,
  mensagens,
  temMais,
  carregando,
  enviando,
  podeEnviar,
  motivoBloqueio,
  texto,
  ehCelular,
  onTexto,
  onEnviar,
  onVerMais,
  onVoltar,
  onArquivar,
  onVincular,
}) => {
  const fim = useRef<HTMLDivElement>(null);
  const ultimaId = mensagens[0]?.id ?? null;

  // Rola para o fim quando CHEGA mensagem nova, e não a cada render: o polling
  // devolve o mesmo array a cada 8 s, e rolar sempre arrancaria o usuário do
  // meio da conversa que ele está lendo.
  useEffect(() => {
    fim.current?.scrollIntoView({ block: 'end' });
  }, [ultimaId, conversa.id]);

  const antigasPrimeiro = [...mensagens].reverse();

  return (
    <div className="flex flex-col min-h-0 h-full">
      {/* ------------------------------------------------------ cabeçalho -- */}
      <div className="flex items-center gap-2 p-3 border-b border-slate-200 shrink-0">
        {ehCelular && (
          <button
            onClick={onVoltar}
            aria-label="Voltar para a lista"
            className="p-1.5 rounded-lg hover:bg-slate-100 shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
        )}

        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-sm text-slate-900 truncate flex items-center gap-1.5">
            {conversa.eGrupo && <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
            {titulo(conversa)}
          </p>
          <p className="text-[11px] text-slate-500 truncate">
            {formatarTelefoneInternacional(conversa.telefone) || conversa.chatid}
            {conversa.lead && ` · Lead ${conversa.lead.numero} · ${conversa.lead.etapa}`}
          </p>
        </div>

        <button
          onClick={onVincular}
          title={conversa.lead ? 'Trocar o lead vinculado' : 'Vincular a um lead'}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold shrink-0 ${
            conversa.lead
              ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
          }`}
        >
          {conversa.lead ? <User className="w-3.5 h-3.5" /> : <Link2 className="w-3.5 h-3.5" />}
          {conversa.lead ? 'Lead' : 'Vincular'}
        </button>

        <button
          onClick={onArquivar}
          title={conversa.arquivada ? 'Desarquivar' : 'Arquivar'}
          className="p-1.5 rounded-lg hover:bg-slate-100 shrink-0"
        >
          {conversa.arquivada ? (
            <ArchiveRestore className="w-4 h-4 text-slate-600" />
          ) : (
            <Archive className="w-4 h-4 text-slate-600" />
          )}
        </button>
      </div>

      {/* -------------------------------------------------------- mensagens -- */}
      <div className="flex-1 overflow-y-auto min-h-0 p-3 space-y-2 bg-slate-50">
        {temMais && (
          <button
            onClick={onVerMais}
            disabled={carregando}
            className="mx-auto block px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-[#004276] hover:bg-slate-50 disabled:opacity-50"
          >
            {carregando ? 'Carregando…' : 'Ver mensagens anteriores'}
          </button>
        )}

        {antigasPrimeiro.length === 0 && !carregando && (
          <p className="text-center text-xs text-slate-400 py-8">
            Nenhuma mensagem nesta conversa ainda.
          </p>
        )}

        {antigasPrimeiro.map((m, i) => {
          const anterior = antigasPrimeiro[i - 1];
          const trocouDeDia = !anterior || diaDe(anterior.ocorridoEm) !== diaDe(m.ocorridoEm);

          return (
            <React.Fragment key={m.id}>
              {trocouDeDia && (
                <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-wide py-2">
                  {diaDe(m.ocorridoEm)}
                </p>
              )}

              <div className={`flex ${m.deMim ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] sm:max-w-[70%] rounded-2xl px-3 py-2 text-sm ${
                    m.deMim
                      ? 'bg-[#004276] text-white rounded-br-md'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md'
                  }`}
                >
                  {m.tipo !== 'texto' && m.tipo !== 'contato' && m.tipo !== 'local' && (
                    <div className="mb-1.5">
                      <MidiaMensagem mensagem={m} />
                    </div>
                  )}

                  {m.tipo === 'local' && (
                    <p className="flex items-center gap-1.5 text-xs opacity-80 mb-1">
                      <MapPin className="w-3.5 h-3.5" /> Localização recebida
                    </p>
                  )}

                  {m.tipo === 'contato' && (
                    <p className="flex items-center gap-1.5 text-xs opacity-80 mb-1">
                      <User className="w-3.5 h-3.5" /> Contato recebido
                    </p>
                  )}

                  {m.texto && <p className="whitespace-pre-wrap break-words">{m.texto}</p>}

                  {/* Mensagem que o parser não soube ler: melhor dizer isso do
                      que mostrar uma bolha vazia. */}
                  {!m.texto && m.tipo === 'outro' && !m.midiaId && !m.erro && (
                    <p className="text-xs italic opacity-70">Mensagem não suportada.</p>
                  )}

                  {/* Documento entregue por aqui: o vendedor precisa ver que
                      esta mensagem levou a proposta, não só o texto dela. */}
                  {m.referenciaTipo && (
                    <p className="text-[10px] mt-1 opacity-75">
                      {m.referenciaTipo === 'proposta' ? 'Proposta' : 'Contrato'} enviado
                    </p>
                  )}

                  <div
                    className={`flex items-center gap-1 justify-end mt-1 text-[10px] ${
                      m.deMim ? 'text-white/70' : 'text-slate-400'
                    }`}
                  >
                    {m.deMim && m.enviadaPorNome && (
                      <span className="mr-1 truncate max-w-[8rem]">{m.enviadaPorNome}</span>
                    )}
                    <span>{hora(m.ocorridoEm)}</span>
                    {/* O indicador só existe para o que NÓS mandamos: o status
                        de uma mensagem recebida não significa nada. */}
                    {m.deMim && ICONE_STATUS[m.status]}
                  </div>

                  {m.deMim && m.erro && (
                    <p className="text-[10px] mt-1 text-rose-200">{m.erro}</p>
                  )}
                </div>
              </div>
            </React.Fragment>
          );
        })}

        <div ref={fim} />
      </div>

      {/* --------------------------------------------------------- resposta -- */}
      <div className="p-3 border-t border-slate-200 shrink-0 area-segura-inferior">
        {!podeEnviar && motivoBloqueio && (
          <p className="flex items-start gap-2 mb-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-2.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
            {motivoBloqueio}
          </p>
        )}

        <div className="flex items-end gap-2">
          <textarea
            value={texto}
            onChange={(e) => onTexto(e.target.value)}
            onKeyDown={(e) => {
              // Enter envia, Shift+Enter quebra linha — o que qualquer app de
              // mensagem faz. No celular o teclado manda newline de verdade, e
              // aí o botão é o caminho.
              if (e.key === 'Enter' && !e.shiftKey && !ehCelular) {
                e.preventDefault();
                if (podeEnviar && !enviando && texto.trim()) onEnviar();
              }
            }}
            rows={2}
            maxLength={4000}
            disabled={!podeEnviar || enviando}
            placeholder={podeEnviar ? 'Escreva a resposta…' : 'Envio indisponível'}
            className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#004276]/20 disabled:bg-slate-50"
          />
          <button
            onClick={onEnviar}
            disabled={!podeEnviar || enviando || !texto.trim()}
            aria-label="Enviar"
            className="p-3 rounded-xl bg-[#004276] text-white hover:bg-[#003158] disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            {enviando ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
