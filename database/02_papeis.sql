-- =============================================================================
--  SOLAR COSTA · Papéis de acesso
--
--  Rode UMA VEZ, conectado como superusuário no banco SolarCosta.
--
--  Por que não usar `postgres` na API: se a aplicação for comprometida, um
--  superusuário dá acesso a todos os outros bancos do servidor (Recanto,
--  QuantumJus, etc.). O papel abaixo só enxerga este banco e só faz DML.
--
--  ANTES DE RODAR: troque as duas senhas nas linhas marcadas.
--  Gere cada uma com:  openssl rand -base64 32
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. solarcosta_app — usado pela API Express
-- -----------------------------------------------------------------------------
DO $app$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'solarcosta_app') THEN
        CREATE ROLE solarcosta_app LOGIN PASSWORD 'TROQUE_ESTA_SENHA_APP';   -- <<< TROCAR
    END IF;
END $app$;

GRANT CONNECT ON DATABASE "SolarCosta" TO solarcosta_app;
GRANT USAGE   ON SCHEMA public         TO solarcosta_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES    IN SCHEMA public TO solarcosta_app;
GRANT USAGE, SELECT                  ON ALL SEQUENCES IN SCHEMA public TO solarcosta_app;
GRANT EXECUTE                        ON ALL FUNCTIONS IN SCHEMA public TO solarcosta_app;

-- Tabelas criadas por migrations futuras já nascem acessíveis.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO solarcosta_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO solarcosta_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO solarcosta_app;

-- A trilha de auditoria é append-only: a API insere, nunca altera nem apaga.
-- (O trigger SolarCosta_tg_auditoria_imutavel já bloqueia, mas negar a
--  permissão evita até a tentativa.)
REVOKE UPDATE, DELETE ON "SolarCosta_Auditoria" FROM solarcosta_app;


-- -----------------------------------------------------------------------------
-- 2. solarcosta_leitura — consultas no DBeaver, relatórios, BI
-- -----------------------------------------------------------------------------
DO $ro$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'solarcosta_leitura') THEN
        CREATE ROLE solarcosta_leitura LOGIN PASSWORD 'TROQUE_ESTA_SENHA_LEITURA';  -- <<< TROCAR
    END IF;
END $ro$;

GRANT CONNECT ON DATABASE "SolarCosta" TO solarcosta_leitura;
GRANT USAGE   ON SCHEMA public         TO solarcosta_leitura;
GRANT SELECT  ON ALL TABLES IN SCHEMA public TO solarcosta_leitura;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT ON TABLES TO solarcosta_leitura;

-- Hash de senha não é assunto de quem só consulta.
REVOKE SELECT ON "SolarCosta_Usuarios" FROM solarcosta_leitura;
GRANT  SELECT (id, nome, email, telefone, cargo, status, ultimo_acesso, criado_em)
    ON "SolarCosta_Usuarios" TO solarcosta_leitura;

COMMIT;

-- =============================================================================
-- CONFERÊNCIA
-- =============================================================================
-- SELECT rolname, rolcanlogin, rolsuper
--   FROM pg_roles WHERE rolname LIKE 'solarcosta%';
