import React, { useState, useRef, useEffect } from 'react';
import {
  Bell, X, AlertTriangle, CalendarClock, UserX, Receipt, Inbox, ChevronRight, CheckCircle2,
} from 'lucide-react';
import { AppNotification, NotificationCategory } from '../types';
import { NotificationCounts } from '../utils/notifications';

interface NotificationCenterProps {
  notifications: AppNotification[];
  counts: NotificationCounts;
  /** Navega ao clicar numa notificação (aba + lead opcional). */
  onNavigate: (tab: string, leadId?: string) => void;
  /** Aparência do botão conforme o fundo em que está inserido. */
  tone?: 'onDark' | 'onLight';
}

const CATEGORY_META: Record<
  NotificationCategory,
  { label: string; Icon: React.ComponentType<{ className?: string }>; accent: string; chip: string }
> = {
  boleto_vencido: {
    label: 'Boletos vencidos',
    Icon: Receipt,
    accent: 'text-rose-600 bg-rose-50 border-rose-200',
    chip: 'bg-rose-100 text-rose-700',
  },
  lead_sem_contato: {
    label: 'Leads sem contato há 7+ dias',
    Icon: UserX,
    accent: 'text-amber-600 bg-amber-50 border-amber-200',
    chip: 'bg-amber-100 text-amber-800',
  },
  visita_hoje: {
    label: 'Visitas e compromissos de hoje',
    Icon: CalendarClock,
    accent: 'text-[#004276] bg-blue-50 border-blue-200',
    chip: 'bg-blue-100 text-[#004276]',
  },
};

const CATEGORY_ORDER: NotificationCategory[] = [
  'boleto_vencido',
  'lead_sem_contato',
  'visita_hoje',
];

export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  notifications,
  counts,
  onNavigate,
  tone = 'onLight',
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha ao clicar fora ou pressionar Esc.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const total = counts.total;

  const handleClickItem = (n: AppNotification) => {
    setOpen(false);
    if (n.destinoTab) onNavigate(n.destinoTab, n.leadId);
  };

  const buttonBase =
    tone === 'onDark'
      ? 'text-white hover:bg-blue-900/60'
      : 'text-slate-500 hover:bg-slate-100 hover:text-[#004276]';

  const grouped = CATEGORY_ORDER.map((cat) => ({
    cat,
    items: notifications.filter((n) => n.categoria === cat),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="Central de notificações e lembretes"
        aria-label={`Notificações${total ? ` (${total})` : ''}`}
        className={`relative p-2 rounded-xl transition ${buttonBase}`}
      >
        <Bell className="w-5 h-5" />
        {total > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-black flex items-center justify-center border-2 border-white shadow">
            {total > 99 ? '99+' : total}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[92vw] max-w-sm sm:w-[380px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
          {/* Cabeçalho */}
          <div className="bg-[#004276] text-white px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#FFD100]" />
              <h3 className="font-bold text-sm">Central de notificações</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-blue-900/70 text-[#FFD100] text-[11px] font-bold px-2 py-0.5 rounded-full border border-blue-800">
                {total} pendente{total === 1 ? '' : 's'}
              </span>
              <button onClick={() => setOpen(false)} className="text-slate-300 hover:text-white p-0.5">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Resumo por categoria */}
          {total > 0 && (
            <div className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 bg-slate-50/70 text-center">
              <div className="py-2">
                <p className="text-base font-black text-rose-600">{counts.boleto_vencido}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Vencidos</p>
              </div>
              <div className="py-2">
                <p className="text-base font-black text-amber-600">{counts.lead_sem_contato}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Sem contato</p>
              </div>
              <div className="py-2">
                <p className="text-base font-black text-[#004276]">{counts.visita_hoje}</p>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Hoje</p>
              </div>
            </div>
          )}

          {/* Lista */}
          <div className="max-h-[60vh] sm:max-h-96 overflow-y-auto">
            {total === 0 ? (
              <div className="p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <p className="font-bold text-slate-700 text-sm">Tudo em dia!</p>
                <p className="text-xs text-slate-400 mt-1">
                  Nenhum boleto vencido, lead esquecido ou visita para hoje.
                </p>
              </div>
            ) : (
              grouped.map(({ cat, items }) => {
                const meta = CATEGORY_META[cat];
                return (
                  <div key={cat} className="py-1">
                    <div className="px-4 pt-2 pb-1 flex items-center gap-2">
                      <meta.Icon className={`w-3.5 h-3.5 ${meta.accent.split(' ')[0]}`} />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        {meta.label}
                      </span>
                      <span className={`ml-auto text-[10px] font-bold px-1.5 rounded-full ${meta.chip}`}>
                        {items.length}
                      </span>
                    </div>
                    {items.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleClickItem(n)}
                        className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition flex items-start gap-3 group"
                      >
                        <div
                          className={`mt-0.5 w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${meta.accent}`}
                        >
                          <meta.Icon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-900 leading-snug truncate">
                            {n.titulo}
                          </p>
                          <p className="text-[11px] text-slate-500 truncate">{n.descricao}</p>
                          {n.meta && (
                            <p
                              className={`text-[10px] font-bold mt-0.5 ${
                                n.prioridade === 'alta' ? 'text-rose-600' : 'text-slate-400'
                              }`}
                            >
                              {n.meta}
                            </p>
                          )}
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-[#004276] shrink-0 mt-1.5" />
                      </button>
                    ))}
                  </div>
                );
              })
            )}
          </div>

          {/* Rodapé */}
          {total > 0 && (
            <div className="border-t border-slate-100 p-2 bg-slate-50/70 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
              <Inbox className="w-3.5 h-3.5" />
              <span>Lembretes gerados automaticamente a partir dos seus dados</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
