-- =============================================================================
--  Rotina diária pelo pg_cron  (ALTERNATIVA ao agendador da API)
--
--  Use isto se preferir que a rotina rode mesmo com a API fora do ar.
--  Se usar, desligue o agendador da API com SCHEDULER_ATIVO=false no .env,
--  senão as duas coisas rodam (inofensivo, porque a função é idempotente,
--  mas polui o log).
--
--  Requer a extensão pg_cron, que precisa estar em shared_preload_libraries
--  no postgresql.conf:
--
--      shared_preload_libraries = 'pg_cron'
--      cron.database_name = 'SolarCosta'
--
--  ... e um restart do Postgres. Em Docker, isso vai no comando do serviço:
--
--      command: >
--        postgres -c shared_preload_libraries=pg_cron
--                 -c cron.database_name=SolarCosta
--
--  Rode como superusuário no banco SolarCosta.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove agendamento anterior, para este script poder ser reexecutado.
DO $$
DECLARE j record;
BEGIN
    FOR j IN SELECT jobid FROM cron.job WHERE jobname LIKE 'solarcosta%'
    LOOP
        PERFORM cron.unschedule(j.jobid);
    END LOOP;
END $$;

-- Rotina diária às 03:10. O horário é o do servidor de banco — confira com
-- SHOW timezone; se estiver em UTC, 03:10 UTC = 00:10 em Brasília.
SELECT cron.schedule(
    'solarcosta-rotina-diaria',
    '10 3 * * *',
    $$SELECT "SolarCosta_fn_rotina_diaria"()$$
);

-- Expurgo da trilha de auditoria, conforme o parâmetro de retenção.
-- A tabela é append-only por trigger; o DELETE abaixo só funciona porque roda
-- como superusuário. Mensal, no dia 1 às 04:00.
SELECT cron.schedule(
    'solarcosta-expurgo-auditoria',
    '0 4 1 * *',
    $$
    DO $expurgo$
    DECLARE
        dias integer := "SolarCosta_fn_param_num"('auditoria.retencao_dias', 730)::integer;
        removidos integer;
    BEGIN
        ALTER TABLE "SolarCosta_Auditoria" DISABLE TRIGGER "SolarCosta_tg_auditoria_imutavel";
        DELETE FROM "SolarCosta_Auditoria" WHERE ocorrido_em < now() - (dias || ' days')::interval;
        GET DIAGNOSTICS removidos = ROW_COUNT;
        ALTER TABLE "SolarCosta_Auditoria" ENABLE TRIGGER "SolarCosta_tg_auditoria_imutavel";
        RAISE NOTICE 'auditoria: % registro(s) expurgado(s) (retencao de % dias)', removidos, dias;
    END $expurgo$;
    $$
);

-- Limpeza de sessões expiradas. Diária, às 04:30.
SELECT cron.schedule(
    'solarcosta-limpar-sessoes',
    '30 4 * * *',
    $$DELETE FROM "SolarCosta_Sessoes"
       WHERE expira_em < now()
          OR (revogado_em IS NOT NULL AND revogado_em < now() - interval '30 days')$$
);

-- =============================================================================
-- CONFERÊNCIA
-- =============================================================================
-- Agendamentos ativos:
--   SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname LIKE 'solarcosta%';
--
-- Últimas execuções (sucesso/falha):
--   SELECT j.jobname, d.start_time, d.status, d.return_message
--     FROM cron.job_run_details d
--     JOIN cron.job j USING (jobid)
--    WHERE j.jobname LIKE 'solarcosta%'
--    ORDER BY d.start_time DESC LIMIT 20;
--
-- Rodar agora, sem esperar o horário:
--   SELECT * FROM "SolarCosta_fn_rotina_diaria"();
