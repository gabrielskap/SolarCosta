-- =============================================================================
--  SOLAR COSTA · H001 — Papéis do banco de HOMOLOGAÇÃO (SolarCosta_hml)
--
--  Rode UMA VEZ, como superusuário, CONECTADO AO SolarCosta_hml.
--
--  ANTES DE RODAR: troque as duas senhas nas linhas marcadas. Gere cada uma
--  em base64url — elas vão DENTRO da URL de conexão, e o base64 comum produz
--  `/`, que quebra a string de um jeito que o erro não denuncia (o driver
--  reclama do host, não da senha):
--
--    node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
--
--  ---------------------------------------------------------------------------
--  POR QUE ESTE ARQUIVO EXISTE, EM VEZ DE REUSAR O 02/03
--
--  PAPEL NO POSTGRES É OBJETO DE CLUSTER, NÃO DE BANCO. O `solarcosta_app` e o
--  `solarcosta_migrator` criados para produção existem uma vez só no servidor
--  inteiro, e já têm CONNECT no banco "SolarCosta". Apontar a homologação para
--  eles daria ao container de homologação uma credencial que ABRE A PRODUÇÃO —
--  e a recíproca também vale: um vazamento do painel de homologação serviria
--  nos dois ambientes.
--
--  Por isso homologação ganha papéis próprios, com o sufixo _hml, sem CONNECT
--  no banco de produção.
--
--  Além disso, o 02_papeis.sql e o 03_papel_migracao.sql têm
--  `GRANT CONNECT ON DATABASE "SolarCosta"` FIXO no texto. Rodá-los conectado
--  ao SolarCosta_hml não daria erro: daria o GRANT no banco ERRADO, mexendo em
--  produção a partir de uma janela que você achava ser de homologação. A
--  guarda da seção 0 existe para o caso simétrico — este arquivo se recusa a
--  rodar fora do SolarCosta_hml.
--
--  ---------------------------------------------------------------------------
--  A SEÇÃO 2 É A QUE IMPORTA MAIS
--
--  As 48 relações do SolarCosta_hml nasceram com dono `postgres`, porque o
--  schema foi montado à mão pelo DBeaver com essa conexão. É exatamente o que
--  aconteceu com as seis tabelas do V009 em produção, e o resultado lá foi uma
--  migration incapaz de tocá-las: `ALTER TABLE` e `ALTER TYPE ... ADD VALUE`
--  exigem ser DONO, não bastam GRANTs. O V010 só não derrubou o deploy porque
--  foi escrito com uma checagem de privilégio em volta.
--
--  Sem a transferência abaixo, a PRÓXIMA migration que alterar tabela existente
--  quebra o `npm run migrate` do Dockerfile, o `&&` corta o `npm start` e o
--  container de homologação não sobe.
-- =============================================================================

BEGIN;

-- Cliente gráfico aberto mantém sessões consultando metadados o tempo todo, e
-- o padrão do Postgres é esperar PARA SEMPRE pelo ACCESS EXCLUSIVE que a
-- seção 2 pede. Com o teto, o script desiste em 10s e diz o que houve.
SET LOCAL lock_timeout = '10s';

-- -----------------------------------------------------------------------------
-- 0. GUARDA: banco errado para aqui.
-- -----------------------------------------------------------------------------
DO $guarda$
BEGIN
    IF current_database() <> 'SolarCosta_hml' THEN
        RAISE EXCEPTION
            'H001 e o arquivo de HOMOLOGACAO e so roda no SolarCosta_hml. '
            'Esta sessao esta conectada em "%". Troque o banco no cliente SQL '
            'e rode de novo.', current_database();
    END IF;
END $guarda$;


-- -----------------------------------------------------------------------------
-- 1. OS DOIS PAPÉIS
--
--    solarcosta_hml_app       — o processo da API. DML e nada além disso.
--    solarcosta_hml_migrator  — só o `npm run migrate`. DONO dos objetos, DDL.
--
--    O que isso compra: o processo que atende requisição HTTP nunca segura uma
--    conexão capaz de CREATE, ALTER ou DROP. Uma injeção de SQL ou um bug de
--    rota não alcança o schema, porque aquela conexão não tem esse poder.
-- -----------------------------------------------------------------------------
DO $papeis$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'solarcosta_hml_app') THEN
        CREATE ROLE solarcosta_hml_app LOGIN PASSWORD 'TROQUE_SENHA_APP_HML';            -- <<< TROCAR
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'solarcosta_hml_migrator') THEN
        CREATE ROLE solarcosta_hml_migrator LOGIN PASSWORD 'TROQUE_SENHA_MIGRATOR_HML';  -- <<< TROCAR
    END IF;
END $papeis$;

GRANT CONNECT ON DATABASE "SolarCosta_hml" TO solarcosta_hml_app, solarcosta_hml_migrator;

GRANT USAGE         ON SCHEMA public TO solarcosta_hml_app;
GRANT USAGE, CREATE ON SCHEMA public TO solarcosta_hml_migrator;


-- -----------------------------------------------------------------------------
-- 2. PROPRIEDADE DOS OBJETOS EXISTENTES  ->  solarcosta_hml_migrator
--
--    A varredura é POR NOME, e não pelo dono atual. Um REASSIGN OWNED BY
--    postgres arrastaria junto todo o resto do cluster — e este servidor
--    hospeda Recanto, QuantumJus e uma dúzia de outros bancos.
-- -----------------------------------------------------------------------------
DO $dono$
DECLARE r record;
BEGIN
    -- Tabelas, views, views materializadas e sequências avulsas.
    -- Índice e trigger não aparecem: seguem o dono da tabela.
    --
    -- Sequência de identity/serial TAMBÉM segue, e o Postgres recusa
    -- explicitamente mudá-la em separado ("cannot change owner of sequence ...
    -- is linked to table ..."). O NOT EXISTS descarta essas, mantendo só as
    -- criadas por CREATE SEQUENCE, sem coluna atrás.
    FOR r IN
        SELECT c.relname, c.relkind
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public'
           AND c.relname LIKE 'SolarCosta%'
           AND c.relkind IN ('r', 'p', 'v', 'm', 'S')
           AND NOT (
               c.relkind = 'S'
               AND EXISTS (
                   SELECT 1 FROM pg_depend d
                    WHERE d.classid = 'pg_class'::regclass
                      AND d.objid   = c.oid
                      AND d.deptype IN ('a', 'i')
               )
           )
    LOOP
        EXECUTE format(
            CASE r.relkind
                WHEN 'v' THEN 'ALTER VIEW %I OWNER TO solarcosta_hml_migrator'
                WHEN 'm' THEN 'ALTER MATERIALIZED VIEW %I OWNER TO solarcosta_hml_migrator'
                WHEN 'S' THEN 'ALTER SEQUENCE %I OWNER TO solarcosta_hml_migrator'
                ELSE          'ALTER TABLE %I OWNER TO solarcosta_hml_migrator'
            END, r.relname);
    END LOOP;

    -- ENUMs. É o que permite o `ALTER TYPE ... ADD VALUE` das migrations — foi
    -- assim que 'Site' entrou no V008 e 'WhatsApp' no V009.
    FOR r IN
        SELECT t.typname
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
         WHERE n.nspname = 'public'
           AND t.typname LIKE 'SolarCosta%'
           AND t.typtype = 'e'
    LOOP
        EXECUTE format('ALTER TYPE %I OWNER TO solarcosta_hml_migrator', r.typname);
    END LOOP;

    -- Funções. `oid::regprocedure` já traz a assinatura com os parâmetros, que
    -- é o que o ALTER FUNCTION exige para desambiguar.
    FOR r IN
        SELECT p.oid::regprocedure AS assinatura
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname LIKE 'SolarCosta%'
    LOOP
        EXECUTE format('ALTER FUNCTION %s OWNER TO solarcosta_hml_migrator', r.assinatura);
    END LOOP;
END $dono$;


-- -----------------------------------------------------------------------------
-- 3. O QUE A API PODE FAZER
-- -----------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO solarcosta_hml_app;
GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA public TO solarcosta_hml_app;
GRANT EXECUTE                        ON ALL FUNCTIONS IN SCHEMA public TO solarcosta_hml_app;

-- A trilha de auditoria é append-only: a API insere, nunca altera nem apaga.
-- O trigger SolarCosta_tg_auditoria_imutavel já bloqueia, mas negar a
-- permissão evita até a tentativa.
REVOKE UPDATE, DELETE ON "SolarCosta_Auditoria" FROM solarcosta_hml_app;


-- -----------------------------------------------------------------------------
-- 4. PRIVILÉGIOS PADRÃO PARA O QUE O MIGRATOR CRIAR DAQUI PARA A FRENTE
--
--    ESTE É O PONTO FÁCIL DE ERRAR. `ALTER DEFAULT PRIVILEGES` sem `FOR ROLE`
--    vale só para objetos criados por QUEM RODOU O ARQUIVO (o postgres).
--    Tabela criada depois pelo migrator não seria alcançada — e a API tomaria
--    "permission denied" na primeira consulta à tabela nova, depois de um
--    deploy que pareceu perfeito.
-- -----------------------------------------------------------------------------
ALTER DEFAULT PRIVILEGES FOR ROLE solarcosta_hml_migrator IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO solarcosta_hml_app;
ALTER DEFAULT PRIVILEGES FOR ROLE solarcosta_hml_migrator IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO solarcosta_hml_app;
ALTER DEFAULT PRIVILEGES FOR ROLE solarcosta_hml_migrator IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO solarcosta_hml_app;

COMMIT;


-- =============================================================================
-- CONFERÊNCIA — não deve voltar nenhuma linha.
-- =============================================================================
-- SELECT c.relname, pg_get_userbyid(c.relowner) AS dono
--   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--  WHERE n.nspname = 'public' AND c.relname LIKE 'SolarCosta%'
--    AND c.relkind IN ('r','p','v','m')
--    AND pg_get_userbyid(c.relowner) <> 'solarcosta_hml_migrator';
