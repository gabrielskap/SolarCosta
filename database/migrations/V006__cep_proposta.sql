-- =============================================================================
--  SOLAR COSTA · V006 — CEP e número do imóvel na proposta
--
--  A busca do telhado por satélite passou a ser automática: o CEP dispara a
--  cadeia (ViaCEP -> Geocoding -> Solar API) e o NÚMERO do imóvel é o que
--  decide entre um ponto sobre o telhado (ROOFTOP) e um chute no meio da rua.
--
--  Por isso os dois viram coluna. Até aqui o CEP era digitado, usado para
--  preencher a linha de endereço e descartado — reabrir a proposta perdia
--  justamente o dado que originou a localização e recomeçaria pelo ponto
--  aproximado, gastando de novo as três chamadas faturadas do Google.
--
--  Esta migration também acrescenta à `SolarCosta_vw_Leads` as três colunas de
--  geolocalização criadas na V005, que nasceram inalcançáveis (ver item 2).
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. PROPOSTAS — endereço de instalação em partes
-- =============================================================================

ALTER TABLE "SolarCosta_Propostas"
    ADD COLUMN IF NOT EXISTS cep             text,
    -- `numero_endereco`, e NÃO `numero`: "SolarCosta_Propostas".numero já é o
    -- número da PROPOSTA ('2026-0184'), gerado pelo trigger
    -- SolarCosta_tg_numero_Propostas. Duas coisas diferentes com o mesmo nome
    -- na mesma tabela quebrariam desde o SELECT p.* de carregarProposta().
    ADD COLUMN IF NOT EXISTS numero_endereco text;

COMMENT ON COLUMN "SolarCosta_Propostas".numero_endereco IS
    'Número do imóvel (512, 512A, s/n, km 12). É ele que faz o geocoding cair '
    'em ROOFTOP; sem ele a Solar API responde 404 no ponto interpolado da via.';

-- =============================================================================
-- 2. VIEW DE LEADS — expor a coordenada gravada na V005
--
--    A V005 criou latitude/longitude/place_id em "SolarCosta_Leads", mas TODA
--    leitura de lead na API passa por esta view (SELECT * FROM vw_Leads, em
--    seis pontos de leads.routes.ts). Sem acrescentá-las aqui, o mapeamento no
--    front devolveria `undefined` para sempre e a coluna seguiria órfã.
--
--    CREATE OR REPLACE (e não DROP + CREATE) porque "SolarCosta_vw_Notificacoes"
--    depende desta view: o DROP exigiria CASCADE e levaria a outra junto. Em
--    troca, o PostgreSQL só aceita ACRESCENTAR colunas no fim da lista — daí as
--    três entrarem depois de qtd_interacoes, e não junto de cep/endereco.
-- =============================================================================

CREATE OR REPLACE VIEW "SolarCosta_vw_Leads" AS
SELECT
    l.id,
    l.numero,
    l.nome,
    l.cpf_cnpj,
    l.rg_inscricao,
    l.telefone,
    l.email,
    l.cep,
    l.endereco,
    l.bairro,
    l.cidade,
    l.uf,
    l.consumo_kwh,
    c.nome  AS concessionaria,
    t.nome  AS telhado,
    o.nome  AS origem,
    l.responsavel_id,
    u.nome  AS responsavel,
    l.etapa,
    l.valor_estimado,
    l.proposta_vinculada_id,
    l.observacoes,
    l.criado_em,
    -- Última interação registrada (histórico) ou, na falta dela, o cadastro.
    COALESCE(h.ultima_interacao, l.criado_em)                             AS ultima_interacao,
    (CURRENT_DATE - COALESCE(h.ultima_interacao, l.criado_em)::date)      AS dias_sem_contato,
    COALESCE(d.qtd_documentos, 0)                                         AS qtd_documentos,
    COALESCE(h.qtd_interacoes, 0)                                         AS qtd_interacoes,
    -- V006: coordenada do imóvel (V005), para a proposta abrir já localizada
    -- sem repetir o geocoding de um endereço que já foi resolvido uma vez.
    l.latitude,
    l.longitude,
    l.place_id
FROM "SolarCosta_Leads" l
LEFT JOIN "SolarCosta_Concessionarias" c ON c.id = l.concessionaria_id
LEFT JOIN "SolarCosta_TiposTelhado"     t ON t.id = l.tipo_telhado_id
LEFT JOIN "SolarCosta_OrigensLead"      o ON o.id = l.origem_id
LEFT JOIN "SolarCosta_Usuarios"         u ON u.id = l.responsavel_id
LEFT JOIN LATERAL (
    SELECT max(lh.ocorrido_em) AS ultima_interacao, count(*) AS qtd_interacoes
      FROM "SolarCosta_LeadHistorico" lh
     WHERE lh.lead_id = l.id
) h ON true
LEFT JOIN LATERAL (
    SELECT count(*) AS qtd_documentos
      FROM "SolarCosta_LeadDocumentos" ld
     WHERE ld.lead_id = l.id AND ld.excluido_em IS NULL
) d ON true
WHERE l.excluido_em IS NULL;

COMMIT;
