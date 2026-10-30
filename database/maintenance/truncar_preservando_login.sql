-- Limpa os dados SolarCosta preservando contas, permissoes, sessoes e migrations.
-- ATENCAO: inclui configuracoes, catalogos, site, financeiro e WhatsApp.
-- Execute no banco correto e somente depois de guardar um backup.
-- Sem CASCADE: uma dependencia externa ou protegida faz a transacao falhar.
BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

DO $limpeza$
DECLARE
    protegidas constant text[] := ARRAY[
        'SolarCosta_Usuarios',
        'SolarCosta_UsuarioPermissoes',
        'SolarCosta_Sessoes',
        'SolarCosta_SchemaMigrations'
    ];
    alvos text;
    tabela text;
BEGIN
    FOREACH tabela IN ARRAY protegidas LOOP
        IF to_regclass(format('%I.%I', 'public', tabela)) IS NULL THEN
            RAISE EXCEPTION 'Tabela protegida ausente: %. Confira o banco conectado.', tabela;
        END IF;
    END LOOP;

    SELECT string_agg(format('%I.%I', n.nspname, c.relname), ', ' ORDER BY c.relname)
      INTO alvos
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind IN ('r', 'p')
       AND NOT c.relispartition
       AND starts_with(c.relname, 'SolarCosta_')
       AND NOT (c.relname = ANY(protegidas));

    IF alvos IS NULL THEN
        RAISE EXCEPTION 'Nenhuma tabela encontrada para limpar.';
    END IF;

    RAISE NOTICE 'Tabelas que serao truncadas: %', alvos;
    EXECUTE 'TRUNCATE TABLE ' || alvos || ' RESTART IDENTITY RESTRICT';
END
$limpeza$;

COMMIT;
