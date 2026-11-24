BEGIN;
ALTER TABLE "SolarCosta_Propostas"
  ADD COLUMN IF NOT EXISTS data_proposta date;
UPDATE "SolarCosta_Propostas"
  SET data_proposta = (criado_em AT TIME ZONE 'America/Sao_Paulo')::date
  WHERE data_proposta IS NULL;
ALTER TABLE "SolarCosta_Propostas"
  ALTER COLUMN data_proposta SET DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date),
  ALTER COLUMN data_proposta SET NOT NULL;
COMMENT ON COLUMN "SolarCosta_Propostas".data_proposta IS
  'Data de emissão editável da proposta, independente da data de criação.';
COMMIT;
