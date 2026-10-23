BEGIN;
ALTER TABLE "SolarCosta_Propostas"
  ADD COLUMN IF NOT EXISTS levantamento_telhado jsonb;
ALTER TABLE "SolarCosta_Propostas"
  DROP CONSTRAINT IF EXISTS "SolarCosta_Propostas_levantamento_objeto";
ALTER TABLE "SolarCosta_Propostas"
  ADD CONSTRAINT "SolarCosta_Propostas_levantamento_objeto"
  CHECK (levantamento_telhado IS NULL OR jsonb_typeof(levantamento_telhado) = 'object');
COMMENT ON COLUMN "SolarCosta_Propostas".levantamento_telhado IS
  'Levantamento manual versionado em metros, com imagem raster limitada, águas, obstáculos e módulos. Sem dependência de serviços externos.';
COMMIT;
