-- =============================================================================
--  SOLAR COSTA · V018 — kits de instalação e valor negociado da proposta
--
--  Até aqui o preço morava no PRODUTO e a proposta era a soma dos produtos
--  escolhidos. Não é assim que se vende: vende-se kit fechado ("Kit 8 kWp —
--  R$ 32.000"), e o preço do kit não é a soma dos componentes — ele embute
--  serviço, margem e negociação. Esta migration dá ao kit existência própria:
--  "SolarCosta_Kits" guarda nome e preço, "SolarCosta_KitItens" guarda a
--  composição. O preço do produto continua na tabela, mas deixa de alimentar
--  a proposta (vira custo interno; nenhum dado é apagado).
--
--  Na proposta o kit entra como LINHA-PAI com o preço, e cada produto que o
--  compõe entra como linha filha (item_pai_id) com qtd, produto_id e
--  valor_unit = 0 — o dinheiro está só no pai, então a soma dos itens continua
--  certa sem mudar nenhuma agregação. Os filhos existem por dois motivos
--  concretos: a folha de equipamentos do PDF precisa listar o que vai no
--  sistema, e "SolarCosta_fn_baixar_estoque_obra" (V003) baixa estoque
--  agrupando por produto_id — um kit sem componentes não baixaria nada.
--
--  item_pai_id é FK auto-referente, e não um agrupamento implícito por kit_id
--  + ordem, porque o MESMO kit pode ser adicionado duas vezes na mesma
--  proposta: por kit_id as duas seriam indistinguíveis, e por ordem a
--  hierarquia dependeria de ninguém nunca reordenar a lista.
--
--  O papel de cada linha é derivável, por isso não há coluna `tipo`:
--      item_pai_id IS NOT NULL                     -> componente de kit
--      kit_id IS NOT NULL AND item_pai_id IS NULL  -> kit
--      ambos NULL                                  -> item avulso
--
--  valor_total_ajustado é o valor negociado. NULL (e não um DEFAULT igual à
--  soma) significa "esta proposta não negociou preço", que é o estado de toda
--  proposta anterior a esta migration — elas continuam imprimindo exatamente o
--  que imprimiam ontem. Mesma semântica de responsavel_tecnico na V017.
--
--  TOCA "SolarCosta_PropostaItens" e "SolarCosta_Propostas", ambas criadas pela
--  V001 e portanto já de posse do solarcosta_migrator — a V009 criou tabelas
--  cujo dono ficou `postgres` e qualquer migration que as alcance derruba o
--  deploy. Redefine duas funções da V003 com CREATE OR REPLACE em vez de editar
--  a V003 (já aplicada), como a V016 fez com a view do funil.
--
--  NÃO usa ALTER TYPE: o enum "SolarCosta_EntidadeAuditoria" (V001) não tem
--  'Kit', e ALTER TYPE ... ADD VALUE não pode ter o valor novo usado na mesma
--  transação — o que quebraria o BEGIN;...COMMIT; obrigatório de toda
--  migration. Kit é auditado como entidade 'Produto', com o alvo escrito
--  "Kit: <nome>" para a trilha continuar legível.
--
--  CRIA TABELAS. Em homologação, onde o schema é aplicado à mão pelo DBeaver,
--  registrar depois:
--      INSERT INTO "SolarCosta_SchemaMigrations" (versao)
--      VALUES ('V018__kits_instalacao.sql');
-- =============================================================================

BEGIN;

-- ------------------------------------------------------------ 1. CATÁLOGO ---

CREATE TABLE IF NOT EXISTS "SolarCosta_Kits" (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo         text NOT NULL UNIQUE,
    nome           text NOT NULL,
    descricao      text,
    preco          numeric(14,2) NOT NULL DEFAULT 0 CHECK (preco >= 0),
    ativo          boolean NOT NULL DEFAULT true,
    criado_em      timestamptz NOT NULL DEFAULT now(),
    atualizado_em  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE "SolarCosta_Kits" IS
    'Kit de instalação vendável: um nome e UM preço fechado. O preço não é '
    'derivado dos componentes — embute serviço e margem.';
COMMENT ON COLUMN "SolarCosta_Kits".codigo IS
    'KIT-0001, gerado por "SolarCosta_fn_proximo_numero"(''kit'') na rota.';

CREATE TABLE IF NOT EXISTS "SolarCosta_KitItens" (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    kit_id      uuid NOT NULL REFERENCES "SolarCosta_Kits"(id)     ON DELETE CASCADE,
    produto_id  uuid NOT NULL REFERENCES "SolarCosta_Produtos"(id) ON DELETE RESTRICT,
    qtd         numeric(12,3) NOT NULL CHECK (qtd > 0),
    ordem       smallint NOT NULL DEFAULT 0
);

COMMENT ON TABLE "SolarCosta_KitItens" IS
    'Composição do kit. ON DELETE RESTRICT em produto_id espelha '
    'SolarCosta_MovimentacoesEstoque (V001): produto é sempre soft delete '
    '(ativo = false), então a restrição nunca dispara pela API — mas um '
    'produto inativo continua dentro do kit e a tela precisa sinalizar isso.';

CREATE INDEX IF NOT EXISTS "SolarCosta_ix_KitItens_kit"
    ON "SolarCosta_KitItens" (kit_id, ordem);
CREATE INDEX IF NOT EXISTS "SolarCosta_ix_KitItens_produto"
    ON "SolarCosta_KitItens" (produto_id);
-- Busca "contém" sem acento da barra de pesquisa, igual à de Produtos (V002).
CREATE INDEX IF NOT EXISTS "SolarCosta_ix_Kits_nome_trgm"
    ON "SolarCosta_Kits" USING gin ("SolarCosta_fn_sem_acento"(nome) gin_trgm_ops);

-- Numeração serializada reaproveitando a infra da V003 (fn_proximo_numero).
INSERT INTO "SolarCosta_Sequencias" (chave, prefixo, usa_ano, ano, ultimo_numero, largura)
VALUES ('kit', 'KIT-', false, NULL, 0, 4)
ON CONFLICT (chave) DO NOTHING;

-- Uma query só para a tela: cabeçalho + composição já agregada.
CREATE OR REPLACE VIEW "SolarCosta_vw_Kits" AS
SELECT
    k.*,
    COALESCE(i.itens_qtd, 0)         AS itens_qtd,
    COALESCE(i.potencia_wp_total, 0) AS potencia_wp_total,
    COALESCE(i.itens, '[]'::json)    AS itens
FROM "SolarCosta_Kits" k
LEFT JOIN LATERAL (
    SELECT
        count(*)                                        AS itens_qtd,
        SUM(ki.qtd * COALESCE(pr.potencia_wp, 0))       AS potencia_wp_total,
        json_agg(json_build_object(
            'id',            ki.id,
            'produto_id',    ki.produto_id,
            'produto_nome',  pr.nome,
            'produto_ativo', pr.ativo,
            'qtd',           ki.qtd,
            'ordem',         ki.ordem
        ) ORDER BY ki.ordem) AS itens
      FROM "SolarCosta_KitItens" ki
      JOIN "SolarCosta_Produtos" pr ON pr.id = ki.produto_id
     WHERE ki.kit_id = k.id
) i ON true;


-- --------------------------------------- 2. HIERARQUIA NOS ITENS DA PROPOSTA ---

ALTER TABLE "SolarCosta_PropostaItens"
    ADD COLUMN IF NOT EXISTS kit_id      uuid REFERENCES "SolarCosta_Kits"(id)            ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS item_pai_id uuid REFERENCES "SolarCosta_PropostaItens"(id)   ON DELETE CASCADE;

COMMENT ON COLUMN "SolarCosta_PropostaItens".kit_id IS
    'Kit de origem da linha. ON DELETE SET NULL porque `descricao` já é o '
    'snapshot impresso: excluir o kit do catálogo não pode alterar proposta '
    'emitida, mesma regra que produto_id segue desde a V001.';
COMMENT ON COLUMN "SolarCosta_PropostaItens".item_pai_id IS
    'Linha-pai (o kit) quando esta linha é um componente. Componente grava '
    'valor_unit = 0: o preço está no pai, então SUM(total) segue correto.';

CREATE INDEX IF NOT EXISTS "SolarCosta_ix_PropostaItens_pai"
    ON "SolarCosta_PropostaItens" (item_pai_id) WHERE item_pai_id IS NOT NULL;


-- ------------------------------------------------ 3. VALOR NEGOCIADO ---

ALTER TABLE "SolarCosta_Propostas"
    ADD COLUMN IF NOT EXISTS valor_total_ajustado numeric(14,2)
        CHECK (valor_total_ajustado IS NULL OR valor_total_ajustado >= 0);

COMMENT ON COLUMN "SolarCosta_Propostas".valor_total_ajustado IS
    'Valor negociado, digitado pelo vendedor, que SOBRESCREVE a soma dos '
    'itens em valor_total. NULL = não negociado, usa a soma (comportamento de '
    'toda proposta anterior à V018).';

-- Redefine a função da V003, que até aqui jogava fora qualquer valor digitado:
-- o PUT da proposta apaga e reinsere TODOS os itens a cada save, então sem o
-- COALESCE abaixo o valor negociado durava só até o segundo salvamento.
CREATE OR REPLACE FUNCTION "SolarCosta_fn_recalcular_total_proposta"()
RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE v_proposta uuid;
BEGIN
    v_proposta := COALESCE(NEW.proposta_id, OLD.proposta_id);
    UPDATE "SolarCosta_Propostas" p
       SET valor_total = COALESCE(
             p.valor_total_ajustado,
             (SELECT COALESCE(SUM(i.total), 0)
                FROM "SolarCosta_PropostaItens" i
               WHERE i.proposta_id = v_proposta))
     WHERE p.id = v_proposta;
    RETURN NULL;
END $fn$;

-- O gatilho acima só cobre mexidas nos ITENS. Quando o que muda é o próprio
-- valor negociado, quem reage é este — BEFORE, escrevendo em NEW: um AFTER que
-- desse UPDATE na mesma tabela recursaria. Voltar o campo a NULL faz o total
-- cair de volta na soma dos itens, pelo mesmo COALESCE.
CREATE OR REPLACE FUNCTION "SolarCosta_fn_aplicar_valor_negociado"()
RETURNS trigger LANGUAGE plpgsql AS $fn$
BEGIN
    NEW.valor_total := COALESCE(
        NEW.valor_total_ajustado,
        (SELECT COALESCE(SUM(total), 0)
           FROM "SolarCosta_PropostaItens"
          WHERE proposta_id = NEW.id));
    RETURN NEW;
END $fn$;

-- `UPDATE OF valor_total_ajustado` e não `UPDATE` seco: sem isso toda troca de
-- status recalcularia o total, e o UPDATE que o gatilho dos itens dispara
-- (que mexe só em valor_total) entraria em recursão.
DROP TRIGGER IF EXISTS "SolarCosta_tg_valor_negociado_proposta" ON "SolarCosta_Propostas";
CREATE TRIGGER "SolarCosta_tg_valor_negociado_proposta"
    BEFORE INSERT OR UPDATE OF valor_total_ajustado ON "SolarCosta_Propostas"
    FOR EACH ROW EXECUTE FUNCTION "SolarCosta_fn_aplicar_valor_negociado"();

COMMIT;
