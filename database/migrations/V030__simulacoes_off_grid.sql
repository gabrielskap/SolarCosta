BEGIN;
CREATE TABLE "SolarCosta_SimulacoesOffGrid" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES "SolarCosta_Leads"(id) ON DELETE SET NULL,
  titulo varchar(200) NOT NULL,
  dados jsonb NOT NULL,
  resultados jsonb NOT NULL,
  criado_por uuid REFERENCES "SolarCosta_Usuarios"(id) ON DELETE SET NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON "SolarCosta_SimulacoesOffGrid" (lead_id);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'solarcosta_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "SolarCosta_SimulacoesOffGrid" TO solarcosta_app;
  END IF;
END $$;
COMMIT;
