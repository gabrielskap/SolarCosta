-- =============================================================================
--  SOLAR COSTA · V012 — código de barras do boleto
--
--  registrarBoleto() (server/src/services/bb/cobrancas.ts) já recebe de volta
--  o codigoBarraNumerico (44 dígitos, o valor que o desenho do código de
--  barras representa — diferente da linha digitável, que tem 47 e leva
--  dígitos verificadores extras por campo), mas emitirBoletoNoBB nunca
--  persistia esse valor. Sem ele não dá pra desenhar o código de barras de
--  verdade no boleto em PDF — só a linha digitável em texto.
-- =============================================================================

BEGIN;

ALTER TABLE "SolarCosta_Boletos"
    ADD COLUMN IF NOT EXISTS codigo_barra_numerico varchar(44);

COMMENT ON COLUMN "SolarCosta_Boletos".codigo_barra_numerico IS
    'Código de barras FEBRABAN (44 dígitos), devolvido por registrarBoleto() '
    '(RegistroBoletoBB.codigoBarraNumerico). Usado para desenhar o barcode '
    '(formato ITF) no PDF do boleto — a linha digitável não serve pra isso.';

-- CREATE OR REPLACE VIEW não permite mudar posição de coluna já existente, só
-- ACRESCENTAR no fim (mesma regra da V011 — lista copiada dela, só com
-- codigo_barra_numerico a mais no final).
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
    b.nosso_numero,
    b.pix_txid,
    b.pix_qrcode,
    -- V012: código de barras p/ renderizar o barcode no PDF.
    b.codigo_barra_numerico
FROM "SolarCosta_Boletos" b
LEFT JOIN "SolarCosta_CategoriasFinanceiras" c ON c.id = b.categoria_id
LEFT JOIN "SolarCosta_Obras"                 o ON o.id = b.obra_id
WHERE b.excluido_em IS NULL;

COMMIT;
