import React from 'react';
import { Archive, Inbox, Loader2, Search, Users } from 'lucide-react';
import { formatarTelefoneInternacional } from '../../utils/contato';
import type { Conversa } from '../../services/whatsapp';

/*
 * A coluna da esquerda: quem falou com a empresa, mais recente primeiro.
 *
 * Componente sem estado próprio de dados — a CaixaEntrada é dona da lista, da
 * busca e do cursor. Aqui só entra o que desenhar e sai o que o usuário tocou.
 */

interface Props {
  conversas: Conversa[];
  selecionadaId: string | null;
  busca: string;
  arquivadas: boolean;
  carregando: boolean;
  temMais: boolean;
  onBusca: (v: string) => void;
  onAlternarArquivadas: () => void;
  onSelecionar: (c: Conversa) => void;
  onVerMais: () => void;
}

/**
 * Hoje mostra a hora; ontem, "Ontem"; antes, a data.
 *
 * É o que a lista de conversas de qualquer app de mensagem faz, e existe porque
 * "16/09 14:32" em toda linha consome a largura que o nome precisa.
 */
function quando(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';

  const agora = new Date();
  const mesmoDia = d.toDateString() === agora.toDateString();
  if (mesmoDia) {
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  const ontem = new Date(agora);
  ontem.setDate(ontem.getDate() - 1);
  if (d.toDateString() === ontem.toDateString()) return 'Ontem';

  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

/**
 * O nome do LEAD vence o do WhatsApp.
 *
 * O push name é o que a pessoa escolheu para si ("Jô 💛", "Eu") e muda sem
 * aviso; o nome do lead é o do cadastro, que é como a empresa conhece o
 * cliente. Sem lead vinculado, sobra o push name e depois o telefone.
 */
function titulo(c: Conversa): string {
  if (c.lead) return c.lead.nome;
  if (c.nomeExibicao) return c.nomeExibicao;
  return formatarTelefoneInternacional(c.telefone) || c.chatid;
}

export const ListaConversas: React.FC<Props> = ({
  conversas,
  selecionadaId,
  busca,
  arquivadas,
  carregando,
  temMais,
  onBusca,
  onAlternarArquivadas,
  onSelecionar,
  onVerMais,
}) => (
  <div className="flex flex-col min-h-0 h-full">
    <div className="p-3 border-b border-slate-200 space-y-2 shrink-0">
      <div className="relative">
        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={busca}
          onChange={(e) => onBusca(e.target.value)}
          placeholder="Buscar por nome ou telefone"
          className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#004276]/20"
        />
      </div>
      <button
        onClick={onAlternarArquivadas}
        className={`flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition ${
          arquivadas ? 'bg-[#004276] text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`}
      >
        <Archive className="w-3.5 h-3.5" />
        {arquivadas ? 'Vendo arquivadas' : 'Ver arquivadas'}
      </button>
    </div>

    <div className="flex-1 overflow-y-auto min-h-0">
      {conversas.length === 0 && !carregando && (
        <div className="p-8 text-center">
          <Inbox className="w-7 h-7 text-slate-300 mx-auto mb-2" />
          <p className="text-xs text-slate-500">
            {busca
              ? 'Nenhuma conversa encontrada.'
              : arquivadas
                ? 'Nenhuma conversa arquivada.'
                : 'Nenhuma conversa ainda. Elas aparecem aqui quando alguém escrever para o número da empresa, ou quando você enviar uma proposta.'}
          </p>
        </div>
      )}

      {conversas.map((c) => {
        const ativa = c.id === selecionadaId;
        return (
          <button
            key={c.id}
            onClick={() => onSelecionar(c)}
            className={`w-full text-left px-3 py-3 border-b border-slate-100 transition ${
              ativa ? 'bg-[#004276]/5' : 'hover:bg-slate-50'
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-bold text-sm text-slate-900 truncate flex items-center gap-1.5">
                {c.eGrupo && <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                {titulo(c)}
              </span>
              <span className="text-[10px] text-slate-400 shrink-0">
                {quando(c.ultimaMensagemEm)}
              </span>
            </div>

            <div className="flex items-center justify-between gap-2 mt-0.5">
              <span className="text-xs text-slate-500 truncate">
                {c.ultimaMensagemTexto ?? 'Sem mensagens'}
              </span>
              {c.naoLidas > 0 && (
                <span className="shrink-0 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {c.naoLidas > 99 ? '99+' : c.naoLidas}
                </span>
              )}
            </div>

            {/* O número do lead é o que liga esta conversa ao resto do
                sistema. Sem vínculo, o aviso convida a criar um. */}
            <p className="text-[10px] mt-1 truncate">
              {c.lead ? (
                <span className="text-[#004276] font-bold">Lead {c.lead.numero}</span>
              ) : (
                <span className="text-amber-600">Sem lead vinculado</span>
              )}
            </p>
          </button>
        );
      })}

      {temMais && (
        <button
          onClick={onVerMais}
          disabled={carregando}
          className="w-full py-3 text-xs font-bold text-[#004276] hover:bg-slate-50 disabled:opacity-50"
        >
          {carregando ? 'Carregando…' : 'Ver mais conversas'}
        </button>
      )}

      {carregando && conversas.length === 0 && (
        <div className="p-8 flex justify-center">
          <Loader2 className="w-5 h-5 text-[#004276] animate-spin" />
        </div>
      )}
    </div>
  </div>
);
