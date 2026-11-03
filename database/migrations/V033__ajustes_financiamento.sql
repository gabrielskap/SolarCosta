BEGIN;
ALTER TABLE "SolarCosta_Propostas"
  ADD COLUMN IF NOT EXISTS financiamento_ajustes jsonb
  CHECK (financiamento_ajustes IS NULL OR jsonb_typeof(financiamento_ajustes) = 'object');
COMMENT ON COLUMN "SolarCosta_Propostas".financiamento_ajustes IS
  'Valores comerciais ajustados individualmente pelo consultor sobre a simulação BCB. NULL usa todos os resultados calculados.';
COMMIT;
