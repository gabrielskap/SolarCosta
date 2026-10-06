-- =============================================================================
--  SOLAR COSTA · V013 — rascunho de página do site
--
--  Até aqui o CMS publicava direto: salvar um bloco em /sistema/site ia ao ar
--  na hora. Isso funciona para corrigir uma frase, mas não para o editor
--  visual (/sistema/site/editor), onde o administrador arrasta, redimensiona e
--  digita por minutos a fio — cada tecla não pode virar deploy de conteúdo.
--
--  O rascunho é um SNAPSHOT DA PÁGINA INTEIRA, não uma coluna-sombra por
--  bloco. A razão é que as três operações que faltavam não cabem em colunas:
--  bloco criado só no rascunho é um elemento a mais no array (com uuid gerado
--  no cliente), bloco excluído simplesmente não está no array, e reordenação é
--  a ordem do array. Com coluna por bloco seriam quatro colunas-sombra
--  (conteúdo, ordem, excluído, criado) e um estado inconsistente possível
--  entre elas.
--
--  O ganho mais importante, porém, é de segurança: /api/publico/site NÃO é
--  tocado por esta migration. Ele continua lendo SolarCosta_SiteBlocos, logo é
--  ESTRUTURALMENTE INCAPAZ de servir conteúdo não publicado — não existe um
--  WHERE para alguém errar depois, nem um refactor futuro que vaze rascunho.
--  Publicar reconcilia o snapshot contra SiteBlocos numa transação só.
--
--  Esta migration toca APENAS "SolarCosta_SitePaginas", criada pela V008 e
--  portanto já de posse do solarcosta_migrator. Isso é deliberado: a V009
--  criou tabelas cujo dono ficou `postgres` e qualquer migration que as
--  tocasse derrubava o deploy. Também não cria tabela nova (o que exigiria
--  registrar à mão em SchemaMigrations na homologação) nem usa ALTER TYPE
--  (que precisaria de prólogo fora de transação, como na V008).
-- =============================================================================

BEGIN;

ALTER TABLE "SolarCosta_SitePaginas"
    ADD COLUMN IF NOT EXISTS blocos_rascunho           jsonb,
    ADD COLUMN IF NOT EXISTS rascunho_em               timestamptz,
    ADD COLUMN IF NOT EXISTS rascunho_por              uuid
        REFERENCES "SolarCosta_Usuarios"(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS rascunho_desatualizado_em timestamptz;

COMMENT ON COLUMN "SolarCosta_SitePaginas".blocos_rascunho IS
    'Snapshot da lista de blocos em edição no editor visual, no formato '
    '[{id, tipo, visivel, conteudo}] — a ordem do array É a ordem na página. '
    'NULL significa "sem rascunho": é o estado de toda página existente, por '
    'isso esta migration não faz backfill. Publicar reconcilia este array '
    'contra SolarCosta_SiteBlocos e volta a NULL.';

COMMENT ON COLUMN "SolarCosta_SitePaginas".rascunho_em IS
    'Quando o rascunho foi salvo pela última vez. Serve de token de '
    'concorrência otimista: o PUT do rascunho recusa com 409 se o valor '
    'enviado pelo cliente não bater com este — é o que impede dois editores '
    'de sobrescreverem um ao outro em silêncio.';

COMMENT ON COLUMN "SolarCosta_SitePaginas".rascunho_desatualizado_em IS
    'Marcado por toda escrita AO VIVO em blocos desta página (a tela antiga '
    'de Configuração do Site continua publicando direto). Com este valor '
    'maior que rascunho_em, publicar o snapshot ressuscitaria conteúdo antigo '
    'e apagaria o bloco recém-criado — então o servidor recusa com 409 e pede '
    'para recarregar. Fundir duas listas de blocos sem ancestral comum é '
    'merge de três vias; recusar é honesto e recuperável.';

COMMIT;
