-- =============================================================================
--  SOLAR COSTA · Smoke test
--
--  Prova que a mecânica do banco funciona de ponta a ponta:
--    numeração automática · histórico · auditoria · estoque · views
--
--  SEGURO: tudo roda dentro de uma transação que termina em ROLLBACK.
--  Nada é gravado. Pode rodar quantas vezes quiser, inclusive em produção.
--
--  As mensagens saem no painel "Saída" do DBeaver.
-- =============================================================================

BEGIN;

DO $teste$
DECLARE
    v_admin      uuid;
    v_lead       uuid;
    v_numero     text;
    v_hist       integer;
    v_audit      integer;
    v_produto    uuid;
    v_saldo      numeric;
    v_erro_ok    boolean := false;
    v_views      integer;
BEGIN
    RAISE NOTICE '--------------------------------------------------';
    RAISE NOTICE 'SMOKE TEST · Solar Costa';
    RAISE NOTICE '--------------------------------------------------';

    -- Contexto de sessão (é o que a API Express vai fazer em cada transação)
    SELECT id INTO v_admin FROM "SolarCosta_Usuarios" WHERE cargo = 'Administrador' LIMIT 1;
    IF v_admin IS NULL THEN
        RAISE EXCEPTION 'Nenhum administrador cadastrado. Rode o S001 primeiro.';
    END IF;
    PERFORM set_config('app.usuario_id',   v_admin::text, true);
    PERFORM set_config('app.usuario_nome', 'Smoke Test',  true);
    RAISE NOTICE '[ok] contexto de sessao definido';

    -- 1. NUMERAÇÃO AUTOMÁTICA ------------------------------------------------
    INSERT INTO "SolarCosta_Leads" (nome, telefone, cidade, uf, consumo_kwh, responsavel_id)
    VALUES ('Cliente de Teste', '(31) 90000-0000', 'Belo Horizonte', 'MG', 500, v_admin)
    RETURNING id, numero INTO v_lead, v_numero;

    IF v_numero !~ '^#\d+$' THEN
        RAISE EXCEPTION 'FALHOU: numero gerado invalido: %', v_numero;
    END IF;
    RAISE NOTICE '[ok] numeracao automatica de lead -> %', v_numero;

    -- 2. HISTÓRICO AUTOMÁTICO NO CADASTRO ------------------------------------
    SELECT count(*) INTO v_hist FROM "SolarCosta_LeadHistorico" WHERE lead_id = v_lead;
    IF v_hist <> 1 THEN
        RAISE EXCEPTION 'FALHOU: esperava 1 registro de historico, achei %', v_hist;
    END IF;
    RAISE NOTICE '[ok] historico inicial criado pelo trigger';

    -- 3. MUDANÇA DE ETAPA -> HISTÓRICO + AUDITORIA ---------------------------
    UPDATE "SolarCosta_Leads" SET etapa = 'Contato feito' WHERE id = v_lead;

    SELECT count(*) INTO v_hist  FROM "SolarCosta_LeadHistorico" WHERE lead_id = v_lead;
    SELECT count(*) INTO v_audit FROM "SolarCosta_Auditoria"
     WHERE entidade_id = v_lead AND acao = 'mudanca_etapa';

    IF v_hist <> 2 THEN
        RAISE EXCEPTION 'FALHOU: historico deveria ter 2 linhas, tem %', v_hist;
    END IF;
    IF v_audit <> 1 THEN
        RAISE EXCEPTION 'FALHOU: auditoria deveria ter 1 linha, tem %', v_audit;
    END IF;
    RAISE NOTICE '[ok] mudanca de etapa gerou historico + auditoria';

    -- 4. AUDITORIA GRAVOU O USUÁRIO CERTO ------------------------------------
    PERFORM 1 FROM "SolarCosta_Auditoria"
      WHERE entidade_id = v_lead AND usuario_nome = 'Smoke Test';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'FALHOU: auditoria nao capturou o usuario da sessao';
    END IF;
    RAISE NOTICE '[ok] auditoria capturou o autor via SET LOCAL';

    -- 5. ESTOQUE: ENTRADA E SAÍDA --------------------------------------------
    INSERT INTO "SolarCosta_Produtos" (codigo, nome, tipo_codigo, preco, unidade)
    VALUES ('TESTE-SMOKE', 'Produto de teste', 'modulo', 100.00, 'un')
    RETURNING id INTO v_produto;

    INSERT INTO "SolarCosta_MovimentacoesEstoque"
        (produto_id, tipo, quantidade, saldo_anterior, saldo_novo, origem_tipo)
    VALUES (v_produto, 'entrada', 10, 0, 0, 'ajuste_manual');

    SELECT estoque INTO v_saldo FROM "SolarCosta_Produtos" WHERE id = v_produto;
    IF v_saldo <> 10 THEN
        RAISE EXCEPTION 'FALHOU: saldo apos entrada deveria ser 10, e %', v_saldo;
    END IF;

    INSERT INTO "SolarCosta_MovimentacoesEstoque"
        (produto_id, tipo, quantidade, saldo_anterior, saldo_novo, origem_tipo)
    VALUES (v_produto, 'saida', 3, 0, 0, 'ajuste_manual');

    SELECT estoque INTO v_saldo FROM "SolarCosta_Produtos" WHERE id = v_produto;
    IF v_saldo <> 7 THEN
        RAISE EXCEPTION 'FALHOU: saldo apos saida deveria ser 7, e %', v_saldo;
    END IF;
    RAISE NOTICE '[ok] estoque: entrada 10 e saida 3 -> saldo 7';

    -- 6. ESTOQUE NEGATIVO DEVE SER RECUSADO ----------------------------------
    BEGIN
        INSERT INTO "SolarCosta_MovimentacoesEstoque"
            (produto_id, tipo, quantidade, saldo_anterior, saldo_novo, origem_tipo)
        VALUES (v_produto, 'saida', 999, 0, 0, 'ajuste_manual');
    EXCEPTION WHEN check_violation THEN
        v_erro_ok := true;
    END;

    IF NOT v_erro_ok THEN
        RAISE EXCEPTION 'FALHOU: o banco aceitou deixar o estoque negativo';
    END IF;
    RAISE NOTICE '[ok] saldo negativo recusado pelo trigger';

    -- 7. VIEWS RESPONDEM -----------------------------------------------------
    PERFORM 1 FROM "SolarCosta_vw_Leads" WHERE id = v_lead;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'FALHOU: SolarCosta_vw_Leads nao devolveu o lead criado';
    END IF;

    SELECT count(*) INTO v_views FROM "SolarCosta_vw_FunilLeads";
    IF v_views <> 6 THEN
        RAISE EXCEPTION 'FALHOU: o funil deveria ter 6 etapas, tem %', v_views;
    END IF;

    PERFORM 1 FROM "SolarCosta_vw_DashboardKPIs";
    PERFORM 1 FROM "SolarCosta_vw_Notificacoes";
    PERFORM 1 FROM "SolarCosta_vw_ObrasPainel";
    RAISE NOTICE '[ok] views principais respondem';

    RAISE NOTICE '--------------------------------------------------';
    RAISE NOTICE 'TODOS OS TESTES PASSARAM';
    RAISE NOTICE 'Nada foi gravado: o ROLLBACK abaixo desfaz tudo.';
    RAISE NOTICE '--------------------------------------------------';
END $teste$;

ROLLBACK;
