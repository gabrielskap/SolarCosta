-- =============================================================================
--  SOLAR COSTA · V015 — bytes dos documentos do lead dentro do banco
--
--  A aba "Documentos" do LeadDetailView nunca funcionou: as pastas e os
--  contadores eram um array literal no componente (folderNames, com "48
--  arquivos" somado à mão) e o upload só mexia em estado React. As tabelas
--  SolarCosta_LeadDocumentos e SolarCosta_PastasDocumento existem desde a V001,
--  a view SolarCosta_vw_PastasDocumentos (V004) já calcula a contagem real por
--  lead, e nada disso jamais foi consultado. Faltava decidir UMA coisa: onde
--  ficam os bytes.
--
--  Por que bytea e não disco/S3. A V001 criou storage_path NOT NULL com o
--  comentário "caminho no disco/S3; o binário NÃO fica no banco". A V008 e a
--  V009 decidiram o contrário e explicaram o porquê (V008, seção 5): o deploy
--  é um container sem volume persistente — arquivo em disco sumiria no próximo
--  redeploy, e o backup do Postgres já é rotina. SolarCosta_SiteMidia e
--  SolarCosta_WhatsAppMidia guardam os bytes em bytea; esta tabela é a última
--  sobra do desenho antigo. Storage externo de verdade continua possível
--  depois, mas exigiria credencial, custo e uma dependência nova para destravar
--  uma tela que já está pronta.
--
--  Por que o hash NÃO é UNIQUE global, ao contrário de SolarCosta_SiteMidia. Lá
--  a mesma foto reenviada é duplicata e deve reaproveitar a linha. Aqui o mesmo
--  RG anexado a dois leads são dois documentos legítimos de dois clientes, e um
--  UNIQUE global faria o segundo upload sequestrar a linha do primeiro. O hash
--  serve de ETag na rota de download e de sinal de reenvio dentro do MESMO lead.
--
--  Limite de 10 MB e não os 25 MB que a tela prometia: o Nginx de produção tem
--  client_max_body_size 10M (deploy/nginx/solarcosta.conf). Um arquivo maior
--  morreria com 413 no proxy, antes de chegar na API — o CHECK abaixo e o texto
--  da tela passam a dizer a verdade.
--
--  Toca APENAS tabelas criadas pela V001, portanto já de posse do
--  solarcosta_migrator — a V009 criou tabelas cujo dono ficou `postgres` e
--  qualquer migration que as alcance derruba o deploy. Não cria tabela nova e
--  não usa ALTER TYPE (documento é auditado como entidade 'Lead', que já existe
--  no enum), então `npm run migrate` dá conta sozinho.
--
--  APLICANDO À MÃO NO DBEAVER (homologação): o runner não viu nada, então o
--  registro é seu. Sem esta linha o próximo deploy tenta aplicar de novo:
--
--    INSERT INTO "SolarCosta_SchemaMigrations" (versao)
--    VALUES ('V015__lead_documentos_bytea.sql');
--
--  O arquivo é re-executável de ponta a ponta — rodar duas vezes não quebra e
--  não duplica nada.
-- =============================================================================

BEGIN;

ALTER TABLE "SolarCosta_LeadDocumentos"
    ADD COLUMN IF NOT EXISTS conteudo    bytea,
    ADD COLUMN IF NOT EXISTS hash_sha256 text;

-- storage_path vira resíduo: nenhuma linha nova terá caminho para preencher.
-- A coluna fica (em vez de DROP) porque é o único vestígio de onde o desenho
-- antigo pretendia guardar o arquivo, e derrubá-la não devolve nada em troca.
ALTER TABLE "SolarCosta_LeadDocumentos" ALTER COLUMN storage_path DROP NOT NULL;

-- Linhas sem bytes não têm como ser baixadas: são as 4 do seed de demonstração
-- (S002), cujo storage_path aponta para um caminho que nunca existiu em disco
-- nenhum. Soft delete em vez de DELETE — a linha continua para quem for
-- investigar, e a tela para de oferecer um download que daria 404.
UPDATE "SolarCosta_LeadDocumentos"
   SET excluido_em = now()
 WHERE conteudo IS NULL AND excluido_em IS NULL;

-- tamanho_bytes já tinha CHECK (>= 0) na V001. Zero byte é arquivo quebrado, e
-- o teto espelha o limite do Nginx: o banco recusa o que o proxy recusaria.
--
-- DROP antes do ADD porque o Postgres não tem ADD CONSTRAINT IF NOT EXISTS, e
-- esta migration precisa ser re-executável: ela é aplicada à mão no DBeaver na
-- homologação, onde rodar o arquivo duas vezes é normal. Sem o DROP, a segunda
-- execução morre com 42710 e aborta a transação inteira — justamente nos
-- comandos acima, que já são idempotentes e não teriam problema nenhum.
ALTER TABLE "SolarCosta_LeadDocumentos"
    DROP CONSTRAINT IF EXISTS "SolarCosta_LeadDocumentos_tamanho_valido";

ALTER TABLE "SolarCosta_LeadDocumentos"
    ADD CONSTRAINT "SolarCosta_LeadDocumentos_tamanho_valido"
    CHECK (tamanho_bytes > 0 AND tamanho_bytes <= 10485760);

CREATE INDEX IF NOT EXISTS "SolarCosta_ix_LeadDocumentos_hash"
    ON "SolarCosta_LeadDocumentos" (lead_id, hash_sha256) WHERE excluido_em IS NULL;

COMMENT ON COLUMN "SolarCosta_LeadDocumentos".conteudo IS
    'Bytes do arquivo. NUNCA incluir em SELECT * nem em listagem: uma consulta '
    'descuidada devolve megabytes dentro de um JSON. Só a rota de download '
    '(GET /api/leads/:id/documentos/:docId/arquivo) lê esta coluna.';

COMMENT ON COLUMN "SolarCosta_LeadDocumentos".hash_sha256 IS
    'SHA-256 do arquivo. Serve de ETag no download (os bytes de um id nunca '
    'mudam, então o 304 sai de graça) e identifica reenvio do mesmo arquivo '
    'dentro do mesmo lead. Sem UNIQUE global: ver cabeçalho desta migration.';

COMMENT ON COLUMN "SolarCosta_LeadDocumentos".storage_path IS
    'Legado da V001, quando o plano era guardar o arquivo em disco/S3. Os bytes '
    'vivem em conteudo desde a V015; não preencher em linha nova.';

COMMIT;
