BEGIN;
ALTER TABLE "SolarCosta_Propostas"
  ADD COLUMN IF NOT EXISTS pagamento_avista_etapas boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS entrada_avista_pct numeric(5,2) NOT NULL DEFAULT 50
    CHECK (entrada_avista_pct >= 0 AND entrada_avista_pct <= 100);
COMMENT ON COLUMN "SolarCosta_Propostas".entrada_avista_pct IS
  'Percentual de entrada à vista; o restante é pago na entrega da usina instalada quando habilitado.';
COMMIT;
