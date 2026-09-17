import React, { useMemo, useState } from 'react';
import { Link2, Loader2, Search, Unlink, X } from 'lucide-react';
import { onlyDigits } from '../../utils/format';
import type { Lead } from '../../types';
import type { Conversa } from '../../services/whatsapp';

/*
 * Escolher à mão o lead de uma conversa.
 *
 * Existe porque o casamento automático por telefone é um palpite: homônimo,
 * número passado para outra pessoa e cadastro com telefone do cônjuge são
 * casos reais. Um palpite errado do sistema não pode virar dado definitivo.
 *
 * A busca roda sobre os leads que o App já tem em memória desde o login
 * (carregarTudo). Criar uma rota de busca só para este seletor seria endpoint
 * novo para um dado que já está na aba ao lado.
 */

interface Props {
  conversa: Conversa;
  leads: Lead[];
  salvando: boolean;
  onVincular: (leadId: string | null) => void;
  onFechar: () => void;
}

/** Quantos mostrar sem busca. A lista inteira pode ter milhares. */
const TETO = 40;

export const VincularLead: React.FC<Props> = ({
  conversa,
  leads,
  salvando,
  onVincular,
  onFechar,
}) => {
  const [busca, setBusca] = useState('');

  const resultados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const digitos = onlyDigits(busca);

    // Sem busca, sugere por telefone: na maioria das vezes o lead certo é
    // justamente o que tem aquele número e não foi casado automaticamente por
    // uma diferença de formatação.
    if (!termo) {
      const doTelefone = conversa.telefone
        ? leads.filter((l) => {
            const d = onlyDigits(l.telefone);
            return d.length >= 8 && conversa.telefone!.endsWith(d.slice(-8));
          })
        : [];
      const resto = leads.filter((l) => !doTelefone.includes(l));
      return [...doTelefone, ...resto].slice(0, TETO);
    }

    return leads
      .filter(
        (l) =>
          l.nome.toLowerCase().includes(termo) ||
          l.numero.toLowerCase().includes(termo) ||
          (digitos.length >= 4 && onlyDigits(l.telefone).includes(digitos)),
      )
      .slice(0, TETO);
  }, [busca, leads, conversa.telefone]);

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal-painel max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-cabecalho">
          <h2 className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-[#FFD100]" />
            Vincular a um lead
          </h2>
          <button onClick={onFechar} aria-label="Fechar">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="modal-corpo space-y-3">
          <p className="text-xs text-slate-500">
            A conversa passa a aparecer na timeline do lead, e o nome do cadastro
            substitui o nome do WhatsApp na lista.
          </p>

          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Nome, número do lead ou telefone"
              autoFocus
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#004276]/20"
            />
          </div>

          <div className="max-h-72 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
            {resultados.length === 0 && (
              <p className="p-4 text-xs text-slate-500 text-center">Nenhum lead encontrado.</p>
            )}
            {resultados.map((l) => (
              <button
                key={l.id}
                onClick={() => onVincular(l.id)}
                disabled={salvando}
                className={`w-full text-left px-3 py-2.5 hover:bg-slate-50 disabled:opacity-50 ${
                  l.id === conversa.lead?.id ? 'bg-[#004276]/5' : ''
                }`}
              >
                <p className="text-sm font-bold text-slate-900 truncate">
                  {l.numero} — {l.nome}
                </p>
                <p className="text-[11px] text-slate-500 truncate">
                  {l.telefone || 'sem telefone'} · {l.etapa}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="barra-acoes">
          {conversa.lead && (
            <button
              onClick={() => onVincular(null)}
              disabled={salvando}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 text-rose-700 text-sm font-bold hover:bg-rose-100 disabled:opacity-50"
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlink className="w-4 h-4" />}
              Desvincular
            </button>
          )}
          <button
            onClick={onFechar}
            className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold hover:bg-slate-200"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
