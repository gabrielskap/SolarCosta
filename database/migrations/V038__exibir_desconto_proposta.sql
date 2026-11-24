BEGIN;
ALTER TABLE "SolarCosta_Propostas"
  ADD COLUMN IF NOT EXISTS exibir_desconto_proposta boolean NOT NULL DEFAULT true;
COMMENT ON COLUMN "SolarCosta_Propostas".exibir_desconto_proposta IS
  'Exibe percentual e economia do desconto à vista no PDF; false mantém apenas o valor final.';
COMMIT;
