// Utilidades de data compartilhadas.
//
// Este arquivo tinha uma constante REFERENCE_TODAY fixada em 31/07/2026, que o
// sistema tratava como "hoje" para os dados de demonstração baterem. Com o
// banco real isso mentia: boletos vencidos, obras atrasadas e leads parados
// eram calculados contra uma data congelada. Agora `today()` é o dia de hoje
// de verdade.
//
// As mesmas regras existem no banco (SolarCosta_vw_Notificacoes,
// SolarCosta_vw_ObrasPainel, SolarCosta_fn_rotina_diaria) sobre CURRENT_DATE.
// O que sobrou aqui serve para formatação e para filtros locais de tela.

/** Zera horas/min/seg, mantendo apenas o dia. */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** "Hoje" normalizado (início do dia). */
export function today(): Date {
  return startOfDay(new Date());
}

/** Converte "DD/MM/AAAA" (aceita "DD/MM/AAAA hh:mm") em Date, ou null. */
export function parseBRDate(value?: string | null): Date | null {
  if (!value) return null;
  const m = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
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
