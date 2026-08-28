-- =============================================================================
--  SOLAR COSTA · Diagnóstico
--
--  Rode ISOLADAMENTE (fora de transação) para descobrir em que pé está o banco.
--  Se der erro de "transação abortada", execute antes:  ROLLBACK;
--  Selecione cada bloco e rode com Ctrl+Enter.
-- =============================================================================

ROLLBACK;   -- limpa qualquer transação abortada pendente

-- 1) Versão do servidor e usuário conectado ------------------------------------
SELECT version()                       AS servidor,
       current_database()              AS banco,
       current_user                    AS usuario,
       (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS e_superusuario,
       current_schema()                AS schema_atual;


-- 2) As 4 extensões exigidas estão INSTALADAS? ---------------------------------
--    "instalada = false" com "disponivel = false" -> falta o pacote
--    postgresql-contrib no servidor.
SELECT e.name                                   AS extensao,
       (x.extname IS NOT NULL)                  AS instalada,
       n.nspname                                AS schema_da_extensao,
       true                                     AS disponivel
  FROM (VALUES ('pgcrypto'), ('citext'), ('unaccent'), ('pg_trgm')) AS e(name)
  LEFT JOIN pg_extension x  ON x.extname = e.name
  LEFT JOIN pg_namespace n  ON n.oid = x.extnamespace;

-- Se alguma faltar, veja se ao menos está disponível para instalar:
SELECT name, default_version, installed_version
  FROM pg_available_extensions
 WHERE name IN ('pgcrypto','citext','unaccent','pg_trgm');


-- 3) O dicionário `unaccent` existe? (usado pelo índice de busca sem acento) ---
SELECT n.nspname AS schema, d.dictname AS dicionario
  FROM pg_ts_dict d
  JOIN pg_namespace n ON n.oid = d.dictnamespace
 WHERE d.dictname = 'unaccent';


-- 4) O V001 realmente COMMITOU? ------------------------------------------------
--    Esperado: 36 tabelas e 16 tipos. Se vier 0, o V001 deu rollback inteiro
--    e é por isso que o V002 falha — rode o V001 de novo e leia o PRIMEIRO erro.
SELECT
    (SELECT count(*) FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        AND table_name LIKE 'SolarCosta%')                          AS tabelas,
    (SELECT count(*) FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public' AND t.typtype = 'e'
        AND t.typname LIKE 'SolarCosta%')                           AS tipos_enum,
    (SELECT count(*) FROM pg_indexes
      WHERE schemaname = 'public' AND indexname LIKE 'SolarCosta%')  AS indices,
    (SELECT count(*) FROM information_schema.views
      WHERE table_schema = 'public' AND table_name LIKE 'SolarCosta%') AS views;


-- 5) Quais tabelas já existem --------------------------------------------------
SELECT table_name
  FROM information_schema.tables
 WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
   AND table_name LIKE 'SolarCosta%'
 ORDER BY table_name;
