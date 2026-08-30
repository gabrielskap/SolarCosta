// Constantes compartilhadas dos lembretes.
//
// O CÁLCULO das notificações não mora mais aqui: boleto vencido, lead parado e
// visita do dia são derivados em SQL pela view SolarCosta_vw_Notificacoes e
// chegam prontos por GET /api/notificacoes. A vantagem é que a regra passa a
// valer para qualquer consumidor do banco, não só para este front — e o
// limiar de dias vem do parâmetro `lead.dias_sem_contato`.
//
// Sobrou só o que ainda é usado do lado do cliente.

/**
 * Dias sem interação a partir dos quais um lead é considerado "sem contato".
 *
 * Usado pelo filtro rápido do Kanban. É um espelho do parâmetro
 * `lead.dias_sem_contato` em SolarCosta_Parametros — se você mudar lá, ajuste
 * aqui também, ou passe a ler a configuração no LeadsKanbanView.
 */
export const SEM_CONTATO_DIAS = 7;

/** Contagem por categoria exibida na central de notificações. */
export interface NotificationCounts {
  total: number;
  boleto_vencido: number;
  lead_sem_contato: number;
  visita_hoje: number;
}
