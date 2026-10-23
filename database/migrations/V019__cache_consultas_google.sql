BEGIN;

CREATE TABLE IF NOT EXISTS "SolarCosta_CacheConsultasGoogle" (
    chave text PRIMARY KEY,
    resposta jsonb NOT NULL,
    criado_em timestamptz NOT NULL DEFAULT clock_timestamp(),
    expira_em timestamptz NOT NULL,
    CHECK (expira_em > criado_em)
);

CREATE INDEX IF NOT EXISTS idx_cache_google_expiracao
    ON "SolarCosta_CacheConsultasGoogle" (expira_em);

COMMENT ON TABLE "SolarCosta_CacheConsultasGoogle" IS
    'Cache temporário de geolocalização e análise solar, compartilhado entre propostas.';

DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'solarcosta_app') THEN
        GRANT SELECT, INSERT, UPDATE, DELETE ON "SolarCosta_CacheConsultasGoogle" TO solarcosta_app;
    END IF;
END $$;

COMMIT;
