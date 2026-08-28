-- =============================================================================
--  SOLAR COSTA · V003 — Funções e triggers
--
--  Regras de negócio que HOJE moram no front (storage.ts, audit.ts, App.tsx)
--  e passam a ser garantidas pelo banco.
--
--  Contexto do usuário: a API Express deve emitir, no início de cada
--  transação de escrita:
--      SET LOCAL app.usuario_id   = '<uuid>';
--      SET LOCAL app.usuario_nome = '<nome>';
--  As funções abaixo leem esses valores para preencher a auditoria.
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. CONTEXTO DA SESSÃO
-- =============================================================================

CREATE OR REPLACE FUNCTION "SolarCosta_fn_usuario_atual"()
RETURNS uuid LANGUAGE plpgsql STABLE AS $fn$
DECLARE v text;
BEGIN
    v := current_setting('app.usuario_id', true);
    IF v IS NULL OR v = '' THEN
        RETURN NULL;
    END IF;
    RETURN v::uuid;
EXCEPTION WHEN others THEN
    RETURN NULL;
END $fn$;

CREATE OR REPLACE FUNCTION "SolarCosta_fn_usuario_atual_nome"()
RETURNS text LANGUAGE sql STABLE AS $fn$
    SELECT COALESCE(
        NULLIF(current_setting('app.usuario_nome', true), ''),
        (SELECT nome FROM "SolarCosta_Usuarios" WHERE id = "SolarCosta_fn_usuario_atual"()),
        'Sistema'
    )
$fn$;


-- =============================================================================
-- 2. atualizado_em AUTOMÁTICO
-- =============================================================================

CREATE OR REPLACE FUNCTION "SolarCosta_fn_touch"()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
    NEW.atualizado_em := now();
    RETURN NEW;
END $fn$;

-- Aplica o trigger em toda tabela SolarCosta_* que tenha a coluna.
DO $do$
DECLARE t text;
BEGIN
    FOR t IN
        SELECT c.table_name
          FROM information_schema.columns c
          JOIN information_schema.tables tb
            ON tb.table_schema = c.table_schema
           AND tb.table_name   = c.table_name
           AND tb.table_type   = 'BASE TABLE'
         WHERE c.table_schema = 'public'
           AND c.column_name  = 'atualizado_em'
           AND c.table_name LIKE 'SolarCosta%'
    LOOP
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE ON %I '
            'FOR EACH ROW EXECUTE FUNCTION "SolarCosta_fn_touch"()',
            'SolarCosta_tg_touch_' || t, t);
    END LOOP;
END $do$;


-- =============================================================================
-- 3. NUMERAÇÃO DE DOCUMENTOS
--    Substitui o nextNumero() de ObrasView.tsx e o
--    `#${Math.floor(100 + Math.random()*900)}` de App.tsx (que podia colidir).
-- =============================================================================

CREATE OR REPLACE FUNCTION "SolarCosta_fn_proximo_numero"(p_chave text)
RETURNS text LANGUAGE plpgsql AS $fn$
DECLARE
    r    "SolarCosta_Sequencias"%ROWTYPE;
    vano integer := EXTRACT(YEAR FROM CURRENT_DATE)::integer;
    vnum integer;
BEGIN
    SELECT * INTO r FROM "SolarCosta_Sequencias" WHERE chave = p_chave FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sequencia "%" nao cadastrada em SolarCosta_Sequencias', p_chave;
    END IF;

    IF r.usa_ano AND (r.ano IS DISTINCT FROM vano) THEN
        vnum := 1;
        UPDATE "SolarCosta_Sequencias" SET ano = vano, ultimo_numero = 1 WHERE chave = p_chave;
    ELSE
        vnum := r.ultimo_numero + 1;
        UPDATE "SolarCosta_Sequencias" SET ultimo_numero = vnum WHERE chave = p_chave;
    END IF;

    RETURN CASE
             WHEN r.usa_ano
               THEN format('%s%s-%s', r.prefixo, vano, lpad(vnum::text, r.largura, '0'))
             ELSE format('%s%s',      r.prefixo,       lpad(vnum::text, r.largura, '0'))
           END;
END $fn$;

COMMENT ON FUNCTION "SolarCosta_fn_proximo_numero"(text) IS
  'Numeracao serializada por FOR UPDATE. Chaves: lead (#187), proposta/contrato (2026-0184), obra (OBRA 0184).';

-- Preenche `numero` quando a API não informa.
CREATE OR REPLACE FUNCTION "SolarCosta_fn_numero_automatico"()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
    IF NEW.numero IS NULL OR btrim(NEW.numero) = '' THEN
        NEW.numero := "SolarCosta_fn_proximo_numero"(TG_ARGV[0]);
    END IF;
    RETURN NEW;
END $fn$;

CREATE TRIGGER "SolarCosta_tg_numero_Leads"
    BEFORE INSERT ON "SolarCosta_Leads"
    FOR EACH ROW EXECUTE FUNCTION "SolarCosta_fn_numero_automatico"('lead');

CREATE TRIGGER "SolarCosta_tg_numero_Propostas"
    BEFORE INSERT ON "SolarCosta_Propostas"
    FOR EACH ROW EXECUTE FUNCTION "SolarCosta_fn_numero_automatico"('proposta');

CREATE TRIGGER "SolarCosta_tg_numero_Contratos"
    BEFORE INSERT ON "SolarCosta_Contratos"
    FOR EACH ROW EXECUTE FUNCTION "SolarCosta_fn_numero_automatico"('contrato');

CREATE TRIGGER "SolarCosta_tg_numero_Obras"
    BEFORE INSERT ON "SolarCosta_Obras"
    FOR EACH ROW EXECUTE FUNCTION "SolarCosta_fn_numero_automatico"('obra');


-- =============================================================================
-- 4. AUDITORIA
-- =============================================================================

CREATE OR REPLACE FUNCTION "SolarCosta_fn_auditar"(
    p_acao        "SolarCosta_AcaoAuditoria",
    p_entidade    "SolarCosta_EntidadeAuditoria",
    p_alvo        text,
    p_entidade_id uuid  DEFAULT NULL,
    p_detalhes    text  DEFAULT NULL,
    p_antes       jsonb DEFAULT NULL,
    p_depois      jsonb DEFAULT NULL
) RETURNS bigint LANGUAGE plpgsql AS $fn$
DECLARE v_id bigint;
BEGIN
    INSERT INTO "SolarCosta_Auditoria"
        (usuario_id, usuario_nome, acao, entidade, entidade_id, alvo, detalhes, dados_antes, dados_depois)
    VALUES
        ("SolarCosta_fn_usuario_atual"(), "SolarCosta_fn_usuario_atual_nome"(),
         p_acao, p_entidade, p_entidade_id, p_alvo, p_detalhes, p_antes, p_depois)
    RETURNING id INTO v_id;
    RETURN v_id;
END $fn$;

-- Trilha append-only: bloqueia UPDATE e DELETE (o expurgo usa rotina de retenção).
CREATE OR REPLACE FUNCTION "SolarCosta_fn_auditoria_imutavel"()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
    RAISE EXCEPTION 'SolarCosta_Auditoria e append-only: % nao e permitido', TG_OP;
END $fn$;

CREATE TRIGGER "SolarCosta_tg_auditoria_imutavel"
    BEFORE UPDATE OR DELETE ON "SolarCosta_Auditoria"
    FOR EACH ROW EXECUTE FUNCTION "SolarCosta_fn_auditoria_imutavel"();


-- =============================================================================
-- 5. ESTOQUE
--    Substitui StorageService.baixarEstoqueKit, que mexia no array em memória,
--    não deixava rastro e permitia divergência de saldo.
-- =============================================================================

CREATE OR REPLACE FUNCTION "SolarCosta_fn_aplicar_movimentacao_estoque"()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
    v_saldo numeric(12,3);
    v_delta numeric(12,3);
    v_nome  text;
BEGIN
    SELECT estoque, nome INTO v_saldo, v_nome
      FROM "SolarCosta_Produtos"
     WHERE id = NEW.produto_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Produto % nao encontrado', NEW.produto_id;
    END IF;

    v_delta := CASE NEW.tipo
                 WHEN 'entrada'   THEN  NEW.quantidade
                 WHEN 'devolucao' THEN  NEW.quantidade
                 WHEN 'saida'     THEN -NEW.quantidade
                 WHEN 'ajuste'    THEN  NEW.quantidade - v_saldo  -- quantidade = saldo desejado
               END;

    IF v_saldo + v_delta < 0 THEN
        RAISE EXCEPTION 'Estoque insuficiente para "%": saldo %, baixa solicitada %',
              v_nome, v_saldo, NEW.quantidade
              USING ERRCODE = 'check_violation';
    END IF;

    NEW.saldo_anterior := v_saldo;
    NEW.saldo_novo     := v_saldo + v_delta;

    UPDATE "SolarCosta_Produtos"
       SET estoque = NEW.saldo_novo, atualizado_em = now()
     WHERE id = NEW.produto_id;

    RETURN NEW;
END $fn$;

CREATE TRIGGER "SolarCosta_tg_movimentacao_estoque"
    BEFORE INSERT ON "SolarCosta_MovimentacoesEstoque"
    FOR EACH ROW EXECUTE FUNCTION "SolarCosta_fn_aplicar_movimentacao_estoque"();

-- Baixa idempotente do kit da obra (equivalente ao flag estoqueBaixado).
CREATE OR REPLACE FUNCTION "SolarCosta_fn_baixar_estoque_obra"(p_obra_id uuid)
RETURNS integer LANGUAGE plpgsql AS $fn$
DECLARE
    v_baixado boolean;
    v_numero  text;
    v_itens   integer := 0;
    r         record;
BEGIN
    SELECT estoque_baixado, numero INTO v_baixado, v_numero
      FROM "SolarCosta_Obras"
     WHERE id = p_obra_id
       FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Obra % nao encontrada', p_obra_id;
    END IF;

    IF v_baixado THEN
        RETURN 0;   -- idempotente: chamar duas vezes nao baixa duas vezes
    END IF;

    FOR r IN
        SELECT produto_id, SUM(qtd) AS qtd
          FROM "SolarCosta_ObraKitItens"
         WHERE obra_id = p_obra_id
           AND produto_id IS NOT NULL
         GROUP BY produto_id
    LOOP
        INSERT INTO "SolarCosta_MovimentacoesEstoque"
            (produto_id, tipo, quantidade, saldo_anterior, saldo_novo,
             origem_tipo, origem_id, usuario_id, observacao)
        VALUES
            (r.produto_id, 'saida', r.qtd, 0, 0,
             'obra', p_obra_id, "SolarCosta_fn_usuario_atual"(),
             format('Baixa do kit da obra %s', v_numero));
        v_itens := v_itens + 1;
    END LOOP;

    UPDATE "SolarCosta_Obras"
       SET estoque_baixado = true, estoque_baixado_em = now()
     WHERE id = p_obra_id;

    PERFORM "SolarCosta_fn_auditar"(
        'baixa', 'Obra', format('Baixa de estoque - %s', v_numero), p_obra_id,
        format('%s produto(s) do catalogo consumidos.', v_itens));

    RETURN v_itens;
END $fn$;


-- =============================================================================
-- 6. LEADS — histórico e auditoria de mudança de etapa
-- =============================================================================

CREATE OR REPLACE FUNCTION "SolarCosta_fn_lead_mudanca_etapa"()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
    IF NEW.etapa IS DISTINCT FROM OLD.etapa THEN
        INSERT INTO "SolarCosta_LeadHistorico"(lead_id, descricao, tipo, usuario_id, usuario_nome)
        VALUES (NEW.id,
                format('Etapa alterada: %s -> %s', OLD.etapa, NEW.etapa),
                'mudanca_etapa',
                "SolarCosta_fn_usuario_atual"(),
                "SolarCosta_fn_usuario_atual_nome"());

        PERFORM "SolarCosta_fn_auditar"(
            'mudanca_etapa', 'Lead', NEW.nome, NEW.id,
            format('%s -> %s', OLD.etapa, NEW.etapa));
    END IF;
    RETURN NEW;
END $fn$;

CREATE TRIGGER "SolarCosta_tg_lead_mudanca_etapa"
    AFTER UPDATE OF etapa ON "SolarCosta_Leads"
    FOR EACH ROW EXECUTE FUNCTION "SolarCosta_fn_lead_mudanca_etapa"();

-- Primeiro registro da timeline no cadastro do lead.
CREATE OR REPLACE FUNCTION "SolarCosta_fn_lead_historico_inicial"()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
    INSERT INTO "SolarCosta_LeadHistorico"(lead_id, descricao, tipo, usuario_id, usuario_nome)
    VALUES (NEW.id, 'Lead cadastrado no sistema', 'sistema',
            "SolarCosta_fn_usuario_atual"(), "SolarCosta_fn_usuario_atual_nome"());
    RETURN NEW;
END $fn$;

CREATE TRIGGER "SolarCosta_tg_lead_historico_inicial"
    AFTER INSERT ON "SolarCosta_Leads"
    FOR EACH ROW EXECUTE FUNCTION "SolarCosta_fn_lead_historico_inicial"();


-- =============================================================================
-- 7. PROPOSTAS — vínculo com o lead e total do kit
-- =============================================================================

CREATE OR REPLACE FUNCTION "SolarCosta_fn_proposta_vincula_lead"()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
    IF NEW.lead_id IS NOT NULL THEN
        UPDATE "SolarCosta_Leads"
           SET proposta_vinculada_id = NEW.id
         WHERE id = NEW.lead_id
           AND (proposta_vinculada_id IS NULL OR proposta_vinculada_id = NEW.id);
    END IF;
    RETURN NEW;
END $fn$;

CREATE TRIGGER "SolarCosta_tg_proposta_vincula_lead"
    AFTER INSERT ON "SolarCosta_Propostas"
    FOR EACH ROW EXECUTE FUNCTION "SolarCosta_fn_proposta_vincula_lead"();

-- Mantém Propostas.valor_total = soma dos itens (fonte única de verdade).
CREATE OR REPLACE FUNCTION "SolarCosta_fn_recalcular_total_proposta"()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE v_proposta uuid;
BEGIN
    v_proposta := COALESCE(NEW.proposta_id, OLD.proposta_id);
    UPDATE "SolarCosta_Propostas" p
       SET valor_total = COALESCE((
             SELECT SUM(i.total)
               FROM "SolarCosta_PropostaItens" i
              WHERE i.proposta_id = v_proposta
           ), 0)
     WHERE p.id = v_proposta;
    RETURN NULL;
END $fn$;

CREATE TRIGGER "SolarCosta_tg_total_proposta"
    AFTER INSERT OR UPDATE OR DELETE ON "SolarCosta_PropostaItens"
    FOR EACH ROW EXECUTE FUNCTION "SolarCosta_fn_recalcular_total_proposta"();


-- =============================================================================
-- 8. OBRAS
-- =============================================================================

-- Toda obra nasce com o checklist de homologação criado.
CREATE OR REPLACE FUNCTION "SolarCosta_fn_obra_cria_homologacao"()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
    INSERT INTO "SolarCosta_ObraHomologacao"(obra_id) VALUES (NEW.id)
    ON CONFLICT (obra_id) DO NOTHING;

    INSERT INTO "SolarCosta_ObraHistorico"(obra_id, descricao, etapa, usuario_id, usuario_nome)
    VALUES (NEW.id, format('Obra %s aberta.', NEW.numero), NEW.etapa,
            "SolarCosta_fn_usuario_atual"(), "SolarCosta_fn_usuario_atual_nome"());
    RETURN NEW;
END $fn$;

CREATE TRIGGER "SolarCosta_tg_obra_cria_homologacao"
    AFTER INSERT ON "SolarCosta_Obras"
    FOR EACH ROW EXECUTE FUNCTION "SolarCosta_fn_obra_cria_homologacao"();

-- Registra avanço de etapa no histórico da obra.
CREATE OR REPLACE FUNCTION "SolarCosta_fn_obra_mudanca_etapa"()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
    IF NEW.etapa IS DISTINCT FROM OLD.etapa THEN
        INSERT INTO "SolarCosta_ObraHistorico"(obra_id, descricao, etapa, usuario_id, usuario_nome)
        VALUES (NEW.id, format('Etapa: %s -> %s', OLD.etapa, NEW.etapa), NEW.etapa,
                "SolarCosta_fn_usuario_atual"(), "SolarCosta_fn_usuario_atual_nome"());

        PERFORM "SolarCosta_fn_auditar"(
            'mudanca_etapa', 'Obra', format('%s - %s', NEW.numero, NEW.cliente_nome),
            NEW.id, format('%s -> %s', OLD.etapa, NEW.etapa));
    END IF;
    RETURN NEW;
END $fn$;

CREATE TRIGGER "SolarCosta_tg_obra_mudanca_etapa"
    AFTER UPDATE OF etapa ON "SolarCosta_Obras"
    FOR EACH ROW EXECUTE FUNCTION "SolarCosta_fn_obra_mudanca_etapa"();

-- Concluir a obra fecha automaticamente status e data.
CREATE OR REPLACE FUNCTION "SolarCosta_fn_obra_conclusao"()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
    IF NEW.etapa = 'Concluída' AND OLD.etapa <> 'Concluída' THEN
        NEW.status         := 'concluida';
        NEW.data_conclusao := COALESCE(NEW.data_conclusao, CURRENT_DATE);
    END IF;
    RETURN NEW;
END $fn$;

CREATE TRIGGER "SolarCosta_tg_obra_conclusao"
    BEFORE UPDATE ON "SolarCosta_Obras"
    FOR EACH ROW EXECUTE FUNCTION "SolarCosta_fn_obra_conclusao"();


-- =============================================================================
-- 9. FINANCEIRO
-- =============================================================================

-- Dar baixa em boleto gera automaticamente o lançamento de caixa correspondente
-- (hoje o usuário lança as duas coisas na mão e elas divergem).
CREATE OR REPLACE FUNCTION "SolarCosta_fn_boleto_gera_lancamento"()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
    IF NEW.situacao = 'pago' AND OLD.situacao IS DISTINCT FROM 'pago' THEN
        IF NOT EXISTS (SELECT 1 FROM "SolarCosta_LancamentosFinanceiros" WHERE boleto_id = NEW.id) THEN
            INSERT INTO "SolarCosta_LancamentosFinanceiros"
                (data, descricao, categoria_id, obra_id, lead_id, boleto_id, tipo, valor, usuario_id)
            VALUES
                (COALESCE(NEW.data_pagamento, CURRENT_DATE),
                 format('Baixa boleto %s - %s', COALESCE(NEW.parcela_label, ''), NEW.cliente_nome),
                 NEW.categoria_id, NEW.obra_id, NEW.lead_id, NEW.id,
                 (CASE NEW.tipo WHEN 'a_receber' THEN 'receita' ELSE 'despesa' END)::"SolarCosta_TipoLancamento",
                 COALESCE(NEW.valor_pago, NEW.valor),
                 "SolarCosta_fn_usuario_atual"());
        END IF;

        PERFORM "SolarCosta_fn_auditar"(
            'baixa', 'Boleto',
            format('Boleto %s - %s', COALESCE(NEW.parcela_label, ''), NEW.cliente_nome),
            NEW.id,
            format('Baixa registrada (R$ %s).',
                   to_char(COALESCE(NEW.valor_pago, NEW.valor), 'FM999G999G990D00')));
    END IF;
    RETURN NEW;
END $fn$;

CREATE TRIGGER "SolarCosta_tg_boleto_gera_lancamento"
    AFTER UPDATE OF situacao ON "SolarCosta_Boletos"
    FOR EACH ROW EXECUTE FUNCTION "SolarCosta_fn_boleto_gera_lancamento"();

-- Rotina diária (pg_cron ou cron do sistema): marca boletos vencidos e obras
-- atrasadas. Substitui a data fixa REFERENCE_TODAY de utils/dates.ts.
CREATE OR REPLACE FUNCTION "SolarCosta_fn_rotina_diaria"()
RETURNS TABLE (boletos_vencidos integer, obras_atrasadas integer)
LANGUAGE plpgsql AS $fn$
DECLARE
    vb integer;
    vo integer;
BEGIN
    UPDATE "SolarCosta_Boletos"
       SET situacao = 'vencido'
     WHERE excluido_em IS NULL
       AND situacao = 'em_aberto'
       AND vencimento < CURRENT_DATE;
    GET DIAGNOSTICS vb = ROW_COUNT;

    UPDATE "SolarCosta_Obras"
       SET status = 'atrasada'
     WHERE excluido_em IS NULL
       AND status = 'em_andamento'
       AND previsao_conclusao IS NOT NULL
       AND previsao_conclusao < CURRENT_DATE;
    GET DIAGNOSTICS vo = ROW_COUNT;

    RETURN QUERY SELECT vb, vo;
END $fn$;


-- =============================================================================
-- 10. PARÂMETROS — leitura tipada
-- =============================================================================

CREATE OR REPLACE FUNCTION "SolarCosta_fn_param_num"(p_chave text, p_padrao numeric DEFAULT NULL)
RETURNS numeric LANGUAGE sql STABLE AS $fn$
    SELECT COALESCE((SELECT valor::numeric FROM "SolarCosta_Parametros" WHERE chave = p_chave), p_padrao)
$fn$;

CREATE OR REPLACE FUNCTION "SolarCosta_fn_param_txt"(p_chave text, p_padrao text DEFAULT NULL)
RETURNS text LANGUAGE sql STABLE AS $fn$
    SELECT COALESCE((SELECT valor FROM "SolarCosta_Parametros" WHERE chave = p_chave), p_padrao)
$fn$;

COMMIT;
