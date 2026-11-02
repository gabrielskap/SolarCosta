-- =============================================================================
--  SOLAR COSTA · V027 — procurações
--
--  A procuração que o cliente assina para a Solar Costa representá-lo perante a
--  concessionária ("Procuraçao modelo editavel.docx") era preenchida à mão no
--  Word. Passa a ser gerada pelo CRM com a mesma lógica do contrato (V024): o
--  texto do modelo mora no front (src/procuracao/modeloProcuracao.ts), e cada
--  procuração guarda a cópia dos dados e dos textos personalizados nela.
--
--  1. "SolarCosta_Procuracoes" é tabela própria, e não uma linha a mais em
--     "SolarCosta_Contratos": lá potência e valor são NOT NULL, boleto aponta
--     para o contrato e assinar fecha o lead. O outorgante usa os mesmos nomes
--     de coluna do contratante porque nasce da cópia dele.
--       outorgados — cópia dos procuradores no momento da emissão. Os padrões
--                    ficam no parâmetro 'procuracao.outorgados'.
--       termos     — qualificação do outorgante, concessionária, local, data e
--                    os textos personalizados por seção.
--
--  2. Numeração 'procuracao' ('PROC-2026-0001') e o parâmetro dos outorgados
--     padrão. Vêm aqui, e não no seed, porque o seed não roda no deploy e o
--     PATCH /api/config/parametros só altera chave que já existe. A lista nasce
--     vazia de propósito: CPF de procurador entra pela tela de Padrões, não
--     pelo git. Enquanto ela estiver vazia, o front usa o representante legal
--     de "SolarCosta_Empresa".
--
--  3. Link público e WhatsApp aceitando 'procuracao'. São três CHECKs em
--     tabelas da V009, que em produção têm dono `postgres` (ver V010 e V025).
--     ALTER exige ser dono, então a parte 3 só roda se o migrator for — e,
--     mesmo assim, dentro de um sub-bloco que transforma falta de lock ou de
--     privilégio em WARNING. ESTA MIGRATION NUNCA DERRUBA O DEPLOY: sem a parte
--     3 a procuração funciona inteira, menos o envio, e a tela avisa
--     (GET /api/config -> procuracao_envio_ativo). Para completar depois, como
--     superusuário: database/05_habilitar_envio_procuracao.sql.
--     Nenhum COMMENT ON nessas tabelas, pelo mesmo motivo.
--
--  Auditoria sem ALTER TYPE (ver V018): a procuração é auditada como entidade
--  'Contrato', com o alvo escrito "Procuração PROC-… — cliente".
--
--  CRIA TABELA. Em homologação, onde o schema é aplicado à mão pelo DBeaver,
--  registrar depois:
--      INSERT INTO "SolarCosta_SchemaMigrations" (versao)
--      VALUES ('V027__procuracoes.sql');
-- =============================================================================

BEGIN;

-- ------------------------------------------------------- 1. PROCURAÇÕES ---

CREATE TABLE IF NOT EXISTS "SolarCosta_Procuracoes" (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    numero           text NOT NULL UNIQUE,            -- 'PROC-2026-0001'
    contrato_id      uuid REFERENCES "SolarCosta_Contratos"(id) ON DELETE SET NULL,
    lead_id          uuid REFERENCES "SolarCosta_Leads"(id)     ON DELETE SET NULL,
    modelo_versao    smallint NOT NULL DEFAULT 1,
    -- Snapshot do outorgante (imutável após assinatura)
    cliente_nome     text NOT NULL,
    cpf_cnpj         text NOT NULL,
    rg_inscricao     text,
    endereco         text NOT NULL,
    cep              text,
    telefone         text,
    outorgados       jsonb NOT NULL DEFAULT '[]'::jsonb,
    termos           jsonb NOT NULL DEFAULT '{}'::jsonb,
    status           text NOT NULL DEFAULT 'aguardando'
                     CHECK (status IN ('aguardando','assinada')),
    data_emissao     date NOT NULL DEFAULT CURRENT_DATE,
    data_assinatura  date,
    criado_por_id    uuid REFERENCES "SolarCosta_Usuarios"(id) ON DELETE SET NULL,
    criado_em        timestamptz NOT NULL DEFAULT now(),
    atualizado_em    timestamptz NOT NULL DEFAULT now(),
    excluido_em      timestamptz,
    CONSTRAINT "SolarCosta_Procuracoes_assinatura_coerente" CHECK (
        status <> 'assinada' OR data_assinatura IS NOT NULL
    ),
    CONSTRAINT "SolarCosta_Procuracoes_outorgados_lista" CHECK (
        jsonb_typeof(outorgados) = 'array'
    )
);

CREATE INDEX IF NOT EXISTS "SolarCosta_ix_Procuracoes_contrato"
    ON "SolarCosta_Procuracoes" (contrato_id) WHERE excluido_em IS NULL;

CREATE INDEX IF NOT EXISTS "SolarCosta_ix_Procuracoes_lead"
    ON "SolarCosta_Procuracoes" (lead_id) WHERE excluido_em IS NULL;

COMMENT ON TABLE "SolarCosta_Procuracoes" IS
    'Procuração do cliente (outorgante) para a Solar Costa representá-lo perante a concessionária.';
COMMENT ON COLUMN "SolarCosta_Procuracoes".modelo_versao IS
    'Versão do texto do modelo (src/procuracao/modeloProcuracao.ts).';
COMMENT ON COLUMN "SolarCosta_Procuracoes".outorgados IS
    'Cópia dos procuradores no momento da emissão: [{nome, genero, nacionalidade, cpf, rg, endereco}].';
COMMENT ON COLUMN "SolarCosta_Procuracoes".termos IS
    'Qualificação do outorgante, concessionária, local, data e textos personalizados por seção.';

-- O DO da V003 só instalou o touch nas tabelas que existiam naquela hora.
DROP TRIGGER IF EXISTS "SolarCosta_tg_touch_SolarCosta_Procuracoes" ON "SolarCosta_Procuracoes";
CREATE TRIGGER "SolarCosta_tg_touch_SolarCosta_Procuracoes"
    BEFORE UPDATE ON "SolarCosta_Procuracoes"
    FOR EACH ROW EXECUTE FUNCTION "SolarCosta_fn_touch"();

DROP TRIGGER IF EXISTS "SolarCosta_tg_numero_Procuracoes" ON "SolarCosta_Procuracoes";
CREATE TRIGGER "SolarCosta_tg_numero_Procuracoes"
    BEFORE INSERT ON "SolarCosta_Procuracoes"
    FOR EACH ROW EXECUTE FUNCTION "SolarCosta_fn_numero_automatico"('procuracao');


-- ------------------------------------------- 2. NUMERAÇÃO E PARÂMETROS ---

-- Tabela nova, sem número gravado: o contador pode partir do zero.
INSERT INTO "SolarCosta_Sequencias" (chave, prefixo, usa_ano, ano, ultimo_numero, largura)
VALUES ('procuracao', 'PROC-', true, EXTRACT(YEAR FROM CURRENT_DATE)::integer, 0, 4)
ON CONFLICT (chave) DO NOTHING;

INSERT INTO "SolarCosta_Parametros" (chave, valor, tipo, grupo, descricao) VALUES
    ('procuracao.outorgados', '[]', 'json', 'procuracao',
     'Procuradores (outorgados) que toda procuração nova traz: nome, gênero, nacionalidade, CPF, RG e endereço')
ON CONFLICT (chave) DO NOTHING;


-- ------------------------------------------ 3. LINK PÚBLICO E WHATSAPP ---

-- A troca das CHECKs vira função para existir num lugar só: esta migration a
-- chama quando pode, e o database/05_habilitar_envio_procuracao.sql a chama
-- como superusuário onde ela não pôde. Idempotente — CHECK que já aceita
-- 'procuracao' não é tocada. As CHECKs originais não têm nome explícito, por
-- isso são achadas pela definição; as novas ganham nome.
CREATE OR REPLACE FUNCTION "SolarCosta_fn_habilitar_envio_procuracao"()
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
    r record;
BEGIN
    -- Link público: o token que o renderizador do PDF usa para abrir a página.
    FOR r IN
        SELECT conname FROM pg_constraint
         WHERE conrelid = '"SolarCosta_LinksPublicos"'::regclass AND contype = 'c'
           AND pg_get_constraintdef(oid) LIKE '%tipo%'
           AND pg_get_constraintdef(oid) LIKE '%''contrato''%'
           AND pg_get_constraintdef(oid) NOT LIKE '%''procuracao''%'
    LOOP
        EXECUTE format('ALTER TABLE "SolarCosta_LinksPublicos" DROP CONSTRAINT %I', r.conname);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SolarCosta_LinksPublicos_tipo_valido') THEN
        ALTER TABLE "SolarCosta_LinksPublicos"
            ADD CONSTRAINT "SolarCosta_LinksPublicos_tipo_valido"
            CHECK (tipo IN ('proposta','contrato','procuracao'));
    END IF;
    --
    -- Mensagem enviada com documento. A CHECK de `tipo` (texto, imagem…) e a
    -- "_referencia_completa" não citam 'contrato' e ficam como estão.
    FOR r IN
        SELECT conname FROM pg_constraint
         WHERE conrelid = '"SolarCosta_WhatsAppMensagens"'::regclass AND contype = 'c'
           AND pg_get_constraintdef(oid) LIKE '%referencia_tipo%'
           AND pg_get_constraintdef(oid) LIKE '%''contrato''%'
           AND pg_get_constraintdef(oid) NOT LIKE '%''procuracao''%'
    LOOP
        EXECUTE format('ALTER TABLE "SolarCosta_WhatsAppMensagens" DROP CONSTRAINT %I', r.conname);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SolarCosta_WhatsAppMensagens_referencia_tipo_valida') THEN
        ALTER TABLE "SolarCosta_WhatsAppMensagens"
            ADD CONSTRAINT "SolarCosta_WhatsAppMensagens_referencia_tipo_valida"
            CHECK (referencia_tipo IN ('proposta','contrato','procuracao'));
    END IF;
    --
    -- Modelos de mensagem: ganham o contexto da procuração.
    FOR r IN
        SELECT conname FROM pg_constraint
         WHERE conrelid = '"SolarCosta_WhatsAppModelos"'::regclass AND contype = 'c'
           AND pg_get_constraintdef(oid) LIKE '%contexto%'
           AND pg_get_constraintdef(oid) LIKE '%''contrato''%'
           AND pg_get_constraintdef(oid) NOT LIKE '%''procuracao''%'
    LOOP
        EXECUTE format('ALTER TABLE "SolarCosta_WhatsAppModelos" DROP CONSTRAINT %I', r.conname);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SolarCosta_WhatsAppModelos_contexto_valido') THEN
        ALTER TABLE "SolarCosta_WhatsAppModelos"
            ADD CONSTRAINT "SolarCosta_WhatsAppModelos_contexto_valido"
            CHECK (contexto IN ('proposta','contrato','procuracao','lead','livre'));
    END IF;
    --
    -- O PDF vai em anexo (V010), então o modelo não cita {{link}}.
    INSERT INTO "SolarCosta_WhatsAppModelos" (nome, contexto, texto, ordem) VALUES
    ('Envio de procuração', 'procuracao',
     E'{{primeiro_nome}}, segue em anexo a sua procuração para a concessionária.\n\n'
     'Com ela assinada, damos entrada no pedido de conexão do seu sistema solar. '
     'Confira os dados, assine e me devolva por aqui.', 1)
    ON CONFLICT (nome) DO NOTHING;
END $fn$;

COMMENT ON FUNCTION "SolarCosta_fn_habilitar_envio_procuracao"() IS
    'Inclui ''procuracao'' nas CHECKs de LinksPublicos, WhatsAppMensagens e WhatsAppModelos (V027). Idempotente; exige ser dono das três tabelas.';

DO $do$
DECLARE
    v_alheias text;
BEGIN
    SELECT string_agg(format('%s (dono: %s)', c.relname, pg_get_userbyid(c.relowner)), ', ')
      INTO v_alheias
      FROM pg_class c
     WHERE c.oid IN ('"SolarCosta_LinksPublicos"'::regclass,
                     '"SolarCosta_WhatsAppMensagens"'::regclass,
                     '"SolarCosta_WhatsAppModelos"'::regclass)
       AND NOT pg_has_role(current_user, c.relowner, 'MEMBER');
    --
    IF v_alheias IS NOT NULL THEN
        RAISE WARNING
            'V027: % não é dono de %. As procurações funcionam, mas o link público '
            'e o envio por WhatsApp delas ficam DESLIGADOS. Rode '
            'database/05_habilitar_envio_procuracao.sql como superusuário.',
            current_user, v_alheias;
        RETURN;
    END IF;
    --
    -- Sub-bloco: se o lock não vier em 15s (lock_timeout do runner) ou faltar
    -- privilégio, desfaz só esta parte e segue — a tabela nova continua.
    BEGIN
        PERFORM "SolarCosta_fn_habilitar_envio_procuracao"();
        RAISE NOTICE 'V027: link público e WhatsApp habilitados para procuração.';
    EXCEPTION
        WHEN lock_not_available OR insufficient_privilege THEN
            RAISE WARNING
                'V027: as CHECKs do WhatsApp não foram alteradas (%). As procurações '
                'funcionam, mas sem link público nem WhatsApp. Rode '
                'database/05_habilitar_envio_procuracao.sql como superusuário.',
                SQLERRM;
    END;
END $do$;

COMMIT;
