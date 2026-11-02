-- =============================================================================
--  SOLAR COSTA · Habilitar o link público e o WhatsApp da procuração
--
--  Rode UMA VEZ, conectado como superusuário (postgres) no banco SolarCosta,
--  DEPOIS do deploy que trouxe a V027 — e só onde o `npm run migrate` avisou:
--
--      WARNING:  V027: solarcosta_migrator não é dono de ...
--
--  ou onde a tela de procurações mostra o "Enviar" desligado.
--
--  POR QUE À MÃO: a V027 precisa incluir 'procuracao' em três CHECKs de
--  tabelas da V009 (LinksPublicos, WhatsAppMensagens, WhatsAppModelos), e ALTER
--  exige ser dono. Nessas tabelas o dono pode ser `postgres` (ver
--  04_corrigir_donos_whatsapp.sql), e aí a V027 avisa e segue em vez de
--  derrubar o deploy. A troca em si está na função que a V027 criou; aqui só
--  se chama ela com um papel que pode.
--
--  Idempotente: rodar de novo não muda nada. De quebra, vale rodar também o
--  04_corrigir_donos_whatsapp.sql — ele não é pré-requisito deste arquivo, mas
--  evita o mesmo aviso na próxima migration que tocar nessas tabelas.
-- =============================================================================

BEGIN;

SELECT "SolarCosta_fn_habilitar_envio_procuracao"();

COMMIT;

-- Confira depois de rodar — tem de voltar três linhas, todas citando 'procuracao':
--
--   SELECT conname, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conname IN ('SolarCosta_LinksPublicos_tipo_valido',
--                      'SolarCosta_WhatsAppMensagens_referencia_tipo_valida',
--                      'SolarCosta_WhatsAppModelos_contexto_valido');
