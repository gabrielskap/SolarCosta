BEGIN;

ALTER TABLE "SolarCosta_Leads"
    ADD COLUMN IF NOT EXISTS numero_endereco text;

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
    c.nome AS concessionaria,
    t.nome AS telhado,
    o.nome AS origem,
    l.responsavel_id,
    u.nome AS responsavel,
    l.etapa,
    l.valor_estimado,
    l.proposta_vinculada_id,
    l.observacoes,
    l.criado_em,
    COALESCE(h.ultima_interacao, l.criado_em)                        AS ultima_interacao,
    (CURRENT_DATE - COALESCE(h.ultima_interacao, l.criado_em)::date) AS dias_sem_contato,
    COALESCE(d.qtd_documentos, 0)                                    AS qtd_documentos,
    COALESCE(h.qtd_interacoes, 0)                                    AS qtd_interacoes,
    l.latitude,
    l.longitude,
    l.place_id,
    l.numero_endereco
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
