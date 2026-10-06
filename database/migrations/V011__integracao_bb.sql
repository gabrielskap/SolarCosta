-- =============================================================================
--  SOLAR COSTA · V011 — Integração com a API de Cobranças do Banco do Brasil
--
--  Até aqui "Emitir Boleto Banco do Brasil" (FinancialView.tsx) só gravava um
--  boleto com linha_digitavel vazia — o vendedor emitia por fora do sistema e
--  colava o código depois. Esta migration prepara o schema para o registro de
--  verdade via server/src/services/bb/cobrancas.ts:
--    · nosso_numero e linha_digitavel já existiam (V001), mas nosso_numero
--      nunca apareceu em SolarCosta_vw_Boletos — corrigido aqui, porque é por
--      ele que o webhook de baixa operacional encontra o boleto;
--    · pix_txid/pix_qrcode guardam o retorno do "boleto com Pix" (bolepix),
--      quando o campo indicadorPix é enviado como 'S' no registro;
--    · bb_situacao_codigo guarda o código bruto que o BB devolve, para
--      depurar uma eventual divergência com o enum SolarCosta_SituacaoBoleto.
--
--  SolarCosta_BBWebhookEventos guarda o payload bruto de cada evento recebido
--  em /api/webhooks/bb — o BB não documenta política de retry, então é o que
--  sobra para investigar um evento que não bateu com nenhum boleto.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. BOLETOS — campos do registro via API
-- =============================================================================

ALTER TABLE "SolarCosta_Boletos"
    ADD COLUMN IF NOT EXISTS bb_numero_convenio integer,
    ADD COLUMN IF NOT EXISTS pix_txid           text,
    ADD COLUMN IF NOT EXISTS pix_qrcode         text,
    ADD COLUMN IF NOT EXISTS bb_situacao_codigo smallint;

COMMENT ON COLUMN "SolarCosta_Boletos".bb_numero_convenio IS
    'Convênio de cobrança usado no registro (BB_CONVENIO_COBRANCA no momento '
    'da emissão). Guardado por linha, e não só no .env, porque o convênio pode '
    'mudar com o tempo e um boleto antigo precisa continuar identificável.';
COMMENT ON COLUMN "SolarCosta_Boletos".pix_txid IS
    'txid do Pix vinculado ao boleto (bolepix), quando emitido com indicadorPix.';
COMMENT ON COLUMN "SolarCosta_Boletos".pix_qrcode IS
    'Copia-e-cola (EMV) do QR Code Pix vinculado ao boleto (bolepix).';
COMMENT ON COLUMN "SolarCosta_Boletos".bb_situacao_codigo IS
    'codigoEstadoTituloCobranca bruto, como devolvido pelo BB (ver Especificações '
    'da API de Cobranças). Só para depuração — quem manda no sistema é `situacao`.';

-- O webhook e a rotina de baixa operacional (scheduler) buscam o boleto por
-- nosso_numero; sem índice, essa busca faz seq scan a cada evento recebido.
CREATE INDEX IF NOT EXISTS "SolarCosta_ix_Boletos_nosso_numero"
    ON "SolarCosta_Boletos" (nosso_numero) WHERE nosso_numero IS NOT NULL;


-- Sequencial do "nosso número" (numeroTituloCliente = "000" + convênio(7) +
-- sequencial(10)). Assume convênio tipo 4 (Cliente Numera, Emite e Expede) —
-- ver server/src/services/bb/cobrancas.ts. Sequência própria, e não
-- MAX(nosso_numero)+1, porque dois registros concorrentes não podem tirar o
-- mesmo número.
CREATE SEQUENCE IF NOT EXISTS "SolarCosta_seq_bb_nosso_numero" AS bigint START 1;


-- =============================================================================
-- 2. EVENTOS DE WEBHOOK — payload bruto, para depuração
-- =============================================================================

CREATE TABLE IF NOT EXISTS "SolarCosta_BBWebhookEventos" (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo          text NOT NULL,
    payload       jsonb NOT NULL,
    boleto_id     uuid REFERENCES "SolarCosta_Boletos"(id) ON DELETE SET NULL,
    recebido_em   timestamptz NOT NULL DEFAULT now(),
    processado_em timestamptz,
    erro          text
);

COMMENT ON TABLE "SolarCosta_BBWebhookEventos" IS
    'Payload bruto de cada evento recebido em /api/webhooks/bb. O BB não '
    'documenta reenvio em caso de falha do nosso lado, então isto é o que '
    'sobra para reprocessar ou investigar um evento que não bateu com nenhum '
    'boleto (nosso_numero desconhecido, boleto já baixado, etc).';
COMMENT ON COLUMN "SolarCosta_BBWebhookEventos".boleto_id IS
    'Nulo quando o payload não casou com nenhum boleto (nosso_numero '
    'desconhecido) — não é erro do nosso lado, então não vira `erro`.';

CREATE INDEX "SolarCosta_ix_BBWebhookEventos_recebido"
    ON "SolarCosta_BBWebhookEventos" (recebido_em DESC);


-- =============================================================================
-- 3. VIEW — expor os campos novos
--
--    CREATE OR REPLACE VIEW não deixa mudar nome/posição de coluna já
--    existente, só ACRESCENTAR no fim (mesma regra do comentário na V006,
--    item 2) — por isso nosso_numero/pix_txid/pix_qrcode vão depois de
--    criado_em, e não perto de linha_digitavel como seria mais lógico.
-- =============================================================================

CREATE OR REPLACE VIEW "SolarCosta_vw_Boletos" AS
SELECT
    b.id,
    b.numero_documento,
    b.linha_digitavel,
    b.cliente_nome,
    b.cpf_cnpj,
    b.valor,
    b.parcela_label,
    b.vencimento,
    b.situacao,
    b.tipo,
    COALESCE(c.nome, 'Outros') AS categoria,
    b.obra_id,
    o.numero                   AS obra_ref,
    b.lead_id,
    b.contrato_id,
    b.data_pagamento,
    b.valor_pago,
    (CURRENT_DATE - b.vencimento) AS dias_atraso,
    b.criado_em,
    -- V011: campos do registro via API de Cobranças do BB.
    b.nosso_numero,
    b.pix_txid,
    b.pix_qrcode
FROM "SolarCosta_Boletos" b
LEFT JOIN "SolarCosta_CategoriasFinanceiras" c ON c.id = b.categoria_id
LEFT JOIN "SolarCosta_Obras"                 o ON o.id = b.obra_id
WHERE b.excluido_em IS NULL;

COMMIT;
