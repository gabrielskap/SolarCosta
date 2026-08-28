-- =============================================================================
--  SOLAR COSTA · V004 — Views de leitura
--
--  Cada view substitui um cálculo que hoje o React faz em memória sobre os
--  arrays mockados (DashboardView, ReportsView, FinancialView,
--  utils/notifications.ts, ObrasView, SuppliersProductsView).
--  A API Express expõe estas views nos endpoints GET.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. LEADS — formato consumido pelo Kanban e pela tela de detalhe
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
    COALESCE(h.qtd_interacoes, 0)                                         AS qtd_interacoes
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


-- Pastas de documentos com contagem REAL por lead
-- (LeadDetailView.folderNames tinha count e date fixos no código).
CREATE OR REPLACE VIEW "SolarCosta_vw_PastasDocumentos" AS
SELECT
    l.id                        AS lead_id,
    p.id                        AS pasta_id,
    p.nome                      AS pasta,
    p.ordem,
    count(d.id)                 AS qtd_arquivos,
    max(d.enviado_em)           AS ultimo_envio
FROM "SolarCosta_Leads" l
CROSS JOIN "SolarCosta_PastasDocumento" p
LEFT JOIN "SolarCosta_LeadDocumentos" d
       ON d.lead_id = l.id AND d.pasta_id = p.id AND d.excluido_em IS NULL
WHERE l.excluido_em IS NULL AND p.ativo
GROUP BY l.id, p.id, p.nome, p.ordem;


-- =============================================================================
-- 2. CATÁLOGO
-- =============================================================================

-- `produtosQtd` do mock passa a ser calculado.
CREATE OR REPLACE VIEW "SolarCosta_vw_Fornecedores" AS
SELECT
    f.*,
    COALESCE(p.produtos_qtd, 0)     AS produtos_qtd,
    COALESCE(p.valor_estoque, 0)    AS valor_estoque
FROM "SolarCosta_Fornecedores" f
LEFT JOIN LATERAL (
    SELECT count(*) AS produtos_qtd, SUM(pr.preco * pr.estoque) AS valor_estoque
      FROM "SolarCosta_Produtos" pr
     WHERE pr.fornecedor_id = f.id AND pr.ativo
) p ON true;


CREATE OR REPLACE VIEW "SolarCosta_vw_Produtos" AS
SELECT
    p.id,
    p.codigo,
    p.nome,
    p.tipo_codigo,
    tp.label            AS tipo_label,
    p.fornecedor_id,
    f.nome              AS fornecedor_nome,
    p.preco,
    p.estoque,
    p.estoque_minimo,
    p.unidade,
    p.potencia_wp,
    p.ativo,
    round(p.preco * p.estoque, 2) AS valor_em_estoque,
    -- Faixas usadas em SuppliersProductsView (ESTOQUE_CRITICO / ESTOQUE_BAIXO),
    -- agora vindas de SolarCosta_Parametros.
    CASE
        WHEN p.estoque <= "SolarCosta_fn_param_num"('estoque.critico', 10) THEN 'critico'
        WHEN p.estoque <= "SolarCosta_fn_param_num"('estoque.baixo',   25) THEN 'baixo'
        ELSE 'normal'
    END AS situacao_estoque
FROM "SolarCosta_Produtos" p
LEFT JOIN "SolarCosta_TiposProduto"  tp ON tp.codigo = p.tipo_codigo
LEFT JOIN "SolarCosta_Fornecedores"  f  ON f.id = p.fornecedor_id;


CREATE OR REPLACE VIEW "SolarCosta_vw_EstoqueCritico" AS
SELECT *
  FROM "SolarCosta_vw_Produtos"
 WHERE ativo AND situacao_estoque IN ('critico', 'baixo')
 ORDER BY estoque ASC;


-- =============================================================================
-- 3. DASHBOARD E RELATÓRIOS
-- =============================================================================

-- Funil: substitui leadsByStageData de DashboardView.tsx
CREATE OR REPLACE VIEW "SolarCosta_vw_FunilLeads" AS
SELECT
    e.etapa,
    e.ordem,
    count(l.id)                          AS quantidade,
    COALESCE(SUM(l.valor_estimado), 0)   AS valor
FROM (VALUES
        ('Novo lead'::"SolarCosta_EtapaLead",       1),
        ('Contato feito',                           2),
        ('Visita técnica',                          3),
        ('Proposta enviada',                        4),
        ('Negociação',                              5),
        ('Fechado',                                 6)
     ) AS e(etapa, ordem)
LEFT JOIN "SolarCosta_Leads" l
       ON l.etapa = e.etapa AND l.excluido_em IS NULL
GROUP BY e.etapa, e.ordem
ORDER BY e.ordem;


-- Faturamento mensal: substitui monthlyRevenueData de DashboardView.tsx
CREATE OR REPLACE VIEW "SolarCosta_vw_FaturamentoMensal" AS
WITH meses AS (
    SELECT date_trunc('month', d)::date AS mes
      FROM generate_series(
             date_trunc('year', CURRENT_DATE),
             date_trunc('year', CURRENT_DATE) + interval '11 months',
             interval '1 month') d
)
SELECT
    m.mes,
    EXTRACT(MONTH FROM m.mes)::int AS numero_mes,
    to_char(m.mes, 'TMMon')        AS rotulo,
    COALESCE(r.receita, 0)         AS faturamento,
    COALESCE(dp.despesa, 0)        AS despesa,
    COALESCE(r.receita, 0) - COALESCE(dp.despesa, 0) AS resultado,
    COALESCE(pr.propostas_valor, 0) AS propostas_valor,
    COALESCE(pr.propostas_qtd, 0)   AS propostas_qtd
FROM meses m
LEFT JOIN LATERAL (
    SELECT SUM(l.valor) AS receita
      FROM "SolarCosta_LancamentosFinanceiros" l
     WHERE l.excluido_em IS NULL AND l.tipo = 'receita'
       AND date_trunc('month', l.data)::date = m.mes
) r ON true
LEFT JOIN LATERAL (
    SELECT SUM(l.valor) AS despesa
      FROM "SolarCosta_LancamentosFinanceiros" l
     WHERE l.excluido_em IS NULL AND l.tipo = 'despesa'
       AND date_trunc('month', l.data)::date = m.mes
) dp ON true
LEFT JOIN LATERAL (
    SELECT SUM(p.valor_total) AS propostas_valor, count(*) AS propostas_qtd
      FROM "SolarCosta_Propostas" p
     WHERE p.excluido_em IS NULL
       AND date_trunc('month', p.criado_em)::date = m.mes
) pr ON true
ORDER BY m.mes;


-- Despesas por categoria: substitui despesasPorCategoria de FinancialView.tsx
CREATE OR REPLACE VIEW "SolarCosta_vw_DespesasPorCategoria" AS
SELECT
    COALESCE(c.nome, 'Outros')                       AS categoria,
    date_trunc('month', l.data)::date                AS mes,
    SUM(l.valor)                                     AS valor,
    round(100 * SUM(l.valor) / NULLIF(SUM(SUM(l.valor)) OVER (PARTITION BY date_trunc('month', l.data)), 0), 2) AS pct
FROM "SolarCosta_LancamentosFinanceiros" l
LEFT JOIN "SolarCosta_CategoriasFinanceiras" c ON c.id = l.categoria_id
WHERE l.excluido_em IS NULL AND l.tipo = 'despesa'
GROUP BY COALESCE(c.nome, 'Outros'), date_trunc('month', l.data)
ORDER BY mes DESC, valor DESC;


-- Desempenho por vendedor: substitui salesVolumeData de DashboardView.tsx
CREATE OR REPLACE VIEW "SolarCosta_vw_DesempenhoVendedor" AS
SELECT
    u.id                                                       AS usuario_id,
    u.nome,
    u.cargo,
    count(*) FILTER (WHERE l.etapa NOT IN ('Fechado'))         AS leads_ativos,
    count(*) FILTER (WHERE l.etapa IN ('Proposta enviada','Negociação')) AS propostas_qtd,
    count(*) FILTER (WHERE l.etapa = 'Fechado')                AS contratos_qtd,
    COALESCE(SUM(l.valor_estimado) FILTER (WHERE l.etapa = 'Fechado'), 0) AS valor_vendas,
    COALESCE(SUM(l.valor_estimado), 0)                         AS valor_pipeline,
    round(
        100.0 * count(*) FILTER (WHERE l.etapa = 'Fechado') / NULLIF(count(*), 0)
    , 2)                                                       AS taxa_conversao_pct
FROM "SolarCosta_Usuarios" u
JOIN "SolarCosta_Leads" l ON l.responsavel_id = u.id AND l.excluido_em IS NULL
WHERE u.excluido_em IS NULL
GROUP BY u.id, u.nome, u.cargo
ORDER BY valor_vendas DESC;


-- KPIs do topo do dashboard (cards) + meta anual vinda de Parametros.
CREATE OR REPLACE VIEW "SolarCosta_vw_DashboardKPIs" AS
SELECT
    (SELECT count(*) FROM "SolarCosta_Leads"
      WHERE excluido_em IS NULL AND etapa <> 'Fechado')                         AS leads_ativos,
    (SELECT COALESCE(SUM(valor_estimado), 0) FROM "SolarCosta_Leads"
      WHERE excluido_em IS NULL AND etapa <> 'Fechado')                         AS pipeline_valor,
    (SELECT count(*) FROM "SolarCosta_Propostas"
      WHERE excluido_em IS NULL AND status = 'enviada')                         AS propostas_abertas,
    (SELECT count(*) FROM "SolarCosta_Contratos"
      WHERE excluido_em IS NULL AND status = 'assinado'
        AND date_trunc('year', data_emissao) = date_trunc('year', CURRENT_DATE)) AS contratos_ano,
    (SELECT COALESCE(SUM(valor), 0) FROM "SolarCosta_LancamentosFinanceiros"
      WHERE excluido_em IS NULL AND tipo = 'receita'
        AND date_trunc('year', data) = date_trunc('year', CURRENT_DATE))        AS faturamento_ano,
    (SELECT COALESCE(SUM(valor), 0) FROM "SolarCosta_LancamentosFinanceiros"
      WHERE excluido_em IS NULL AND tipo = 'receita'
        AND date_trunc('month', data) = date_trunc('month', CURRENT_DATE))      AS faturamento_mes,
    (SELECT COALESCE(SUM(valor), 0) FROM "SolarCosta_Boletos"
      WHERE excluido_em IS NULL AND tipo = 'a_receber' AND situacao <> 'pago')  AS a_receber,
    (SELECT COALESCE(SUM(valor), 0) FROM "SolarCosta_Boletos"
      WHERE excluido_em IS NULL AND tipo = 'a_pagar'   AND situacao <> 'pago')  AS a_pagar,
    (SELECT count(*) FROM "SolarCosta_Obras"
      WHERE excluido_em IS NULL AND status = 'em_andamento')                    AS obras_andamento,
    (SELECT COALESCE(SUM(potencia_kwp), 0) FROM "SolarCosta_Obras"
      WHERE excluido_em IS NULL AND status = 'concluida')                       AS kwp_instalado,
    "SolarCosta_fn_param_num"('meta.faturamento_anual', 0)                      AS meta_anual;


-- =============================================================================
-- 4. OBRAS — painel com progresso de homologação e atraso
-- =============================================================================

CREATE OR REPLACE VIEW "SolarCosta_vw_ObrasPainel" AS
SELECT
    o.id,
    o.numero,
    o.cliente_nome,
    o.cidade,
    o.endereco,
    c.nome                       AS concessionaria,
    o.potencia_kwp,
    o.modulos_qtd,
    o.modulo_modelo,
    o.inversor_modelo,
    o.responsavel_tecnico_id,
    u.nome                       AS responsavel_tecnico,
    o.equipe_instalacao,
    o.etapa,
    o.status,
    o.valor_obra,
    o.data_inicio,
    o.previsao_conclusao,
    o.data_conclusao,
    o.estoque_baixado,
    o.observacoes,
    -- Progresso da etapa (ETAPA_PROGRESSO de ObrasView.tsx)
    CASE o.etapa
        WHEN 'Aguardando compra'  THEN 10
        WHEN 'Projeto / ART'      THEN 30
        WHEN 'Homologação'        THEN 50
        WHEN 'Instalação'         THEN 70
        WHEN 'Vistoria / troca'   THEN 90
        WHEN 'Concluída'          THEN 100
    END AS progresso_pct,
    -- Itens concluídos do checklist de homologação (0..6)
    (h.solicitacao_acesso::int + h.parecer_acesso::int + h.vistoria_agendada::int
     + h.vistoria_aprovada::int + h.troca_medidor::int + h.relatorio_conexao::int) AS homologacao_concluida,
    6 AS homologacao_total,
    -- isAtrasada() de ObrasView.tsx
    (o.status <> 'concluida'
     AND o.previsao_conclusao IS NOT NULL
     AND o.previsao_conclusao < CURRENT_DATE) AS atrasada,
    (o.previsao_conclusao - CURRENT_DATE)     AS dias_para_prazo,
    COALESCE(k.itens_kit, 0)                  AS itens_kit
FROM "SolarCosta_Obras" o
LEFT JOIN "SolarCosta_ObraHomologacao"  h ON h.obra_id = o.id
LEFT JOIN "SolarCosta_Concessionarias"  c ON c.id = o.concessionaria_id
LEFT JOIN "SolarCosta_Usuarios"         u ON u.id = o.responsavel_tecnico_id
LEFT JOIN LATERAL (
    SELECT count(*) AS itens_kit FROM "SolarCosta_ObraKitItens" ki WHERE ki.obra_id = o.id
) k ON true
WHERE o.excluido_em IS NULL;


-- =============================================================================
-- 5. CENTRAL DE NOTIFICAÇÕES
--    Porta SQL de utils/notifications.ts. Usa CURRENT_DATE (o front deixa de
--    depender de REFERENCE_TODAY) e o limiar vem de SolarCosta_Parametros.
-- =============================================================================

CREATE OR REPLACE VIEW "SolarCosta_vw_Notificacoes" AS

-- 1. Boletos vencidos ---------------------------------------------------------
SELECT
    'nt-boleto-' || b.id::text                        AS chave,
    'boleto_vencido'                                  AS categoria,
    'alta'                                            AS prioridade,
    format('Boleto vencido · %s', b.cliente_nome)     AS titulo,
    format('%s — parcela %s · R$ %s',
           CASE b.tipo WHEN 'a_receber' THEN 'A receber' ELSE 'A pagar' END,
           COALESCE(b.parcela_label, '-'),
           to_char(b.valor, 'FM999G999G990D00'))      AS descricao,
    format('vencido há %s dia(s) (%s)',
           CURRENT_DATE - b.vencimento,
           to_char(b.vencimento, 'DD/MM/YYYY'))       AS meta,
    'financeiro'                                      AS destino_tab,
    b.lead_id                                         AS lead_id,
    1                                                 AS peso,
    b.vencimento                                      AS referencia
FROM "SolarCosta_Boletos" b
WHERE b.excluido_em IS NULL
  AND b.situacao IN ('em_aberto', 'vencido')
  AND b.vencimento < CURRENT_DATE

UNION ALL

-- 2. Leads sem contato --------------------------------------------------------
SELECT
    'nt-lead-' || v.id::text,
    'lead_sem_contato',
    CASE WHEN v.dias_sem_contato >= 14 THEN 'alta' ELSE 'media' END,
    format('Lead sem contato · %s', v.nome),
    format('%s · %s · %s', v.etapa, COALESCE(v.responsavel, 'Sem responsável'), COALESCE(v.cidade, '-')),
    format('%s dias sem interação', v.dias_sem_contato),
    'detalhe_lead',
    v.id,
    CASE WHEN v.dias_sem_contato >= 14 THEN 1 ELSE 2 END,
    (CURRENT_DATE - v.dias_sem_contato)
FROM "SolarCosta_vw_Leads" v
WHERE v.etapa <> 'Fechado'
  AND v.dias_sem_contato >= "SolarCosta_fn_param_num"('lead.dias_sem_contato', 7)

UNION ALL

-- 3. Compromissos de hoje -----------------------------------------------------
SELECT
    'nt-visita-' || a.id::text,
    'visita_hoje',
    'media',
    format('Hoje · %s', a.titulo),
    format('%s · %s · %s', a.lead_nome,
           COALESCE(NULLIF(a.endereco, ''), COALESCE(a.cidade, '-')),
           COALESCE(u.nome, 'Sem responsável')),
    format('%s–%s', to_char(a.horario_inicio, 'HH24:MI'), to_char(a.horario_fim, 'HH24:MI')),
    'agenda',
    a.lead_id,
    2,
    a.data
FROM "SolarCosta_Agendamentos" a
LEFT JOIN "SolarCosta_Usuarios" u ON u.id = a.responsavel_id
WHERE a.excluido_em IS NULL
  AND a.status = 'agendado'
  AND a.data = CURRENT_DATE;


-- =============================================================================
-- 6. FINANCEIRO — extrato e fluxo de caixa
-- =============================================================================

CREATE OR REPLACE VIEW "SolarCosta_vw_Lancamentos" AS
SELECT
    l.id,
    l.data,
    l.descricao,
    l.categoria_id,
    COALESCE(c.nome, 'Outros')  AS categoria,
    l.obra_id,
    o.numero                    AS obra_ref,
    l.lead_id,
    l.boleto_id,
    l.tipo,
    l.valor,
    -- Valor com sinal para gráficos/extrato (o banco guarda sempre positivo).
    CASE WHEN l.tipo = 'despesa' THEN -l.valor ELSE l.valor END AS valor_com_sinal,
    l.forma,
    l.conciliado,
    l.usuario_id,
    u.nome                      AS usuario_nome,
    l.criado_em
FROM "SolarCosta_LancamentosFinanceiros" l
LEFT JOIN "SolarCosta_CategoriasFinanceiras" c ON c.id = l.categoria_id
LEFT JOIN "SolarCosta_Obras"                 o ON o.id = l.obra_id
LEFT JOIN "SolarCosta_Usuarios"              u ON u.id = l.usuario_id
WHERE l.excluido_em IS NULL;


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
    b.criado_em
FROM "SolarCosta_Boletos" b
LEFT JOIN "SolarCosta_CategoriasFinanceiras" c ON c.id = b.categoria_id
LEFT JOIN "SolarCosta_Obras"                 o ON o.id = b.obra_id
WHERE b.excluido_em IS NULL;


-- =============================================================================
-- 7. AGENDA E AUDITORIA (formato de tela)
-- =============================================================================

CREATE OR REPLACE VIEW "SolarCosta_vw_Agendamentos" AS
SELECT
    a.id,
    a.lead_id,
    COALESCE(l.nome, a.lead_nome) AS lead_nome,
    a.obra_id,
    a.tipo,
    a.titulo,
    a.data,
    a.horario_inicio,
    a.horario_fim,
    a.endereco,
    a.cidade,
    a.responsavel_id,
    u.nome                        AS responsavel,
    a.status,
    a.observacoes,
    a.criado_em
FROM "SolarCosta_Agendamentos" a
LEFT JOIN "SolarCosta_Leads"    l ON l.id = a.lead_id
LEFT JOIN "SolarCosta_Usuarios" u ON u.id = a.responsavel_id
WHERE a.excluido_em IS NULL;


CREATE OR REPLACE VIEW "SolarCosta_vw_Auditoria" AS
SELECT
    a.id,
    a.ocorrido_em,
    a.usuario_id,
    a.usuario_nome,
    a.acao,
    a.entidade,
    a.entidade_id,
    a.alvo,
    a.detalhes,
    a.ip
FROM "SolarCosta_Auditoria" a
ORDER BY a.ocorrido_em DESC;

COMMIT;
