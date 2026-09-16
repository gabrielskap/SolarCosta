-- =============================================================================
--  SOLAR COSTA · V009 — WhatsApp pela uazapi (uazapiGO)
--
--  Até aqui o WhatsApp era um LINK. src/utils/contato.ts montava um wa.me/… e
--  o app do celular abria com o texto pronto. O sistema não sabia se a mensagem
--  saiu, não via a resposta, e a proposta ia embora como "abra o PDF e mande
--  você mesmo" — PDFModal.tsx só chama window.print(), nunca existiu arquivo.
--
--  O DESENHO EM UMA FRASE: a empresa conecta UM número por QR code, a API fala
--  com a uazapi usando o token daquela instância, e toda mensagem — enviada ou
--  recebida — é copiada para cá.
--
--  Por que copiar em vez de consultar a uazapi na hora:
--    ela não é arquivo. A documentação é explícita: mensagem some depois de
--    7 dias e mídia depois de 2. Quem quiser saber em dezembro o que foi
--    combinado em março precisa ter guardado em março.
--
--  Por que o token da instância mora aqui e não no .env, como as chaves do
--  Google: ele NASCE do POST /instance/create, disparado pela tela de conexão.
--  Não existe no momento do deploy. Fica cifrado (AES-256-GCM,
--  server/src/services/segredos.ts) porque o papel solarcosta_leitura lê tudo
--  e um token vazado manda mensagem no nome da empresa.
--
--  Sobre as tabelas de conversa/mensagem nascerem antes da tela que as usa:
--  é o mesmo caso de SolarCosta_ObraAnexos no V001 e dos tipos de bloco no
--  V008 — banco à frente do código não quebra nada, e partir a feature em duas
--  migrations só criaria um estado intermediário para ninguém usar.
-- =============================================================================

-- Fora da transação: o Postgres não deixa USAR um valor de ENUM na mesma
-- transação que o adiciona. Nada abaixo usa 'WhatsApp' — quem usa é a API, em
-- requisições posteriores. Mesmo motivo do 'Site' no V008.
ALTER TYPE "SolarCosta_EntidadeAuditoria" ADD VALUE IF NOT EXISTS 'WhatsApp';

BEGIN;

-- =============================================================================
-- 1. PERMISSÃO
-- =============================================================================

-- UMA permissão nova, não duas. Conectar e desconectar a instância fica atrás
-- de `gerenciar_usuarios`, que já é o portão de PATCH /api/config/empresa —
-- criar um segundo papel administrativo para uma tela de configuração só
-- aumentaria a matriz sem separar nada que já não esteja separado.
ALTER TABLE "SolarCosta_UsuarioPermissoes"
    ADD COLUMN IF NOT EXISTS usar_whatsapp boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN "SolarCosta_UsuarioPermissoes".usar_whatsapp IS
    'Permite ver a caixa de entrada e enviar mensagens em /sistema/whatsapp. '
    'NÃO permite conectar ou desconectar o número — isso exige gerenciar_usuarios. '
    'O cargo Administrador recebe por definição, independentemente desta coluna.';


-- =============================================================================
-- 2. INSTÂNCIA
--    Registro único, com a mesma trava de SolarCosta_Empresa: a empresa tem
--    um número de WhatsApp, não uma coleção deles.
-- =============================================================================

CREATE TABLE IF NOT EXISTS "SolarCosta_WhatsAppInstancia" (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    registro_unico    boolean NOT NULL DEFAULT true UNIQUE CHECK (registro_unico),
    nome_instancia    text NOT NULL,
    instancia_id      text,
    token_cifrado     text,
    status            text NOT NULL DEFAULT 'desconectada'
                      CHECK (status IN ('desconectada','conectando','conectada','hibernada')),
    numero_conectado  text,
    profile_name      text,
    webhook_segredo   text NOT NULL,
    ultimo_erro       text,
    conectado_em      timestamptz,
    ultimo_status_em  timestamptz,
    criado_em         timestamptz NOT NULL DEFAULT now(),
    atualizado_em     timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "SolarCosta_WhatsAppInstancia_nome_nao_vazio" CHECK (btrim(nome_instancia) <> '')
);

COMMENT ON TABLE "SolarCosta_WhatsAppInstancia" IS
    'A instância uazapi da empresa. Uma linha só, garantida por registro_unico.';
COMMENT ON COLUMN "SolarCosta_WhatsAppInstancia".instancia_id IS
    'Id da instância no lado da uazapi. Nulo enquanto ninguém clicou em conectar.';
COMMENT ON COLUMN "SolarCosta_WhatsAppInstancia".token_cifrado IS
    'Token da instância (header `token` da uazapi), cifrado em AES-256-GCM por '
    'server/src/services/segredos.ts. NUNCA sai da API para o navegador: quem '
    'o tiver envia mensagem como a empresa, sem passar por login nenhum.';
COMMENT ON COLUMN "SolarCosta_WhatsAppInstancia".status IS
    'Espelha o status da uazapi, traduzido: disconnected/connecting/connected/'
    'hibernated. Atualizado pelo webhook `connection` e pelo polling do QR.';
COMMENT ON COLUMN "SolarCosta_WhatsAppInstancia".webhook_segredo IS
    'Segmento aleatório da URL do webhook (/api/webhooks/whatsapp/:segredo). '
    'A uazapi NÃO assina o corpo — não há HMAC nem header de assinatura —, '
    'então a URL secreta é a primeira das três camadas de verificação, junto '
    'com o token que vem no corpo e o rate limit.';
COMMENT ON COLUMN "SolarCosta_WhatsAppInstancia".ultimo_erro IS
    'Última recusa da uazapi ou do WhatsApp, para a tela de conexão explicar '
    'por que parou de enviar (erro 463, limite de conversas novas, banimento).';

-- O QR code NÃO tem coluna aqui de propósito: expira em 2 minutos e é
-- redesenhado a cada GET /instance/status. Guardar um QR morto no banco só
-- criaria a chance de servir um que já não funciona.


-- =============================================================================
-- 3. CONVERSAS
-- =============================================================================

CREATE TABLE IF NOT EXISTS "SolarCosta_WhatsAppConversas" (
    id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    chatid                 text NOT NULL UNIQUE,
    telefone               text,
    nome_exibicao          text,
    lead_id                uuid REFERENCES "SolarCosta_Leads"(id) ON DELETE SET NULL,
    e_grupo                boolean NOT NULL DEFAULT false,
    nao_lidas              integer NOT NULL DEFAULT 0 CHECK (nao_lidas >= 0),
    ultima_mensagem_texto  text,
    ultima_mensagem_em     timestamptz,
    arquivada              boolean NOT NULL DEFAULT false,
    criado_em              timestamptz NOT NULL DEFAULT now(),
    atualizado_em          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "SolarCosta_ix_WhatsAppConversas_recentes"
    ON "SolarCosta_WhatsAppConversas" (ultima_mensagem_em DESC NULLS LAST)
    WHERE NOT arquivada;

CREATE INDEX IF NOT EXISTS "SolarCosta_ix_WhatsAppConversas_lead"
    ON "SolarCosta_WhatsAppConversas" (lead_id) WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS "SolarCosta_ix_WhatsAppConversas_telefone"
    ON "SolarCosta_WhatsAppConversas" (telefone) WHERE telefone IS NOT NULL;

COMMENT ON COLUMN "SolarCosta_WhatsAppConversas".chatid IS
    'O wa_chatid da uazapi: "5531986588456@s.whatsapp.net" para pessoa, '
    '"…@g.us" para grupo. UNIQUE porque é a chave de upsert do webhook.';
COMMENT ON COLUMN "SolarCosta_WhatsAppConversas".telefone IS
    'Só os dígitos com DDI (5531986588456), extraído do chatid. É por ele que '
    'a conversa acha o lead — ver o casamento por telefone na chegada.';
COMMENT ON COLUMN "SolarCosta_WhatsAppConversas".lead_id IS
    'Vínculo com o lead. Tentado automaticamente por telefone na primeira '
    'mensagem e corrigível à mão na tela: homônimo e número trocado existem, '
    'e um palpite errado do sistema não pode virar dado definitivo.';
COMMENT ON COLUMN "SolarCosta_WhatsAppConversas".nome_exibicao IS
    'Nome que o WhatsApp informa (agenda do aparelho ou push name). Não '
    'sobrescreve o nome do lead — é só o que aparece na lista de conversas.';


-- =============================================================================
-- 4. MÍDIA RECEBIDA
--    Mesmo desenho de SolarCosta_SiteMidia (V008): bytes no Postgres, porque
--    o deploy é container sem volume e disco some no redeploy. Aqui tem um
--    segundo motivo, mais urgente: a uazapi apaga a mídia em 2 dias e o link
--    que ela devolve morre junto.
-- =============================================================================

CREATE TABLE IF NOT EXISTS "SolarCosta_WhatsAppMidia" (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome_arquivo   text NOT NULL,
    mime_type      text NOT NULL,
    tamanho_bytes  integer NOT NULL CHECK (tamanho_bytes > 0),
    hash_sha256    text NOT NULL UNIQUE,
    conteudo       bytea NOT NULL,
    criado_em      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE "SolarCosta_WhatsAppMidia" IS
    'Arquivos recebidos no WhatsApp, baixados da uazapi antes de ela os apagar.';
COMMENT ON COLUMN "SolarCosta_WhatsAppMidia".conteudo IS
    'Bytes do arquivo. NUNCA incluir em SELECT * nem em listagem: uma consulta '
    'descuidada devolve megabytes dentro de um JSON.';
COMMENT ON COLUMN "SolarCosta_WhatsAppMidia".hash_sha256 IS
    'SHA-256 do arquivo. UNIQUE faz dedupe (a mesma foto reencaminhada '
    'reaproveita a linha) e serve de ETag na rota que a entrega.';


-- =============================================================================
-- 5. MENSAGENS
-- =============================================================================

CREATE TABLE IF NOT EXISTS "SolarCosta_WhatsAppMensagens" (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    conversa_id     uuid NOT NULL REFERENCES "SolarCosta_WhatsAppConversas"(id) ON DELETE CASCADE,
    mensagem_id     text UNIQUE,
    de_mim          boolean NOT NULL,
    tipo            text NOT NULL DEFAULT 'texto'
                    CHECK (tipo IN ('texto','imagem','video','audio','documento','contato','local','outro')),
    texto           text,
    midia_id        uuid REFERENCES "SolarCosta_WhatsAppMidia"(id) ON DELETE SET NULL,
    nome_arquivo    text,
    mime_type       text,
    status          text NOT NULL DEFAULT 'enviada'
                    CHECK (status IN ('fila','enviada','entregue','lida','falhou','cancelada')),
    erro            text,
    enviada_por_id  uuid REFERENCES "SolarCosta_Usuarios"(id) ON DELETE SET NULL,
    referencia_tipo text CHECK (referencia_tipo IN ('proposta','contrato')),
    referencia_id   uuid,
    ocorrido_em     timestamptz NOT NULL DEFAULT now(),
    criado_em       timestamptz NOT NULL DEFAULT now(),
    -- Mensagem de texto sem texto e sem mídia seria uma linha fantasma na
    -- thread — resultado de um evento de webhook que não soubemos ler. Tipos
    -- não textuais escapam porque contato e localização têm conteúdo próprio.
    CONSTRAINT "SolarCosta_WhatsAppMensagens_tem_conteudo" CHECK (
        texto IS NOT NULL OR midia_id IS NOT NULL OR tipo <> 'texto'
    ),
    CONSTRAINT "SolarCosta_WhatsAppMensagens_referencia_completa" CHECK (
        (referencia_tipo IS NULL) = (referencia_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS "SolarCosta_ix_WhatsAppMensagens_thread"
    ON "SolarCosta_WhatsAppMensagens" (conversa_id, ocorrido_em DESC);

CREATE INDEX IF NOT EXISTS "SolarCosta_ix_WhatsAppMensagens_referencia"
    ON "SolarCosta_WhatsAppMensagens" (referencia_tipo, referencia_id)
    WHERE referencia_id IS NOT NULL;

COMMENT ON COLUMN "SolarCosta_WhatsAppMensagens".mensagem_id IS
    'Id da mensagem no WhatsApp (messageid da uazapi). UNIQUE é o que torna o '
    'webhook idempotente: a uazapi não documenta política de retry, então '
    'assumir entrega repetida é a única postura segura. Nulo só no instante '
    'entre gravar a saída e receber o id de volta.';
COMMENT ON COLUMN "SolarCosta_WhatsAppMensagens".status IS
    'Tradução do status da uazapi, que vem capitalizado: Queued→fila, '
    'Sent→enviada, Delivered→entregue, Read→lida, Failed→falhou, '
    'Canceled→cancelada. Atualizado pelo evento messages_update.';
COMMENT ON COLUMN "SolarCosta_WhatsAppMensagens".referencia_tipo IS
    'Preenchido quando a mensagem ENTREGOU um documento, para a proposta saber '
    'por onde foi enviada e quando. Sem ele a relação se perderia no texto.';
COMMENT ON COLUMN "SolarCosta_WhatsAppMensagens".enviada_por_id IS
    'Quem clicou em enviar. Nulo em mensagem recebida e em envio automático.';
COMMENT ON COLUMN "SolarCosta_WhatsAppMensagens".ocorrido_em IS
    'Horário da mensagem no WhatsApp (messageTimestamp, que vem em ms), não o '
    'horário em que o webhook chegou aqui — os dois divergem quando a uazapi '
    'reenvia, e é o primeiro que ordena a conversa.';


-- =============================================================================
-- 6. MODELOS DE MENSAGEM
--    O vendedor não escreve do zero a cada proposta. E sem modelo cada um
--    manda um texto diferente, o que é exatamente o problema que o CRM veio
--    resolver no resto do funil.
-- =============================================================================

CREATE TABLE IF NOT EXISTS "SolarCosta_WhatsAppModelos" (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nome           text NOT NULL,
    contexto       text NOT NULL DEFAULT 'livre'
                   CHECK (contexto IN ('proposta','contrato','lead','livre')),
    texto          text NOT NULL,
    ordem          smallint NOT NULL DEFAULT 0,
    ativo          boolean NOT NULL DEFAULT true,
    criado_em      timestamptz NOT NULL DEFAULT now(),
    atualizado_em  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "SolarCosta_WhatsAppModelos_nome_unico" UNIQUE (nome),
    CONSTRAINT "SolarCosta_WhatsAppModelos_nome_nao_vazio" CHECK (btrim(nome) <> ''),
    CONSTRAINT "SolarCosta_WhatsAppModelos_texto_nao_vazio" CHECK (btrim(texto) <> '')
);

CREATE INDEX IF NOT EXISTS "SolarCosta_ix_WhatsAppModelos_contexto"
    ON "SolarCosta_WhatsAppModelos" (contexto, ordem) WHERE ativo;

COMMENT ON COLUMN "SolarCosta_WhatsAppModelos".texto IS
    'Texto com marcadores {{cliente}}, {{primeiro_nome}}, {{link}}, '
    '{{consultor}}, {{valor}}, {{numero}}, {{validade}}, {{empresa}}. A '
    'interpolação é NOSSA, no servidor — os {{…}} nativos da uazapi resolvem '
    'contra o CRM DELES, que não tem nossos dados.';
COMMENT ON COLUMN "SolarCosta_WhatsAppModelos".contexto IS
    'Onde o modelo aparece: na tela de proposta, de contrato, do lead, ou em '
    'qualquer lugar (livre).';


-- =============================================================================
-- 7. LINKS PÚBLICOS DE DOCUMENTO
--
--    O PDF não existe como arquivo: PDFModal.tsx é React + window.print(). Em
--    vez de colocar um Chromium de 400 MB no container só para virar isso em
--    bytes, o cliente recebe um LINK que abre o mesmo documento no navegador,
--    com o botão de salvar em PDF do próprio sistema dele.
--
--    Tabela separada, em vez de uma coluna em Propostas e outra em Contratos:
--    dá revogação, validade e contagem de abertura de uma vez só, sem mexer
--    em duas tabelas nem no propostaSchema do zod.
-- =============================================================================

CREATE TABLE IF NOT EXISTS "SolarCosta_LinksPublicos" (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    token                 text NOT NULL UNIQUE,
    tipo                  text NOT NULL CHECK (tipo IN ('proposta','contrato')),
    referencia_id         uuid NOT NULL,
    expira_em             timestamptz,
    aberturas             integer NOT NULL DEFAULT 0 CHECK (aberturas >= 0),
    primeira_abertura_em  timestamptz,
    ultima_abertura_em    timestamptz,
    criado_por_id         uuid REFERENCES "SolarCosta_Usuarios"(id) ON DELETE SET NULL,
    criado_em             timestamptz NOT NULL DEFAULT now(),
    revogado_em           timestamptz
);

CREATE INDEX IF NOT EXISTS "SolarCosta_ix_LinksPublicos_referencia"
    ON "SolarCosta_LinksPublicos" (tipo, referencia_id) WHERE revogado_em IS NULL;

COMMENT ON TABLE "SolarCosta_LinksPublicos" IS
    'Links sem login para o cliente abrir a proposta ou o contrato dele.';
COMMENT ON COLUMN "SolarCosta_LinksPublicos".token IS
    'Aleatório de 32 bytes em base64url. É a ÚNICA credencial do link: quem o '
    'tiver vê o documento. Por isso a rota pública devolve lista fechada de '
    'colunas, nunca SELECT * — ver o cabeçalho de publico.routes.ts.';
COMMENT ON COLUMN "SolarCosta_LinksPublicos".referencia_id IS
    'Id da proposta ou do contrato. Sem FK porque aponta para duas tabelas '
    'diferentes conforme `tipo`; a rota valida a existência na leitura.';
COMMENT ON COLUMN "SolarCosta_LinksPublicos".aberturas IS
    'Quantas vezes o cliente abriu. É o retorno que o wa.me nunca deu: saber '
    'que a proposta foi lida muda a hora de ligar.';
COMMENT ON COLUMN "SolarCosta_LinksPublicos".revogado_em IS
    'Mata o link sem apagar o histórico de acesso.';


-- =============================================================================
-- 8. atualizado_em NAS TABELAS NOVAS
--
--    O DO block do V003 instalou SolarCosta_fn_touch em toda tabela que TINHA
--    a coluna naquele momento. Tabela criada depois não é alcançada — é por
--    isso que as tabelas do V008 ficaram sem o gatilho. Aqui vai explícito.
-- =============================================================================

DO $do$
DECLARE t text;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'SolarCosta_WhatsAppInstancia',
        'SolarCosta_WhatsAppConversas',
        'SolarCosta_WhatsAppModelos'
    ] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'SolarCosta_tg_touch_' || t, t);
        EXECUTE format(
            'CREATE TRIGGER %I BEFORE UPDATE ON %I '
            'FOR EACH ROW EXECUTE FUNCTION "SolarCosta_fn_touch"()',
            'SolarCosta_tg_touch_' || t, t);
    END LOOP;
END $do$;


-- =============================================================================
-- 9. INSTÂNCIA E MODELOS INICIAIS
--
--    Vêm NESTA migration, e não em database/seeds/, pelo mesmo motivo do
--    conteúdo do site no V008: o Dockerfile roda `npm run migrate && npm start`
--    e nunca toca em seeds/. Se fossem seed, o primeiro deploy subiria sem
--    linha de instância e a tela de conexão quebraria no primeiro clique.
-- =============================================================================

-- A linha nasce desconectada, só com o segredo do webhook já sorteado.
-- gen_random_bytes vem do pgcrypto, habilitado no V001.
INSERT INTO "SolarCosta_WhatsAppInstancia" (nome_instancia, webhook_segredo)
VALUES ('solarcosta', encode(gen_random_bytes(32), 'hex'))
ON CONFLICT (registro_unico) DO NOTHING;

-- SEM LINHA EM BRANCO entre os modelos abaixo, por mais que ajudasse a ler.
-- O DBeaver tem uma opção ligada por padrão — "linha em branco como delimitador
-- de instruções" — que corta o INSERT em quatro fragmentos soltos, e cada um
-- falha com erro de sintaxe. Um arquivo de migration precisa rodar em qualquer
-- cliente, não só no runner do Node.
INSERT INTO "SolarCosta_WhatsAppModelos" (nome, contexto, texto, ordem) VALUES
('Envio de proposta', 'proposta',
 E'Olá, {{primeiro_nome}}! Aqui é {{consultor}}, da {{empresa}}.\n\n'
 'Preparei a sua proposta de energia solar — economia estimada de {{economia_mensal}} por mês.\n\n'
 'Você pode ver tudo por aqui: {{link}}\n\n'
 'Qualquer dúvida é só me chamar neste WhatsApp. A proposta vale até {{validade}}.', 1),
('Lembrete de proposta', 'proposta',
 E'Oi, {{primeiro_nome}}! Passando para saber se você chegou a ver a proposta que mandei.\n\n'
 '{{link}}\n\n'
 'Se ficou alguma dúvida sobre o sistema ou sobre as condições de pagamento, me chama que eu explico.', 2),
('Envio de contrato', 'contrato',
 E'{{primeiro_nome}}, que ótimo ter você com a gente!\n\n'
 'Seu contrato está pronto para conferência: {{link}}\n\n'
 'Dá uma lida com calma e me avisa se estiver tudo certo para seguirmos com a assinatura.', 1),
('Primeiro contato', 'lead',
 E'Olá, {{primeiro_nome}}! Aqui é {{consultor}}, da {{empresa}}.\n\n'
 'Recebi o seu contato sobre energia solar. Posso te fazer algumas perguntas rápidas para montar uma simulação de economia?', 1)
ON CONFLICT (nome) DO NOTHING;

COMMIT;
