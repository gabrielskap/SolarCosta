BEGIN;
-- Snapshots novos são opt-in: não recalcular nem preencher propostas anteriores.
ALTER TABLE "SolarCosta_Propostas" ADD COLUMN IF NOT EXISTS calculo_solar jsonb;
ALTER TABLE "SolarCosta_Propostas" DROP CONSTRAINT IF EXISTS "SolarCosta_Propostas_consumo_kwh_check";
ALTER TABLE "SolarCosta_Propostas" DROP CONSTRAINT IF EXISTS "SolarCosta_Propostas_tarifa_kwh_check";
ALTER TABLE "SolarCosta_Propostas" DROP CONSTRAINT IF EXISTS "SolarCosta_Propostas_hsp_check";
ALTER TABLE "SolarCosta_Propostas" DROP CONSTRAINT IF EXISTS "SolarCosta_Propostas_modulo_wp_check";
ALTER TABLE "SolarCosta_Propostas" ADD CHECK (consumo_kwh >= 0), ADD CHECK (tarifa_kwh >= 0), ADD CHECK (hsp >= 0), ADD CHECK (modulo_wp >= 0);
ALTER TABLE "SolarCosta_Propostas" DROP CONSTRAINT IF EXISTS "SolarCosta_Propostas_financiamento_completo";
ALTER TABLE "SolarCosta_Propostas" ADD CONSTRAINT "SolarCosta_Propostas_financiamento_completo" CHECK (
  status = 'rascunho' OR forma_pagamento <> 'financiamento' OR parcelas_financiamento > 0
);
COMMIT;
