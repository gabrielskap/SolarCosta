// Motor de lembretes / central de notificações.
// Deriva, a partir dos dados atuais, três tipos de alerta proativo:
//   1. Boletos vencidos (a receber em atraso);
//   2. Leads sem contato há 7 dias ou mais;
//   3. Visitas/compromissos agendados para o dia de hoje.

import { Lead, Boleto, Agendamento, AppNotification } from '../types';
import {
  today,
  parseBRDate,
  parseISODate,
  daysBetween,
  toISODateStr,
} from './dates';
import { formatCurrencyBRL } from './format';

/** Dias sem interação a partir dos quais um lead é considerado "sem contato". */
export const SEM_CONTATO_DIAS = 7;

/** Etapas que não geram cobrança de follow-up (já concluídas/perdidas). */
const ETAPAS_INATIVAS = new Set(['Fechado']);

/** Data da última interação registrada no histórico do lead (a mais recente). */
function ultimaInteracao(lead: Lead): Date | null {
  const datas = (lead.historico || [])
    .map((h) => parseBRDate(h.data))
    .filter((d): d is Date => d !== null);
  if (datas.length === 0) return parseBRDate(lead.dataCriacao);
  return datas.reduce((max, d) => (d > max ? d : max));
}

function diasDeAtraso(lead: Lead, ref: Date): number | null {
  const ultima = ultimaInteracao(lead);
  if (!ultima) return null;
  return daysBetween(ultima, ref);
}

export interface ComputeNotificationsInput {
  leads: Lead[];
  boletos: Boleto[];
  agendamentos: Agendamento[];
  /** Permite sobrescrever a data de referência (padrão: "hoje" do sistema). */
  ref?: Date;
}

export function computeNotifications({
  leads,
  boletos,
  agendamentos,
  ref = today(),
}: ComputeNotificationsInput): AppNotification[] {
  const notifs: AppNotification[] = [];

  // 1. BOLETOS VENCIDOS -------------------------------------------------
  (boletos || []).forEach((b) => {
    const venc = parseBRDate(b.vencimento);
    const vencido =
      b.situacao === 'vencido' ||
      (b.situacao === 'em_aberto' && venc !== null && daysBetween(venc, ref) > 0);
    if (!vencido) return;

    const diasAtraso = venc ? daysBetween(venc, ref) : 0;
    notifs.push({
      id: `nt-boleto-${b.id}`,
      categoria: 'boleto_vencido',
      prioridade: 'alta',
      titulo: `Boleto vencido · ${b.clienteNome}`,
      descricao: `${b.tipo} — parcela ${b.parcela} · ${formatCurrencyBRL(b.valor)}`,
      meta:
        diasAtraso > 0
          ? `vencido há ${diasAtraso} dia${diasAtraso > 1 ? 's' : ''} (${b.vencimento})`
          : `vencido em ${b.vencimento}`,
      destinoTab: 'financeiro',
    });
  });

  // 2. LEADS SEM CONTATO HÁ 7+ DIAS ------------------------------------
  (leads || []).forEach((l) => {
    if (ETAPAS_INATIVAS.has(l.etapa)) return;
    const dias = diasDeAtraso(l, ref);
    if (dias === null || dias < SEM_CONTATO_DIAS) return;

    notifs.push({
      id: `nt-lead-${l.id}`,
      categoria: 'lead_sem_contato',
      prioridade: dias >= 14 ? 'alta' : 'media',
      titulo: `Lead sem contato · ${l.nome}`,
      descricao: `${l.etapa} · ${l.responsavel} · ${l.cidade}`,
      meta: `${dias} dias sem interação`,
      destinoTab: 'detalhe_lead',
      leadId: l.id,
    });
  });

  // 3. VISITAS / COMPROMISSOS DE HOJE ----------------------------------
  const hojeISO = toISODateStr(ref);
  (agendamentos || [])
    .filter((a) => {
      const d = parseISODate(a.data);
      return d !== null && toISODateStr(d) === hojeISO && a.status === 'agendado';
    })
    .sort((a, b) => a.horarioInicio.localeCompare(b.horarioInicio))
    .forEach((a) => {
      notifs.push({
        id: `nt-visita-${a.id}`,
        categoria: 'visita_hoje',
        prioridade: 'media',
        titulo: `Hoje · ${a.titulo}`,
        descricao: `${a.leadNome} · ${a.endereco || a.cidade} · ${a.responsavel}`,
        meta: `${a.horarioInicio}–${a.horarioFim}`,
        destinoTab: 'agenda',
        leadId: a.leadId,
      });
    });

  // Ordena por prioridade (alta > média > baixa) mantendo o agrupamento lógico.
  const peso: Record<string, number> = { alta: 0, media: 1, baixa: 2 };
  return notifs.sort((a, b) => peso[a.prioridade] - peso[b.prioridade]);
}

export interface NotificationCounts {
  total: number;
  boleto_vencido: number;
  lead_sem_contato: number;
  visita_hoje: number;
}

export function countByCategory(notifs: AppNotification[]): NotificationCounts {
  return notifs.reduce(
    (acc, n) => {
      acc.total += 1;
      acc[n.categoria] += 1;
      return acc;
    },
    { total: 0, boleto_vencido: 0, lead_sem_contato: 0, visita_hoje: 0 } as NotificationCounts,
  );
}
