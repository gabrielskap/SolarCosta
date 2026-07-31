// Utilidades de data compartilhadas.
//
// O sistema é uma base de demonstração cujos dados giram em torno de julho/2026.
// Para que os lembretes ("visitas do dia", "boletos vencidos", "leads sem
// contato há 7 dias") sejam coerentes com os dados semeados, adotamos uma data
// de referência fixa como "hoje". Trocar esta constante por `new Date()` faz o
// sistema passar a operar com a data real do navegador.

/** Data de referência tratada como "hoje" pelo sistema (31/07/2026). */
export const REFERENCE_TODAY = new Date(2026, 6, 31);

/** Zera horas/min/seg, mantendo apenas o dia. */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** "hoje" normalizado (início do dia). */
export function today(): Date {
  return startOfDay(REFERENCE_TODAY);
}

/** Converte "DD/MM/AAAA" (aceita "DD/MM/AAAA hh:mm") em Date, ou null. */
export function parseBRDate(value?: string | null): Date | null {
  if (!value) return null;
  const m = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  return isNaN(d.getTime()) ? null : d;
}

/** Converte "AAAA-MM-DD" em Date, ou null. */
export function parseISODate(value?: string | null): Date | null {
  if (!value) return null;
  const m = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

/** Dias inteiros de `from` até `to` (positivo quando `to` é posterior). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86400000);
}

/** Date -> "AAAA-MM-DD". */
export function toISODateStr(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Date -> "DD/MM/AAAA". */
export function formatBRDate(d: Date): string {
  const day = String(d.getDate()).padStart(2, '0');
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${day}/${m}/${d.getFullYear()}`;
}

/** Frase relativa curta: "hoje", "ontem", "há 5 dias", "em 3 dias". */
export function relativeDaysLabel(days: number): string {
  if (days === 0) return 'hoje';
  if (days === 1) return 'ontem';
  if (days === -1) return 'amanhã';
  if (days > 0) return `há ${days} dias`;
  return `em ${Math.abs(days)} dias`;
}
