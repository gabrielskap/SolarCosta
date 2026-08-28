-- =============================================================================
--  SOLAR COSTA · V002 — Índices
--  Cada índice abaixo existe por causa de uma consulta real das telas do CRM.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- PRÉ-CONDIÇÃO: o V001 precisa ter COMMITADO.
-- Se ele falhou no meio, a transação inteira reverteu e NENHUMA tabela existe —
-- então todo CREATE INDEX aqui falharia com "relation does not exist", e o
-- DBeaver mostraria só o erro genérico 25P02 nas instruções seguintes.
-- -----------------------------------------------------------------------------
DO $pre$
DECLARE n integer;
BEGIN
    SELECT count(*) INTO n
      FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       AND table_name LIKE 'SolarCosta%';

    IF n < 36 THEN
        RAISE EXCEPTION
          'V001 nao foi aplicado por completo: encontrei % tabelas SolarCosta_ (esperado 36). Rode V001__schema_inicial.sql e leia o PRIMEIRO erro.', n;
    END IF;
END $pre$;

-- -----------------------------------------------------------------------------
-- Wrapper IMMUTABLE de unaccent().
-- unaccent() e STABLE (depende do dicionario carregado) e o PostgreSQL recusa
-- funcoes nao-imutaveis em expressao de indice. Este wrapper fixa o dicionario.
--
-- O schema do dicionario e resolvido em tempo de execucao: dependendo de como a
-- extensao foi instalada, ele pode nao estar em `public`.
-- -----------------------------------------------------------------------------
DO $ua$
DECLARE v_schema text;
BEGIN
    SELECT n.nspname INTO v_schema
      FROM pg_ts_dict d
      JOIN pg_namespace n ON n.oid = d.dictnamespace
     WHERE d.dictname = 'unaccent'
     LIMIT 1;

    IF v_schema IS NULL THEN
        RAISE EXCEPTION
          'Dicionario de texto "unaccent" nao encontrado. Rode: CREATE EXTENSION unaccent; (exige superusuario e o pacote postgresql-contrib).';
    END IF;

    EXECUTE format(
        'CREATE OR REPLACE FUNCTION "SolarCosta_fn_sem_acento"(txt text) '
        'RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT AS '
        '$body$ SELECT lower(%I.unaccent(%L::regdictionary, txt)) $body$',
        v_schema, v_schema || '.unaccent');
END $ua$;


-- ---------------------------------------------------------------- USUÁRIOS ---
CREATE INDEX "SolarCosta_ix_Usuarios_status"   ON "SolarCosta_Usuarios" (status) WHERE excluido_em IS NULL;
CREATE INDEX "SolarCosta_ix_Usuarios_cargo"    ON "SolarCosta_Usuarios" (cargo)  WHERE excluido_em IS NULL;
CREATE INDEX "SolarCosta_ix_Sessoes_usuario"   ON "SolarCosta_Sessoes"  (usuario_id) WHERE revogado_em IS NULL;
CREATE INDEX "SolarCosta_ix_Sessoes_expira"    ON "SolarCosta_Sessoes"  (expira_em);

-- ------------------------------------------------------------------- LEADS ---
-- Kanban: filtra por etapa e ordena por data.
CREATE INDEX "SolarCosta_ix_Leads_etapa"        ON "SolarCosta_Leads" (etapa, criado_em DESC) WHERE excluido_em IS NULL;
CREATE INDEX "SolarCosta_ix_Leads_responsavel"  ON "SolarCosta_Leads" (responsavel_id)        WHERE excluido_em IS NULL;
CREATE INDEX "SolarCosta_ix_Leads_origem"       ON "SolarCosta_Leads" (origem_id)             WHERE excluido_em IS NULL;
CREATE INDEX "SolarCosta_ix_Leads_criado_em"    ON "SolarCosta_Leads" (criado_em DESC);
CREATE INDEX "SolarCosta_ix_Leads_cpf_cnpj"     ON "SolarCosta_Leads" (cpf_cnpj)              WHERE cpf_cnpj IS NOT NULL;
-- Busca textual "contém" da barra de pesquisa do Kanban (sem acento).
CREATE INDEX "SolarCosta_ix_Leads_nome_trgm"    ON "SolarCosta_Leads" USING gin ("SolarCosta_fn_sem_acento"(nome) gin_trgm_ops);

CREATE INDEX "SolarCosta_ix_LeadDocumentos_lead"   ON "SolarCosta_LeadDocumentos" (lead_id, enviado_em DESC) WHERE excluido_em IS NULL;
CREATE INDEX "SolarCosta_ix_LeadDocumentos_pasta"  ON "SolarCosta_LeadDocumentos" (pasta_id);
-- Timeline do lead + cálculo de "lead sem contato há N dias".
CREATE INDEX "SolarCosta_ix_LeadHistorico_lead"    ON "SolarCosta_LeadHistorico" (lead_id, ocorrido_em DESC);

-- --------------------------------------------------------------- CATÁLOGO ---
CREATE INDEX "SolarCosta_ix_Produtos_fornecedor" ON "SolarCosta_Produtos" (fornecedor_id) WHERE ativo;
CREATE INDEX "SolarCosta_ix_Produtos_tipo"       ON "SolarCosta_Produtos" (tipo_codigo)   WHERE ativo;
-- Alerta de estoque crítico/baixo (SuppliersProductsView).
CREATE INDEX "SolarCosta_ix_Produtos_estoque"    ON "SolarCosta_Produtos" (estoque)       WHERE ativo;
CREATE INDEX "SolarCosta_ix_Produtos_nome_trgm"  ON "SolarCosta_Produtos" USING gin ("SolarCosta_fn_sem_acento"(nome) gin_trgm_ops);
CREATE INDEX "SolarCosta_ix_MovEstoque_produto"  ON "SolarCosta_MovimentacoesEstoque" (produto_id, criado_em DESC);
CREATE INDEX "SolarCosta_ix_MovEstoque_origem"   ON "SolarCosta_MovimentacoesEstoque" (origem_tipo, origem_id);

-- --------------------------------------------------------------- PROPOSTAS ---
CREATE INDEX "SolarCosta_ix_Propostas_lead"    ON "SolarCosta_Propostas" (lead_id)                WHERE excluido_em IS NULL;
CREATE INDEX "SolarCosta_ix_Propostas_status"  ON "SolarCosta_Propostas" (status, criado_em DESC) WHERE excluido_em IS NULL;
CREATE INDEX "SolarCosta_ix_Propostas_consultor" ON "SolarCosta_Propostas" (consultor_id);
CREATE INDEX "SolarCosta_ix_PropostaItens_prop" ON "SolarCosta_PropostaItens" (proposta_id, ordem);

-- --------------------------------------------------------------- CONTRATOS ---
CREATE INDEX "SolarCosta_ix_Contratos_lead"     ON "SolarCosta_Contratos" (lead_id)     WHERE excluido_em IS NULL;
CREATE INDEX "SolarCosta_ix_Contratos_proposta" ON "SolarCosta_Contratos" (proposta_id);
CREATE INDEX "SolarCosta_ix_Contratos_status"   ON "SolarCosta_Contratos" (status, data_emissao DESC);
CREATE INDEX "SolarCosta_ix_ContratoClausulas"  ON "SolarCosta_ContratoClausulas" (contrato_id, ordem);

-- ------------------------------------------------------------------- OBRAS ---
CREATE INDEX "SolarCosta_ix_Obras_etapa"      ON "SolarCosta_Obras" (etapa)  WHERE excluido_em IS NULL;
CREATE INDEX "SolarCosta_ix_Obras_status"     ON "SolarCosta_Obras" (status) WHERE excluido_em IS NULL;
CREATE INDEX "SolarCosta_ix_Obras_contrato"   ON "SolarCosta_Obras" (contrato_id);
CREATE INDEX "SolarCosta_ix_Obras_lead"       ON "SolarCosta_Obras" (lead_id);
CREATE INDEX "SolarCosta_ix_Obras_responsavel" ON "SolarCosta_Obras" (responsavel_tecnico_id);
-- Detecção de obra atrasada (previsão vencida e não concluída).
CREATE INDEX "SolarCosta_ix_Obras_previsao"   ON "SolarCosta_Obras" (previsao_conclusao) WHERE status <> 'concluida';
CREATE INDEX "SolarCosta_ix_ObraKitItens"     ON "SolarCosta_ObraKitItens" (obra_id, ordem);
CREATE INDEX "SolarCosta_ix_ObraHistorico"    ON "SolarCosta_ObraHistorico" (obra_id, ocorrido_em DESC);
CREATE INDEX "SolarCosta_ix_ObraAnexos"       ON "SolarCosta_ObraAnexos" (obra_id, enviado_em DESC);

-- -------------------------------------------------------------- FINANCEIRO ---
CREATE INDEX "SolarCosta_ix_Boletos_situacao"   ON "SolarCosta_Boletos" (situacao, vencimento) WHERE excluido_em IS NULL;
CREATE INDEX "SolarCosta_ix_Boletos_tipo"       ON "SolarCosta_Boletos" (tipo, vencimento)     WHERE excluido_em IS NULL;
-- Central de notificações: boletos a receber vencidos.
CREATE INDEX "SolarCosta_ix_Boletos_vencidos"   ON "SolarCosta_Boletos" (vencimento)
    WHERE excluido_em IS NULL AND situacao IN ('em_aberto','vencido');
CREATE INDEX "SolarCosta_ix_Boletos_lead"       ON "SolarCosta_Boletos" (lead_id);
CREATE INDEX "SolarCosta_ix_Boletos_obra"       ON "SolarCosta_Boletos" (obra_id);

CREATE INDEX "SolarCosta_ix_Lancamentos_data"      ON "SolarCosta_LancamentosFinanceiros" (data DESC)      WHERE excluido_em IS NULL;
CREATE INDEX "SolarCosta_ix_Lancamentos_tipo"      ON "SolarCosta_LancamentosFinanceiros" (tipo, data DESC) WHERE excluido_em IS NULL;
CREATE INDEX "SolarCosta_ix_Lancamentos_categoria" ON "SolarCosta_LancamentosFinanceiros" (categoria_id);
CREATE INDEX "SolarCosta_ix_Lancamentos_obra"      ON "SolarCosta_LancamentosFinanceiros" (obra_id);
-- Agregação do faturamento mensal do dashboard.
-- Cast explícito p/ timestamp: date_trunc(text, date) não existe e o Postgres
-- resolveria para o overload timestamptz, que é STABLE (depende do timezone
-- da sessão) e por isso é recusado em expressão de índice.
CREATE INDEX "SolarCosta_ix_Lancamentos_mes"       ON "SolarCosta_LancamentosFinanceiros" (date_trunc('month', data::timestamp), tipo);

-- ------------------------------------------------------------------ AGENDA ---
CREATE INDEX "SolarCosta_ix_Agendamentos_data"        ON "SolarCosta_Agendamentos" (data, horario_inicio) WHERE excluido_em IS NULL;
CREATE INDEX "SolarCosta_ix_Agendamentos_responsavel" ON "SolarCosta_Agendamentos" (responsavel_id, data);
CREATE INDEX "SolarCosta_ix_Agendamentos_lead"        ON "SolarCosta_Agendamentos" (lead_id);
-- "Compromissos de hoje" da central de notificações.
CREATE INDEX "SolarCosta_ix_Agendamentos_hoje"        ON "SolarCosta_Agendamentos" (data)
    WHERE excluido_em IS NULL AND status = 'agendado';

-- --------------------------------------------------------------- AUDITORIA ---
CREATE INDEX "SolarCosta_ix_Auditoria_data"     ON "SolarCosta_Auditoria" (ocorrido_em DESC);
CREATE INDEX "SolarCosta_ix_Auditoria_usuario"  ON "SolarCosta_Auditoria" (usuario_id, ocorrido_em DESC);
CREATE INDEX "SolarCosta_ix_Auditoria_entidade" ON "SolarCosta_Auditoria" (entidade, entidade_id);
CREATE INDEX "SolarCosta_ix_Auditoria_acao"     ON "SolarCosta_Auditoria" (acao, ocorrido_em DESC);

COMMIT;
