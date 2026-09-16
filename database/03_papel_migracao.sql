-- =============================================================================
--  SOLAR COSTA · Papel de migração
--
--  Rode UMA VEZ, conectado como superusuário no banco SolarCosta, DEPOIS do
--  02_papeis.sql.
--
--  ANTES DE RODAR: troque a senha na linha marcada.
--
--  Gere com:
--    node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
--
--  base64url, e não o `openssl rand -base64` que o 02_papeis.sql sugere: esta
--  senha vai DENTRO de uma URL de conexão (MIGRATION_DATABASE_URL), e o base64
--  comum produz `+`, `/` e `=`, que ali precisariam de escape. Uma senha com
--  `/` no meio quebra a URL de um jeito que o erro não denuncia — o driver
--  reclama do host, não da senha.
--
--  ---------------------------------------------------------------------------
--  O QUE ESTE ARQUIVO CONSERTA
--
--  O EASYPANEL.md afirmava duas coisas incompatíveis: que o DATABASE_URL deve
--  usar `solarcosta_app` (certo — mínimo privilégio), e que as migrations rodam
--  sozinhas a cada deploy pelo `npm run migrate && npm start` do Dockerfile
--  (impossível). O solarcosta_app tem USAGE no schema, não CREATE, então o
--  migrate parava em "permission denied for schema public", saía com código 1,
--  o `&&` cortava o `npm start` e o container não subia.
--
--  Na prática as migrations vinham sendo aplicadas à mão como `postgres`, e o
--  passo automático do deploy nunca funcionou como documentado.
--
--  ---------------------------------------------------------------------------
--  A SOLUÇÃO: DOIS PAPÉIS, DOIS MOMENTOS
--
--    · solarcosta_app       — o processo da API. DML e nada além disso.
--    · solarcosta_migrator  — só o `npm run migrate`. DONO dos objetos, faz DDL.
--
--  O que isso compra, concretamente: o processo que atende requisição HTTP
--  nunca segura uma conexão capaz de CREATE, ALTER ou DROP. Uma injeção de SQL
--  ou um bug de rota não alcança o schema, porque a conexão daquele processo
--  simplesmente não tem esse poder.
--
--  O que isso NÃO compra: as duas credenciais vivem no ambiente do mesmo
--  container. Quem comprometer o container inteiro lê as duas. Proteger contra
--  ISSO exigiria rodar a migração como job separado, fora do container da API —
--  mudança de infraestrutura, não de banco. Vale saber a diferença em vez de
--  achar que o problema está resolvido até o fim.
--
--  ---------------------------------------------------------------------------
--  POR QUE TRANSFERIR A PROPRIEDADE, E NÃO SÓ DAR "CREATE"
--
--  GRANT CREATE ON SCHEMA deixa criar tabela NOVA. Não deixa alterar as que já
--  existem: `ALTER TABLE ... ADD COLUMN` e `ALTER TYPE ... ADD VALUE` exigem ser
--  DONO do objeto. Como quase toda migration mexe em algo anterior (o V009
--  acrescenta uma coluna em SolarCosta_UsuarioPermissoes e um valor num ENUM),
--  só o GRANT deixaria o migrate falhando no primeiro ALTER.
-- =============================================================================

BEGIN;

-- A seção 2 pede ACCESS EXCLUSIVE em cada tabela SolarCosta_, e o padrão do
-- Postgres é esperar por esse lock PARA SEMPRE. Numa base com cliente gráfico
-- aberto — que mantém sessões consultando metadados o tempo todo — isso vira
-- um script pendurado, sem erro e sem fim.
--
-- Com o teto, ele desiste em 10s e diz o que houve. Se falhar aqui, feche as
-- abas do cliente SQL e rode de novo; ou use o runner em Node, que reaplica
-- sozinho (ver o passo de migração no EASYPANEL.md).
SET LOCAL lock_timeout = '10s';

-- -----------------------------------------------------------------------------
-- 1. O PAPEL
-- -----------------------------------------------------------------------------
DO $mig$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'solarcosta_migrator') THEN
        CREATE ROLE solarcosta_migrator LOGIN PASSWORD 'TROQUE_ESTA_SENHA_MIGRATOR';  -- <<< TROCAR
    END IF;
END $mig$;

GRANT CONNECT ON DATABASE "SolarCosta" TO solarcosta_migrator;
GRANT USAGE, CREATE ON SCHEMA public   TO solarcosta_migrator;


-- -----------------------------------------------------------------------------
-- 2. PROPRIEDADE DOS OBJETOS EXISTENTES
--
--    Só o que tem o prefixo SolarCosta_. O servidor hospeda outros sistemas no
--    mesmo Postgres (Recanto, QuantumJus...), e um REASSIGN OWNED BY postgres
--    arrastaria todos eles junto — por isso a varredura é por nome, e não pelo
--    dono atual.
-- -----------------------------------------------------------------------------
DO $dono$
DECLARE r record;
BEGIN
    -- Tabelas, views, views materializadas, sequências e tabelas particionadas.
    -- Índice e trigger não aparecem aqui: eles seguem o dono da tabela.
    --
    -- E SEQUÊNCIA DE `serial`/`identity` TAMBÉM SEGUE. O Postgres recusa
    -- explicitamente mudá-la em separado ("cannot change owner of sequence
    -- ... is linked to table ..."), porque o dono dela é uma consequência do
    -- dono da coluna. O NOT EXISTS abaixo descarta essas, mantendo apenas
    -- sequência avulsa — criada por CREATE SEQUENCE, sem coluna atrás.
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
                      AND d.objid = c.oid
                      AND d.deptype IN ('a', 'i')
               )
           )
    LOOP
        EXECUTE format(
            CASE r.relkind
                WHEN 'v' THEN 'ALTER VIEW %I OWNER TO solarcosta_migrator'
                WHEN 'm' THEN 'ALTER MATERIALIZED VIEW %I OWNER TO solarcosta_migrator'
                WHEN 'S' THEN 'ALTER SEQUENCE %I OWNER TO solarcosta_migrator'
                ELSE            'ALTER TABLE %I OWNER TO solarcosta_migrator'
            END, r.relname);
    END LOOP;

    -- ENUMs. É o que permite o `ALTER TYPE ... ADD VALUE` das migrations —
    -- foi assim que 'Site' entrou no V008 e 'WhatsApp' no V009.
    FOR r IN
        SELECT t.typname
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
         WHERE n.nspname = 'public'
           AND t.typname LIKE 'SolarCosta%'
           AND t.typtype = 'e'
    LOOP
        EXECUTE format('ALTER TYPE %I OWNER TO solarcosta_migrator', r.typname);
    END LOOP;

    -- Funções e triggers. `oid::regprocedure` já traz a assinatura com os
    -- parâmetros, que é o que o ALTER FUNCTION exige para desambiguar.
    FOR r IN
        SELECT p.oid::regprocedure AS assinatura
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname LIKE 'SolarCosta%'
    LOOP
        EXECUTE format('ALTER FUNCTION %s OWNER TO solarcosta_migrator', r.assinatura);
    END LOOP;
END $dono$;


-- -----------------------------------------------------------------------------
-- 3. PRIVILÉGIOS PADRÃO PARA O QUE O MIGRATOR CRIAR DAQUI PARA A FRENTE
--
--    ESTE É O PONTO FÁCIL DE ERRAR. O `ALTER DEFAULT PRIVILEGES` do
--    02_papeis.sql foi escrito sem `FOR ROLE`, então vale só para objetos
--    criados por QUEM RODOU AQUELE ARQUIVO (o postgres). Tabela criada pelo
--    solarcosta_migrator não seria alcançada — e a API tomaria "permission
--    denied" na primeira consulta à tabela nova, depois de um deploy que
--    pareceu bem-sucedido.
-- -----------------------------------------------------------------------------
-- Cada bloco só roda se o papel existir.
--
-- Sem essa guarda o arquivo assume que o 02_papeis.sql foi aplicado inteiro —
-- e numa instalação onde o solarcosta_leitura nunca foi criado, o GRANT para
-- ele falha, a política "parar + rollback" do cliente desfaz a transação, e o
-- CREATE ROLE do começo some junto. O sintoma é cruel: o script parece ter
-- rodado e o papel simplesmente não existe.
DO $priv$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'solarcosta_app') THEN
        EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE solarcosta_migrator IN SCHEMA public
                 GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO solarcosta_app';
        EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE solarcosta_migrator IN SCHEMA public
                 GRANT USAGE, SELECT ON SEQUENCES TO solarcosta_app';
        EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE solarcosta_migrator IN SCHEMA public
                 GRANT EXECUTE ON FUNCTIONS TO solarcosta_app';
    ELSE
        RAISE NOTICE 'solarcosta_app nao existe — pulei os privilegios padrao dele. Rode 02_papeis.sql.';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'solarcosta_leitura') THEN
        EXECUTE 'ALTER DEFAULT PRIVILEGES FOR ROLE solarcosta_migrator IN SCHEMA public
                 GRANT SELECT ON TABLES TO solarcosta_leitura';
    ELSE
        RAISE NOTICE 'solarcosta_leitura nao existe — pulei os privilegios padrao dele.';
    END IF;
END $priv$;


-- -----------------------------------------------------------------------------
-- 4. REAPLICA OS GRANTS DO 02_papeis.sql
--
--    Troca de dono não apaga GRANT, mas repetir aqui torna este arquivo capaz
--    de se curar sozinho: rodar de novo depois de uma migration aplicada à mão
--    por outro papel reconcilia tudo, em vez de deixar uma tabela órfã de
--    permissão esperando para falhar em produção.
-- -----------------------------------------------------------------------------
DO $grants$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'solarcosta_app') THEN
        EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO solarcosta_app';
        EXECUTE 'GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA public TO solarcosta_app';
        EXECUTE 'GRANT EXECUTE                        ON ALL FUNCTIONS IN SCHEMA public TO solarcosta_app';

        -- A trilha de auditoria continua append-only para a API.
        EXECUTE 'REVOKE UPDATE, DELETE ON "SolarCosta_Auditoria" FROM solarcosta_app';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'solarcosta_leitura') THEN
        EXECUTE 'GRANT SELECT ON ALL TABLES IN SCHEMA public TO solarcosta_leitura';

        -- E o hash de senha continua fora do alcance de quem só consulta.
        EXECUTE 'REVOKE SELECT ON "SolarCosta_Usuarios" FROM solarcosta_leitura';
        EXECUTE 'GRANT SELECT (id, nome, email, telefone, cargo, status, ultimo_acesso, criado_em)
                 ON "SolarCosta_Usuarios" TO solarcosta_leitura';
    END IF;
END $grants$;

COMMIT;

-- =============================================================================
-- CONFERÊNCIA
-- =============================================================================
-- Deve devolver 'solarcosta_migrator' em toda linha:
--
-- SELECT c.relname, pg_get_userbyid(c.relowner) AS dono
--   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--  WHERE n.nspname = 'public' AND c.relname LIKE 'SolarCosta%'
--    AND c.relkind IN ('r','p','v','m','S')
--  ORDER BY dono, c.relname;
