-- =============================================================================
--  SOLAR COSTA · R001 — Rollback completo
--
--  ⚠️  DESTRUTIVO. Remove TODAS as tabelas, views, funções, triggers e tipos
--      cujo nome começa com "SolarCosta". Nenhum objeto de outro sistema no
--      mesmo banco (ex.: "Recanto_*") é tocado.
--
--  Use apenas em desenvolvimento, ou após backup verificado:
--      pg_dump -h <host> -U <user> -d <db> -Fc -f backup_antes_do_drop.dump
--
--  Confira o que será removido ANTES de rodar:
--      SELECT table_name FROM information_schema.tables
--       WHERE table_schema = 'public' AND table_name LIKE 'SolarCosta%';
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- TRAVA DE SEGURANÇA
--
-- Este script NÃO faz parte da sequência de instalação. Rodá-lo junto com as
-- migrations apaga tudo que elas acabaram de criar.
--
-- Para executar de propósito, descomente a linha abaixo:
--
-- SET LOCAL solarcosta.confirmar_drop = 'SIM-APAGAR-TUDO';
--
-- -----------------------------------------------------------------------------
DO $trava$
BEGIN
    IF COALESCE(current_setting('solarcosta.confirmar_drop', true), '') <> 'SIM-APAGAR-TUDO' THEN
        RAISE EXCEPTION
          'R001 e o script de ROLLBACK e apaga todos os objetos SolarCosta_. Ele NAO faz parte da instalacao (V001 -> V002 -> V003 -> V004 -> S001). Para apagar de proposito, descomente a linha SET LOCAL solarcosta.confirmar_drop no topo deste arquivo.';
    END IF;
END $trava$;

-- 1. Views (CASCADE resolve dependências entre elas)
DO $do$
DECLARE v text;
BEGIN
    FOR v IN
        SELECT table_name FROM information_schema.views
         WHERE table_schema = 'public' AND table_name LIKE 'SolarCosta%'
    LOOP
        EXECUTE format('DROP VIEW IF EXISTS %I CASCADE', v);
    END LOOP;
END $do$;

-- 2. Tabelas
DO $do$
DECLARE t text;
BEGIN
    FOR t IN
        SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_type   = 'BASE TABLE'
           AND table_name LIKE 'SolarCosta%'
    LOOP
        EXECUTE format('DROP TABLE IF EXISTS %I CASCADE', t);
    END LOOP;
END $do$;

-- 3. Funções (inclui as de trigger)
DO $do$
DECLARE f record;
BEGIN
    FOR f IN
        SELECT p.oid::regprocedure AS assinatura
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public' AND p.proname LIKE 'SolarCosta%'
    LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %s CASCADE', f.assinatura);
    END LOOP;
END $do$;

-- 4. Tipos enumerados
DO $do$
DECLARE ty text;
BEGIN
    FOR ty IN
        SELECT t.typname
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
         WHERE n.nspname = 'public' AND t.typtype = 'e' AND t.typname LIKE 'SolarCosta%'
    LOOP
        EXECUTE format('DROP TYPE IF EXISTS %I CASCADE', ty);
    END LOOP;
END $do$;

COMMIT;

-- Conferência: deve retornar zero linhas.
-- SELECT table_name FROM information_schema.tables
--  WHERE table_schema = 'public' AND table_name LIKE 'SolarCosta%';
