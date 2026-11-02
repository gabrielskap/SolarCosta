BEGIN;
-- A tabela pode já existir em instalações atualizadas manualmente ou quando
-- a criação foi concluída antes do registro em SolarCosta_SchemaMigrations.
-- Preserva os aparelhos cadastrados e permite concluir o registro da V029.
CREATE TABLE IF NOT EXISTS "SolarCosta_Aparelhos" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ambiente varchar(80) NOT NULL CHECK (length(trim(ambiente)) > 0),
  nome varchar(160) NOT NULL CHECK (length(trim(nome)) > 0),
  potencia_w numeric(12,2) NOT NULL CHECK (potencia_w > 0),
  UNIQUE (ambiente, nome)
);
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'solarcosta_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "SolarCosta_Aparelhos" TO solarcosta_app;
  END IF;
END $$;
COMMIT;
