-- =============================================================================
--  SOLAR COSTA · CRM Fotovoltaico
--  V001 — Schema inicial
--  Alvo: PostgreSQL 14+  (executar no DBeaver conectado ao banco da VPS)
--
--  Convenção: TODAS as relações usam o prefixo "SolarCosta_".
--             Identificadores são case-sensitive -> sempre entre aspas duplas.
--
--  Ordem de execução:
--    V001__schema_inicial.sql   <- este arquivo
--    V002__indices.sql
--    V003__funcoes_e_triggers.sql
--    V004__views.sql
--    seeds/S001__configuracao_base.sql
--    seeds/S002__dados_demo.sql   (opcional)
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 0. EXTENSÕES
--
-- Se alguma delas não estiver disponível no servidor, o erro aparece AQUI, na
-- primeira instrução — e como tudo roda numa transação só, nada é criado.
-- Falta de extensão = instalar `postgresql-contrib` no servidor.
-- Falta de permissão = conectar como superusuário só para esta etapa.
-- -----------------------------------------------------------------------------
-- -----------------------------------------------------------------------------
-- PRÉ-CONDIÇÃO: base limpa.
-- Uma tentativa anterior pode ter deixado tipos ou tabelas para trás. Como
-- CREATE TYPE não aceita IF NOT EXISTS, o script morreria no meio com
-- "type already exists". Migration não se reaplica sobre si mesma: rode o
-- rollback/R001__drop_all.sql e comece do zero.
-- -----------------------------------------------------------------------------
DO $limpo$
DECLARE
    n_tab integer;
    n_tip integer;
BEGIN
    SELECT count(*) INTO n_tab
      FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
       AND table_name LIKE 'SolarCosta%';

    SELECT count(*) INTO n_tip
      FROM pg_type t JOIN pg_namespace n ON n.oid = t.typnamespace
     WHERE n.nspname = 'public' AND t.typtype = 'e'
       AND t.typname LIKE 'SolarCosta%';

    IF n_tab > 0 OR n_tip > 0 THEN
        RAISE EXCEPTION
          'Base ja contem objetos SolarCosta_ (% tabelas, % tipos) de uma execucao anterior. Rode rollback/R001__drop_all.sql antes de reaplicar o V001.',
          n_tab, n_tip;
    END IF;
END $limpo$;

DO $ext$
DECLARE faltando text;
BEGIN
    SELECT string_agg(e.name, ', ') INTO faltando
      FROM (VALUES ('pgcrypto'), ('citext'), ('unaccent'), ('pg_trgm')) AS e(name)
     WHERE NOT EXISTS (SELECT 1 FROM pg_available_extensions a WHERE a.name = e.name);

    IF faltando IS NOT NULL THEN
        RAISE EXCEPTION
          'Extensoes indisponiveis neste servidor: %. Instale o pacote postgresql-contrib e tente de novo.', faltando;
    END IF;
END $ext$;

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS citext;     -- e-mail case-insensitive
CREATE EXTENSION IF NOT EXISTS unaccent;   -- busca sem acento
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- busca por similaridade (nome/cliente)


-- -----------------------------------------------------------------------------
-- 1. TIPOS ENUMERADOS
--    Espelham as union types de src/types.ts. Domínios que o usuário final pode
--    cadastrar (origem, telhado, categoria...) ficam em tabelas de apoio.
-- -----------------------------------------------------------------------------
CREATE TYPE "SolarCosta_PerfilUsuario"    AS ENUM ('Administrador','Vendedor','Financeiro','Engenheiro','Instalador');
CREATE TYPE "SolarCosta_StatusUsuario"    AS ENUM ('ativo','inativo');
CREATE TYPE "SolarCosta_EtapaLead"        AS ENUM ('Novo lead','Contato feito','Visita técnica','Proposta enviada','Negociação','Fechado');
CREATE TYPE "SolarCosta_StatusProposta"   AS ENUM ('rascunho','enviada','aceita','recusada','expirada');
CREATE TYPE "SolarCosta_FormaPagamento"   AS ENUM ('avista','cartao','financiamento');
CREATE TYPE "SolarCosta_StatusContrato"   AS ENUM ('aguardando','assinado','cancelado');
CREATE TYPE "SolarCosta_SituacaoBoleto"   AS ENUM ('em_aberto','pago','vencido','cancelado');
CREATE TYPE "SolarCosta_TipoBoleto"       AS ENUM ('a_receber','a_pagar');
CREATE TYPE "SolarCosta_TipoLancamento"   AS ENUM ('receita','despesa');
CREATE TYPE "SolarCosta_TipoAgendamento"  AS ENUM ('visita_tecnica','reuniao','vistoria');
CREATE TYPE "SolarCosta_StatusAgendamento" AS ENUM ('agendado','realizado','cancelado');
CREATE TYPE "SolarCosta_EtapaObra"        AS ENUM ('Aguardando compra','Projeto / ART','Homologação','Instalação','Vistoria / troca','Concluída');
CREATE TYPE "SolarCosta_StatusObra"       AS ENUM ('em_andamento','concluida','atrasada','pausada');
CREATE TYPE "SolarCosta_AcaoAuditoria"    AS ENUM ('criar','editar','excluir','mudanca_etapa','baixa','login','logout','exportar');
CREATE TYPE "SolarCosta_EntidadeAuditoria" AS ENUM ('Lead','Proposta','Contrato','Boleto','Lançamento','Usuário','Fornecedor','Produto','Agendamento','Obra','Sessão');
CREATE TYPE "SolarCosta_TipoMovEstoque"   AS ENUM ('entrada','saida','ajuste','devolucao');


-- =============================================================================
-- 2. USUÁRIOS, PERMISSÕES E SESSÕES
--    Origem do mock: src/services/storage.ts -> INITIAL_USERS
-- =============================================================================

CREATE TABLE "SolarCosta_Usuarios" (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome            text        NOT NULL,
    email           citext      NOT NULL UNIQUE,
    -- NUNCA armazenar senha em texto puro. A API grava bcrypt/argon2 (custo >= 12).
    senha_hash      text        NOT NULL,
    telefone        text,
    cargo           "SolarCosta_PerfilUsuario" NOT NULL,
    status          "SolarCosta_StatusUsuario" NOT NULL DEFAULT 'ativo',
    avatar_url      text,
    -- Assinatura digitalizada usada em propostas/contratos (opcional).
    assinatura_url  text,
    crea            text,
    ultimo_acesso   timestamptz,
    criado_em       timestamptz NOT NULL DEFAULT now(),
    atualizado_em   timestamptz NOT NULL DEFAULT now(),
    excluido_em     timestamptz,                       -- soft delete
    CONSTRAINT "SolarCosta_Usuarios_nome_nao_vazio" CHECK (btrim(nome) <> '')
);

COMMENT ON TABLE  "SolarCosta_Usuarios" IS 'Usuários do CRM. Substitui INITIAL_USERS de storage.ts.';
COMMENT ON COLUMN "SolarCosta_Usuarios".senha_hash IS 'Hash bcrypt/argon2 gerado pela API. Jamais expor via SELECT do endpoint.';

-- 1:1 com o usuário — espelha a interface UserPermissions de types.ts
CREATE TABLE "SolarCosta_UsuarioPermissoes" (
    usuario_id                  uuid PRIMARY KEY
                                REFERENCES "SolarCosta_Usuarios"(id) ON DELETE CASCADE,
    criar_editar_leads          boolean NOT NULL DEFAULT false,
    emitir_propostas            boolean NOT NULL DEFAULT false,
    anexar_documentos           boolean NOT NULL DEFAULT false,
    emitir_contratos            boolean NOT NULL DEFAULT false,
    ver_lancamentos_financeiro  boolean NOT NULL DEFAULT false,
    gerenciar_usuarios          boolean NOT NULL DEFAULT false,
    gerenciar_obras             boolean NOT NULL DEFAULT false,
    ver_auditoria               boolean NOT NULL DEFAULT false,
    atualizado_em               timestamptz NOT NULL DEFAULT now()
);

-- Refresh tokens da API Express (o access token JWT fica só em memória no front).
CREATE TABLE "SolarCosta_Sessoes" (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id     uuid NOT NULL REFERENCES "SolarCosta_Usuarios"(id) ON DELETE CASCADE,
    token_hash     text NOT NULL UNIQUE,      -- SHA-256 do refresh token
    ip             inet,
    user_agent     text,
    criado_em      timestamptz NOT NULL DEFAULT now(),
    expira_em      timestamptz NOT NULL,
    revogado_em    timestamptz
);


-- =============================================================================
-- 3. CONFIGURAÇÃO DA EMPRESA E PARÂMETROS
--    Origem do mock: valores fixos em PDFModal.tsx, ContractsView.tsx,
--    ProposalCalculatorView.tsx, DashboardView.tsx e utils/dates.ts
-- =============================================================================

CREATE TABLE "SolarCosta_Empresa" (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Trava de registro único: só existe uma empresa contratada.
    registro_unico       boolean NOT NULL DEFAULT true UNIQUE CHECK (registro_unico),
    razao_social         text    NOT NULL,
    nome_fantasia        text    NOT NULL,
    cnpj                 text    NOT NULL,
    inscricao_estadual   text,
    endereco             text    NOT NULL,
    bairro               text,
    cidade               text    NOT NULL,
    uf                   char(2) NOT NULL,
    cep                  text,
    telefone             text,
    whatsapp             text,
    email                citext,
    site                 text,
    logo_url             text,                 -- data URI ou caminho no storage
    responsavel_tecnico  text,
    crea                 text,
    foro_padrao          text,
    criado_em            timestamptz NOT NULL DEFAULT now(),
    atualizado_em        timestamptz NOT NULL DEFAULT now()
);
COMMENT ON TABLE "SolarCosta_Empresa" IS
  'Dados da contratada usados em propostas/contratos. Remove os literais de PDFModal.tsx (CNPJ, endereço, CREA).';

-- Parâmetros chave/valor: substituem números mágicos espalhados pelo front.
CREATE TABLE "SolarCosta_Parametros" (
    chave           text PRIMARY KEY,
    valor           text NOT NULL,
    tipo            text NOT NULL DEFAULT 'texto'
                    CHECK (tipo IN ('texto','numero','percentual','moeda','booleano','json')),
    grupo           text NOT NULL DEFAULT 'geral',
    descricao       text,
    atualizado_em   timestamptz NOT NULL DEFAULT now(),
    atualizado_por  uuid REFERENCES "SolarCosta_Usuarios"(id) ON DELETE SET NULL
);

COMMENT ON TABLE "SolarCosta_Parametros" IS
  'Constantes de negócio (tarifa, HSP, perdas, meta anual, dias sem contato...). Antes hardcoded nos componentes.';


-- =============================================================================
-- 4. TABELAS DE APOIO (domínios editáveis pelo usuário)
-- =============================================================================

CREATE TABLE "SolarCosta_Concessionarias" (
    id                     integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    nome                   text NOT NULL UNIQUE,
    uf                     char(2),
    tarifa_kwh             numeric(8,4),      -- tarifa padrão sugerida
    custo_disponibilidade  numeric(10,2) DEFAULT 0,
    hsp_media              numeric(5,2),      -- horas de sol pleno da região
    ativo                  boolean NOT NULL DEFAULT true,
    ordem                  smallint NOT NULL DEFAULT 0
);

CREATE TABLE "SolarCosta_OrigensLead" (
    id     integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    nome   text NOT NULL UNIQUE,
    ativo  boolean NOT NULL DEFAULT true,
    ordem  smallint NOT NULL DEFAULT 0
);

CREATE TABLE "SolarCosta_TiposTelhado" (
    id                integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    nome              text NOT NULL UNIQUE,
    fator_area        numeric(5,2) NOT NULL DEFAULT 1.00,  -- multiplicador de área/estrutura
    ativo             boolean NOT NULL DEFAULT true,
    ordem             smallint NOT NULL DEFAULT 0
);

-- Normaliza a divergência de TipoProduto em types.ts (slug 'modulo' x rótulo
-- 'Módulo fotovoltaico'). O front passa a usar sempre o `codigo`.
CREATE TABLE "SolarCosta_TiposProduto" (
    codigo  text PRIMARY KEY,        -- 'modulo', 'inversor', 'estrutura', ...
    label   text NOT NULL,           -- 'Módulo fotovoltaico', ...
    ativo   boolean NOT NULL DEFAULT true,
    ordem   smallint NOT NULL DEFAULT 0
);

CREATE TABLE "SolarCosta_CategoriasFinanceiras" (
    id      integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    nome    text NOT NULL UNIQUE,
    escopo  text NOT NULL DEFAULT 'ambos' CHECK (escopo IN ('receita','despesa','ambos')),
    cor     text,
    ativo   boolean NOT NULL DEFAULT true,
    ordem   smallint NOT NULL DEFAULT 0
);

CREATE TABLE "SolarCosta_PastasDocumento" (
    id      integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    nome    text NOT NULL UNIQUE,
    ativo   boolean NOT NULL DEFAULT true,
    ordem   smallint NOT NULL DEFAULT 0
);

CREATE TABLE "SolarCosta_BancosFinanciamento" (
    id                integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    nome              text NOT NULL UNIQUE,
    juros_mes_padrao  numeric(6,3),
    parcelas_max      smallint,
    entrada_min_pct   numeric(5,2),
    ativo             boolean NOT NULL DEFAULT true
);

-- Presets de observação da proposta (PDFModal.observationPresets)
CREATE TABLE "SolarCosta_ObservacaoPresets" (
    id       integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    contexto text NOT NULL DEFAULT 'proposta' CHECK (contexto IN ('proposta','contrato')),
    label    text NOT NULL,
    texto    text NOT NULL,
    ativo    boolean NOT NULL DEFAULT true,
    ordem    smallint NOT NULL DEFAULT 0,
    UNIQUE (contexto, label)
);

-- Biblioteca de cláusulas padrão (ContractsView.clausulas)
CREATE TABLE "SolarCosta_ClausulasPadrao" (
    id       integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    titulo   text NOT NULL UNIQUE,
    texto    text,
    padrao   boolean NOT NULL DEFAULT true,   -- vem marcada no formulário
    ativo    boolean NOT NULL DEFAULT true,
    ordem    smallint NOT NULL DEFAULT 0
);

-- Sazonalidade de geração usada no PDF (monthlyData fixo em PDFModal.tsx).
CREATE TABLE "SolarCosta_PerfilGeracaoMensal" (
    concessionaria_id integer NOT NULL REFERENCES "SolarCosta_Concessionarias"(id) ON DELETE CASCADE,
    mes               smallint NOT NULL CHECK (mes BETWEEN 1 AND 12),
    fator             numeric(7,5) NOT NULL,   -- 1.00000 = média anual
    PRIMARY KEY (concessionaria_id, mes)
);

-- Numeração sequencial de documentos (#187, 2026-0184, OBRA 0184).
CREATE TABLE "SolarCosta_Sequencias" (
    chave           text PRIMARY KEY,         -- 'lead' | 'proposta' | 'contrato' | 'obra'
    prefixo         text NOT NULL DEFAULT '',
    usa_ano         boolean NOT NULL DEFAULT false,
    ano             integer,
    ultimo_numero   integer NOT NULL DEFAULT 0,
    largura         smallint NOT NULL DEFAULT 4
);


-- =============================================================================
-- 5. CATÁLOGO: FORNECEDORES, PRODUTOS E ESTOQUE
--    Origem do mock: INITIAL_FORNECEDORES / INITIAL_PRODUTOS
-- =============================================================================

CREATE TABLE "SolarCosta_Fornecedores" (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome           text NOT NULL,
    cnpj           text UNIQUE,
    cidade         text,
    uf             char(2),
    contato        text,
    telefone       text,
    email          citext,
    site           text,
    prazo_entrega  text,
    observacoes    text,
    ativo          boolean NOT NULL DEFAULT true,
    criado_em      timestamptz NOT NULL DEFAULT now(),
    atualizado_em  timestamptz NOT NULL DEFAULT now()
);
-- `produtosQtd` do mock NÃO é coluna: é derivado (ver SolarCosta_vw_Fornecedores).

CREATE TABLE "SolarCosta_Produtos" (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    codigo          text NOT NULL UNIQUE,
    nome            text NOT NULL,
    tipo_codigo     text NOT NULL REFERENCES "SolarCosta_TiposProduto"(codigo),
    fornecedor_id   uuid REFERENCES "SolarCosta_Fornecedores"(id) ON DELETE SET NULL,
    preco           numeric(14,2) NOT NULL DEFAULT 0 CHECK (preco >= 0),
    estoque         numeric(12,3) NOT NULL DEFAULT 0 CHECK (estoque >= 0),
    estoque_minimo  numeric(12,3) NOT NULL DEFAULT 0,
    unidade         text NOT NULL DEFAULT 'un',
    potencia_wp     integer,                   -- só para módulos
    ncm             text,
    ativo           boolean NOT NULL DEFAULT true,
    criado_em       timestamptz NOT NULL DEFAULT now(),
    atualizado_em   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN "SolarCosta_Produtos".estoque IS
  'Saldo atual. Só é alterado pelo trigger de SolarCosta_MovimentacoesEstoque — nunca por UPDATE direto da API.';

-- Livro-razão do estoque: dá rastreabilidade à baixa de kit por obra
-- (StorageService.baixarEstoqueKit não deixava rastro nenhum).
CREATE TABLE "SolarCosta_MovimentacoesEstoque" (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id      uuid NOT NULL REFERENCES "SolarCosta_Produtos"(id) ON DELETE RESTRICT,
    tipo            "SolarCosta_TipoMovEstoque" NOT NULL,
    quantidade      numeric(12,3) NOT NULL CHECK (quantidade >= 0),
    saldo_anterior  numeric(12,3) NOT NULL,
    saldo_novo      numeric(12,3) NOT NULL,
    custo_unitario  numeric(14,2),
    origem_tipo     text,                      -- 'obra' | 'compra' | 'ajuste_manual'
    origem_id       uuid,
    usuario_id      uuid REFERENCES "SolarCosta_Usuarios"(id) ON DELETE SET NULL,
    observacao      text,
    criado_em       timestamptz NOT NULL DEFAULT now(),
    -- 'ajuste' pode zerar o saldo; os demais tipos exigem quantidade positiva.
    CONSTRAINT "SolarCosta_MovEstoque_qtd_positiva" CHECK (tipo = 'ajuste' OR quantidade > 0)
);


-- =============================================================================
-- 6. LEADS (CRM)
--    Origem do mock: INITIAL_LEADS
--    Decisão de modelagem: o Lead é o cadastro-mestre do cliente. Contratos,
--    boletos e obras guardam um SNAPSHOT do nome/CPF (integridade documental)
--    além do lead_id.
-- =============================================================================

CREATE TABLE "SolarCosta_Leads" (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    numero                text NOT NULL UNIQUE,          -- '#187' (SolarCosta_fn_proximo_numero)
    nome                  text NOT NULL,
    cpf_cnpj              text,
    rg_inscricao          text,
    telefone              text,
    email                 citext,
    cep                   text,
    endereco              text,
    bairro                text,
    cidade                text,
    uf                    char(2),
    consumo_kwh           numeric(12,2) NOT NULL DEFAULT 0 CHECK (consumo_kwh >= 0),
    concessionaria_id     integer REFERENCES "SolarCosta_Concessionarias"(id) ON DELETE SET NULL,
    tipo_telhado_id       integer REFERENCES "SolarCosta_TiposTelhado"(id)   ON DELETE SET NULL,
    origem_id             integer REFERENCES "SolarCosta_OrigensLead"(id)    ON DELETE SET NULL,
    responsavel_id        uuid    REFERENCES "SolarCosta_Usuarios"(id)       ON DELETE SET NULL,
    etapa                 "SolarCosta_EtapaLead" NOT NULL DEFAULT 'Novo lead',
    valor_estimado        numeric(14,2) NOT NULL DEFAULT 0,
    proposta_vinculada_id uuid,                          -- FK adicionada após Propostas
    motivo_perda          text,
    observacoes           text,
    criado_em             timestamptz NOT NULL DEFAULT now(),
    atualizado_em         timestamptz NOT NULL DEFAULT now(),
    excluido_em           timestamptz,
    CONSTRAINT "SolarCosta_Leads_nome_nao_vazio" CHECK (btrim(nome) <> '')
);

-- Documentos anexados ao lead (LeadDetailView / DocumentoItem)
CREATE TABLE "SolarCosta_LeadDocumentos" (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id        uuid NOT NULL REFERENCES "SolarCosta_Leads"(id) ON DELETE CASCADE,
    pasta_id       integer REFERENCES "SolarCosta_PastasDocumento"(id) ON DELETE SET NULL,
    nome_arquivo   text NOT NULL,
    mime_type      text,
    extensao       text,
    tamanho_bytes  bigint CHECK (tamanho_bytes >= 0),
    storage_path   text NOT NULL,             -- caminho no disco/S3; o binário NÃO fica no banco
    enviado_por_id uuid REFERENCES "SolarCosta_Usuarios"(id) ON DELETE SET NULL,
    enviado_em     timestamptz NOT NULL DEFAULT now(),
    excluido_em    timestamptz
);

COMMENT ON COLUMN "SolarCosta_LeadDocumentos".tamanho_bytes IS
  'O mock guardava "1,4 MB" como texto. Aqui é numérico; a formatação é do front.';

-- Timeline do lead (HistoricoItem)
CREATE TABLE "SolarCosta_LeadHistorico" (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id      uuid NOT NULL REFERENCES "SolarCosta_Leads"(id) ON DELETE CASCADE,
    descricao    text NOT NULL,
    tipo         text NOT NULL DEFAULT 'nota'
                 CHECK (tipo IN ('nota','ligacao','whatsapp','email','visita','sistema','mudanca_etapa')),
    usuario_id   uuid REFERENCES "SolarCosta_Usuarios"(id) ON DELETE SET NULL,
    usuario_nome text NOT NULL,                -- snapshot: sobrevive à exclusão do usuário
    ocorrido_em  timestamptz NOT NULL DEFAULT now(),
    criado_em    timestamptz NOT NULL DEFAULT now()
);


-- =============================================================================
-- 7. PROPOSTAS
--    Origem do mock: INITIAL_PROPOSTA + defaults de ProposalCalculatorView
-- =============================================================================

CREATE TABLE "SolarCosta_Propostas" (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    numero              text NOT NULL UNIQUE,            -- '2026-0184'
    lead_id             uuid REFERENCES "SolarCosta_Leads"(id) ON DELETE SET NULL,

    -- Snapshot do cliente no momento da emissão
    cliente_nome        text NOT NULL,
    cpf_cnpj            text,
    telefone            text,
    email               citext,
    endereco            text,
    cidade              text,
    concessionaria_id   integer REFERENCES "SolarCosta_Concessionarias"(id) ON DELETE SET NULL,
    tipo_telhado_id     integer REFERENCES "SolarCosta_TiposTelhado"(id)   ON DELETE SET NULL,

    -- Entradas do dimensionamento
    consumo_kwh         numeric(12,2) NOT NULL CHECK (consumo_kwh > 0),
    tarifa_kwh          numeric(8,4)  NOT NULL CHECK (tarifa_kwh > 0),
    hsp                 numeric(5,2)  NOT NULL CHECK (hsp > 0),
    perdas_pct          numeric(5,2)  NOT NULL DEFAULT 0 CHECK (perdas_pct >= 0 AND perdas_pct < 100),
    modulo_wp           integer       NOT NULL CHECK (modulo_wp > 0),

    -- Saídas calculadas (persistidas: a proposta impressa não pode mudar
    -- se o parâmetro global for alterado depois)
    potencia_kwp        numeric(10,2) NOT NULL,
    modulos_qtd         integer       NOT NULL,
    area_estimada_m2    numeric(10,2),
    geracao_media_kwh   numeric(12,2),
    cobertura_pct       numeric(6,2),

    valor_total         numeric(14,2) NOT NULL DEFAULT 0,
    economia_mensal     numeric(14,2),
    economia_anual      numeric(14,2),
    economia_25_anos    numeric(16,2),
    payback_anos        numeric(6,2),

    -- Condições comerciais
    forma_pagamento              "SolarCosta_FormaPagamento" NOT NULL DEFAULT 'avista',
    desconto_avista_pct          numeric(5,2),
    parcelas_cartao              smallint,
    taxa_cartao_pct              numeric(6,3),
    entrada_financiamento_valor  numeric(14,2),
    entrada_financiamento_pct    numeric(5,2),
    parcelas_financiamento       smallint,
    juros_financiamento_mes_pct  numeric(6,3),
    banco_financiamento_id       integer REFERENCES "SolarCosta_BancosFinanciamento"(id) ON DELETE SET NULL,

    status              "SolarCosta_StatusProposta" NOT NULL DEFAULT 'rascunho',
    observacoes         text,
    logo_customizada_url text,
    validade_dias       smallint NOT NULL DEFAULT 10,
    consultor_id        uuid REFERENCES "SolarCosta_Usuarios"(id) ON DELETE SET NULL,
    enviada_em          timestamptz,
    aceita_em           timestamptz,
    criado_em           timestamptz NOT NULL DEFAULT now(),
    atualizado_em       timestamptz NOT NULL DEFAULT now(),
    excluido_em         timestamptz,

    -- Coerência das condições de pagamento
    CONSTRAINT "SolarCosta_Propostas_financiamento_completo" CHECK (
        forma_pagamento <> 'financiamento'
        OR (parcelas_financiamento IS NOT NULL AND parcelas_financiamento > 0)
    )
);

CREATE TABLE "SolarCosta_PropostaItens" (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    proposta_id  uuid NOT NULL REFERENCES "SolarCosta_Propostas"(id) ON DELETE CASCADE,
    produto_id   uuid REFERENCES "SolarCosta_Produtos"(id) ON DELETE SET NULL,
    descricao    text NOT NULL,               -- snapshot (itens avulsos não têm produto)
    qtd          numeric(12,3) NOT NULL CHECK (qtd > 0),
    valor_unit   numeric(14,2) NOT NULL CHECK (valor_unit >= 0),
    total        numeric(16,2) GENERATED ALWAYS AS (round(qtd * valor_unit, 2)) STORED,
    ordem        smallint NOT NULL DEFAULT 0
);

-- FK circular Lead <-> Proposta, criada agora que Propostas existe.
ALTER TABLE "SolarCosta_Leads"
    ADD CONSTRAINT "SolarCosta_Leads_proposta_fk"
    FOREIGN KEY (proposta_vinculada_id)
    REFERENCES "SolarCosta_Propostas"(id) ON DELETE SET NULL;


-- =============================================================================
-- 8. CONTRATOS
--    Origem do mock: INITIAL_CONTRATO + defaults de ContractsView
-- =============================================================================

CREATE TABLE "SolarCosta_Contratos" (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    numero              text NOT NULL UNIQUE,            -- '2026-0184'
    lead_id             uuid REFERENCES "SolarCosta_Leads"(id)     ON DELETE SET NULL,
    proposta_id         uuid REFERENCES "SolarCosta_Propostas"(id) ON DELETE SET NULL,

    -- Snapshot do contratante (imutável após assinatura)
    cliente_nome        text NOT NULL,
    cpf_cnpj            text NOT NULL,
    rg_inscricao        text,
    endereco            text NOT NULL,
    cep                 text,
    telefone            text,

    -- Objeto do contrato
    potencia_kwp        numeric(10,2) NOT NULL,
    modulos_qtd         integer       NOT NULL,
    modulo_modelo       text,
    inversor_modelo     text,
    estrutura           text,
    prazo_execucao      text,
    local_instalacao    text,

    -- Condições financeiras
    valor_total         numeric(14,2) NOT NULL CHECK (valor_total >= 0),
    forma_pagamento     text,
    entrada             text,
    parcelas_info       text,
    banco_agente        text,
    primeiro_vencimento date,
    multa_atraso        text,
    foro_eleito         text,

    -- Garantias
    garantia_modulos      text,
    garantia_inversores   text,
    garantia_instalacao   text,
    garantia_homologacao  text,

    responsavel_tecnico_id uuid REFERENCES "SolarCosta_Usuarios"(id) ON DELETE SET NULL,
    responsavel_tecnico    text,               -- snapshot do nome
    crea                   text,

    status              "SolarCosta_StatusContrato" NOT NULL DEFAULT 'aguardando',
    data_emissao        date NOT NULL DEFAULT CURRENT_DATE,
    data_assinatura     date,
    arquivo_assinado_url text,
    observacoes         text,
    criado_por_id       uuid REFERENCES "SolarCosta_Usuarios"(id) ON DELETE SET NULL,
    criado_em           timestamptz NOT NULL DEFAULT now(),
    atualizado_em       timestamptz NOT NULL DEFAULT now(),
    excluido_em         timestamptz,

    CONSTRAINT "SolarCosta_Contratos_assinatura_coerente" CHECK (
        status <> 'assinado' OR data_assinatura IS NOT NULL
    )
);

-- clausulas: string[] no mock -> tabela filha ordenada
CREATE TABLE "SolarCosta_ContratoClausulas" (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    contrato_id  uuid NOT NULL REFERENCES "SolarCosta_Contratos"(id) ON DELETE CASCADE,
    ordem        smallint NOT NULL DEFAULT 0,
    titulo       text NOT NULL,
    texto        text,
    UNIQUE (contrato_id, ordem)
);


-- =============================================================================
-- 9. OBRAS (pós-venda / instalação)
--    Origem do mock: INITIAL_OBRAS
-- =============================================================================

CREATE TABLE "SolarCosta_Obras" (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    numero                 text NOT NULL UNIQUE,          -- 'OBRA 0184'
    contrato_id            uuid REFERENCES "SolarCosta_Contratos"(id) ON DELETE SET NULL,
    lead_id                uuid REFERENCES "SolarCosta_Leads"(id)     ON DELETE SET NULL,
    proposta_id            uuid REFERENCES "SolarCosta_Propostas"(id) ON DELETE SET NULL,

    cliente_nome           text NOT NULL,
    cidade                 text,
    endereco               text,
    concessionaria_id      integer REFERENCES "SolarCosta_Concessionarias"(id) ON DELETE SET NULL,

    potencia_kwp           numeric(10,2) NOT NULL DEFAULT 0,
    modulos_qtd            integer NOT NULL DEFAULT 0,
    modulo_modelo          text,
    inversor_modelo        text,

    responsavel_tecnico_id uuid REFERENCES "SolarCosta_Usuarios"(id) ON DELETE SET NULL,
    equipe_instalacao      text,

    etapa                  "SolarCosta_EtapaObra"  NOT NULL DEFAULT 'Aguardando compra',
    status                 "SolarCosta_StatusObra" NOT NULL DEFAULT 'em_andamento',
    valor_obra             numeric(14,2) NOT NULL DEFAULT 0,

    data_inicio            date,
    previsao_conclusao     date,
    data_conclusao         date,

    estoque_baixado        boolean NOT NULL DEFAULT false,  -- guarda de idempotência
    estoque_baixado_em     timestamptz,
    observacoes            text,
    criado_em              timestamptz NOT NULL DEFAULT now(),
    atualizado_em          timestamptz NOT NULL DEFAULT now(),
    excluido_em            timestamptz,

    CONSTRAINT "SolarCosta_Obras_datas_coerentes" CHECK (
        previsao_conclusao IS NULL OR data_inicio IS NULL OR previsao_conclusao >= data_inicio
    ),
    CONSTRAINT "SolarCosta_Obras_conclusao_coerente" CHECK (
        status <> 'concluida' OR data_conclusao IS NOT NULL
    )
);

-- Checklist de homologação (1:1). Cada etapa guarda quem e quando concluiu.
CREATE TABLE "SolarCosta_ObraHomologacao" (
    obra_id                 uuid PRIMARY KEY REFERENCES "SolarCosta_Obras"(id) ON DELETE CASCADE,
    solicitacao_acesso      boolean NOT NULL DEFAULT false,
    solicitacao_acesso_em   date,
    parecer_acesso          boolean NOT NULL DEFAULT false,
    parecer_acesso_em       date,
    vistoria_agendada       boolean NOT NULL DEFAULT false,
    vistoria_agendada_em    date,
    vistoria_aprovada       boolean NOT NULL DEFAULT false,
    vistoria_aprovada_em    date,
    troca_medidor           boolean NOT NULL DEFAULT false,
    troca_medidor_em        date,
    relatorio_conexao       boolean NOT NULL DEFAULT false,
    relatorio_conexao_em    date,
    protocolo_distribuidora text,
    atualizado_em           timestamptz NOT NULL DEFAULT now()
);

-- Snapshot do kit consumido pela obra (Obra.kitItens)
CREATE TABLE "SolarCosta_ObraKitItens" (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    obra_id     uuid NOT NULL REFERENCES "SolarCosta_Obras"(id) ON DELETE CASCADE,
    produto_id  uuid REFERENCES "SolarCosta_Produtos"(id) ON DELETE SET NULL,
    descricao   text NOT NULL,
    qtd         numeric(12,3) NOT NULL CHECK (qtd > 0),
    valor_unit  numeric(14,2) NOT NULL DEFAULT 0,
    total       numeric(16,2) GENERATED ALWAYS AS (round(qtd * valor_unit, 2)) STORED,
    ordem       smallint NOT NULL DEFAULT 0
);

CREATE TABLE "SolarCosta_ObraHistorico" (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    obra_id      uuid NOT NULL REFERENCES "SolarCosta_Obras"(id) ON DELETE CASCADE,
    descricao    text NOT NULL,
    etapa        "SolarCosta_EtapaObra",
    usuario_id   uuid REFERENCES "SolarCosta_Usuarios"(id) ON DELETE SET NULL,
    usuario_nome text NOT NULL,
    ocorrido_em  timestamptz NOT NULL DEFAULT now()
);

-- Fotos/evidências da instalação (hoje inexistente no front — base pronta)
CREATE TABLE "SolarCosta_ObraAnexos" (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    obra_id        uuid NOT NULL REFERENCES "SolarCosta_Obras"(id) ON DELETE CASCADE,
    tipo           text NOT NULL DEFAULT 'foto' CHECK (tipo IN ('foto','art','projeto','parecer','trc','outro')),
    nome_arquivo   text NOT NULL,
    storage_path   text NOT NULL,
    tamanho_bytes  bigint,
    enviado_por_id uuid REFERENCES "SolarCosta_Usuarios"(id) ON DELETE SET NULL,
    enviado_em     timestamptz NOT NULL DEFAULT now()
);


-- =============================================================================
-- 10. FINANCEIRO
--     Origem do mock: INITIAL_BOLETOS / INITIAL_LANCAMENTOS
-- =============================================================================

CREATE TABLE "SolarCosta_Boletos" (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    numero_documento  text,
    linha_digitavel   text,
    nosso_numero      text,

    lead_id           uuid REFERENCES "SolarCosta_Leads"(id)     ON DELETE SET NULL,
    contrato_id       uuid REFERENCES "SolarCosta_Contratos"(id) ON DELETE SET NULL,
    obra_id           uuid REFERENCES "SolarCosta_Obras"(id)     ON DELETE SET NULL,
    fornecedor_id     uuid REFERENCES "SolarCosta_Fornecedores"(id) ON DELETE SET NULL,

    cliente_nome      text NOT NULL,          -- snapshot (sacado ou cedente)
    cpf_cnpj          text,

    valor             numeric(14,2) NOT NULL CHECK (valor > 0),
    parcela_numero    smallint,
    parcela_total     smallint,
    parcela_label     text,                   -- '1/60 (Entrada)'
    vencimento        date NOT NULL,
    situacao          "SolarCosta_SituacaoBoleto" NOT NULL DEFAULT 'em_aberto',
    tipo              "SolarCosta_TipoBoleto"     NOT NULL,
    categoria_id      integer REFERENCES "SolarCosta_CategoriasFinanceiras"(id) ON DELETE SET NULL,

    data_pagamento    date,
    valor_pago        numeric(14,2),
    juros_multa       numeric(14,2) DEFAULT 0,
    observacoes       text,
    criado_por_id     uuid REFERENCES "SolarCosta_Usuarios"(id) ON DELETE SET NULL,
    criado_em         timestamptz NOT NULL DEFAULT now(),
    atualizado_em     timestamptz NOT NULL DEFAULT now(),
    excluido_em       timestamptz,

    CONSTRAINT "SolarCosta_Boletos_pagamento_coerente" CHECK (
        situacao <> 'pago' OR data_pagamento IS NOT NULL
    )
);

CREATE TABLE "SolarCosta_LancamentosFinanceiros" (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    data          date NOT NULL DEFAULT CURRENT_DATE,
    descricao     text NOT NULL,
    categoria_id  integer REFERENCES "SolarCosta_CategoriasFinanceiras"(id) ON DELETE SET NULL,
    obra_id       uuid REFERENCES "SolarCosta_Obras"(id)    ON DELETE SET NULL,
    lead_id       uuid REFERENCES "SolarCosta_Leads"(id)    ON DELETE SET NULL,
    boleto_id     uuid REFERENCES "SolarCosta_Boletos"(id)  ON DELETE SET NULL,
    tipo          "SolarCosta_TipoLancamento" NOT NULL,
    -- Valor SEMPRE positivo; o sinal vem de `tipo`. No mock a despesa vinha
    -- negativa, o que quebrava qualquer SUM() ingênuo.
    valor         numeric(14,2) NOT NULL CHECK (valor > 0),
    forma         text,                       -- 'pix' | 'boleto' | 'cartao' | 'transferencia' | 'dinheiro'
    conciliado    boolean NOT NULL DEFAULT false,
    observacoes   text,
    usuario_id    uuid REFERENCES "SolarCosta_Usuarios"(id) ON DELETE SET NULL,
    criado_em     timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now(),
    excluido_em   timestamptz
);

COMMENT ON COLUMN "SolarCosta_LancamentosFinanceiros".valor IS
  'Sempre positivo. Use `tipo` para o sinal. Migração: ABS(valor) do mock.';


-- =============================================================================
-- 11. AGENDA
--     Origem do mock: INITIAL_AGENDAMENTOS
-- =============================================================================

CREATE TABLE "SolarCosta_Agendamentos" (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id         uuid REFERENCES "SolarCosta_Leads"(id)  ON DELETE SET NULL,
    obra_id         uuid REFERENCES "SolarCosta_Obras"(id)  ON DELETE SET NULL,
    lead_nome       text NOT NULL,             -- snapshot para leads excluídos
    tipo            "SolarCosta_TipoAgendamento"   NOT NULL,
    titulo          text NOT NULL,
    data            date NOT NULL,
    horario_inicio  time NOT NULL,
    horario_fim     time NOT NULL,
    endereco        text,
    cidade          text,
    responsavel_id  uuid REFERENCES "SolarCosta_Usuarios"(id) ON DELETE SET NULL,
    status          "SolarCosta_StatusAgendamento" NOT NULL DEFAULT 'agendado',
    observacoes     text,
    criado_por_id   uuid REFERENCES "SolarCosta_Usuarios"(id) ON DELETE SET NULL,
    criado_em       timestamptz NOT NULL DEFAULT now(),
    atualizado_em   timestamptz NOT NULL DEFAULT now(),
    excluido_em     timestamptz,

    CONSTRAINT "SolarCosta_Agendamentos_horario_valido" CHECK (horario_fim > horario_inicio)
);


-- =============================================================================
-- 12. AUDITORIA E NOTIFICAÇÕES
--     Origem do mock: services/audit.ts (INITIAL_AUDIT + localStorage)
-- =============================================================================

CREATE TABLE "SolarCosta_Auditoria" (
    id            bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    ocorrido_em   timestamptz NOT NULL DEFAULT now(),
    usuario_id    uuid REFERENCES "SolarCosta_Usuarios"(id) ON DELETE SET NULL,
    usuario_nome  text NOT NULL,               -- snapshot
    acao          "SolarCosta_AcaoAuditoria"     NOT NULL,
    entidade      "SolarCosta_EntidadeAuditoria" NOT NULL,
    entidade_id   uuid,
    alvo          text NOT NULL,               -- rótulo legível
    detalhes      text,
    dados_antes   jsonb,
    dados_depois  jsonb,
    ip            inet,
    user_agent    text
);

COMMENT ON TABLE "SolarCosta_Auditoria" IS
  'Trilha global append-only. Sem UPDATE/DELETE pela API; expurgo por rotina de retenção.';

-- Estado de leitura das notificações derivadas (a notificação em si é uma VIEW).
CREATE TABLE "SolarCosta_NotificacoesLidas" (
    usuario_id        uuid NOT NULL REFERENCES "SolarCosta_Usuarios"(id) ON DELETE CASCADE,
    notificacao_chave text NOT NULL,           -- ex.: 'nt-boleto-<uuid>'
    lida_em           timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (usuario_id, notificacao_chave)
);

COMMIT;
