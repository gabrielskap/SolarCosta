BEGIN;
ALTER TABLE "SolarCosta_Propostas"
  ADD COLUMN IF NOT EXISTS garantias_equipamentos jsonb
  CHECK (garantias_equipamentos IS NULL OR jsonb_typeof(garantias_equipamentos) = 'object');
COMMENT ON COLUMN "SolarCosta_Propostas".garantias_equipamentos IS
  'Prazos por proposta: produto dos módulos, performance dos módulos e produto dos inversores. NULL mantém os prazos legados.';
COMMIT;
