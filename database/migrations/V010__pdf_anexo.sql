-- =============================================================================
--  SOLAR COSTA · V010 — a proposta vira anexo, não link
--
--  O V009 entregava o documento como LINK: o PDF não existia como arquivo, o
--  documento era React + window.print(), e colocar um Chromium de ~300 MB no
--  container pareceu caro demais para o retorno. O link ainda dava contagem de
--  abertura e revogação.
--
--  Não era o que se pedia. Link não é o que o cliente guarda, reencaminha para
--  o cônjuge ou leva ao banco para financiar. A partir daqui a API imprime a
--  própria página pública num Chromium headless e manda o PDF pelo
--  /send/media da uazapi — ver server/src/services/pdfDocumento.ts.
--
--  ESTA MIGRATION NÃO CRIA NEM ALTERA TABELA. Só corrige o texto dos modelos
--  semeados no V009, que mandavam o cliente abrir um endereço que não vai mais
--  junto. Sem isto, "Você pode ver tudo por aqui: {{link}}" viraria "Você pode
--  ver tudo por aqui: " — o marcador desconhecido some no interpolar(), e o
--  que sobra é uma frase cortada no WhatsApp do cliente.
--
--  SolarCosta_LinksPublicos CONTINUA EM USO, e de propósito: o token é como o
--  renderizador alcança o documento sem login. Ele só não vai mais na mensagem.
--
--  --------------------------------------------------------------------------
--  POR QUE TUDO ABAIXO ESTÁ DENTRO DE UM DO COM CHECAGEM DE PRIVILÉGIO
--
--  As seis tabelas criadas pelo V009 estão com dono `postgres`, e não
--  `solarcosta_migrator` como as 42 anteriores — sinal de que aquele arquivo
--  foi aplicado à mão por um cliente conectado como superusuário, em vez de
--  pelo `npm run migrate`. O papel de migration não tem NENHUM privilégio
--  nelas: não lê, não escreve.
--
--  Um UPDATE cru aqui levantaria "permission denied for table" e derrubaria a
--  migração inteira. Como o Dockerfile roda `npm run migrate && npm start`, o
--  container simplesmente não subiria — um ajuste de texto de modelo teria
--  derrubado a produção.
--
--  Então: se o privilégio existe, aplica; se não existe, avisa alto e segue.
--  Enquanto não for aplicada, os três modelos continuam citando {{link}} e a
--  aba Enviar mostra um aviso ao escolher um deles — ninguém manda mensagem
--  quebrada sem ser avisado.
--
--  A CORREÇÃO DE VERDADE é devolver o dono das seis tabelas ao migrator, e ela
--  exige superusuário: rode database/04_corrigir_donos_whatsapp.sql uma vez,
--  antes deste deploy. Depois disso esta migration aplica sozinha.
-- =============================================================================

BEGIN;

DO $do$
BEGIN
    IF NOT has_table_privilege(
             current_user, '"SolarCosta_WhatsAppModelos"', 'UPDATE') THEN
        RAISE WARNING
            'V010: % não tem UPDATE em SolarCosta_WhatsAppModelos (dono: %). '
            'Os modelos que citam {{link}} NÃO foram atualizados. '
            'Rode database/04_corrigir_donos_whatsapp.sql como superusuário e '
            'reaplique, ou ajuste os três textos pela aba Modelos da tela.',
            current_user,
            (SELECT pg_get_userbyid(relowner) FROM pg_class
              WHERE oid = '"SolarCosta_WhatsAppModelos"'::regclass);
        RETURN;
    END IF;
    --
    -- O filtro por {{link}} protege quem já editou o modelo pela tela nova: se
    -- o texto não cita mais o link, ele já está adaptado e não é tocado. É
    -- também o que torna esta migration idempotente.
    --
    UPDATE "SolarCosta_WhatsAppModelos" SET texto =
        E'Olá, {{primeiro_nome}}! Aqui é {{consultor}}, da {{empresa}}.\n\n'
        'Segue em anexo a sua proposta de energia solar — economia estimada de {{economia_mensal}} por mês.\n\n'
        'Qualquer dúvida é só me chamar neste WhatsApp. A proposta vale até {{validade}}.'
    WHERE nome = 'Envio de proposta' AND texto LIKE '%{{link}}%';
    --
    UPDATE "SolarCosta_WhatsAppModelos" SET texto =
        E'Oi, {{primeiro_nome}}! Passando para saber se você chegou a ver a proposta {{numero}} que mandei.\n\n'
        'Mando o arquivo aqui de novo, em anexo.\n\n'
        'Se ficou alguma dúvida sobre o sistema ou sobre as condições de pagamento, me chama que eu explico.'
    WHERE nome = 'Lembrete de proposta' AND texto LIKE '%{{link}}%';
    --
    UPDATE "SolarCosta_WhatsAppModelos" SET texto =
        E'{{primeiro_nome}}, que ótimo ter você com a gente!\n\n'
        'Seu contrato está em anexo, para conferência.\n\n'
        'Dá uma lida com calma e me avisa se estiver tudo certo para seguirmos com a assinatura.'
    WHERE nome = 'Envio de contrato' AND texto LIKE '%{{link}}%';
    --
    -- 'Primeiro contato' não é tocado: é de contexto `lead`, nunca teve {{link}}.
    --
    RAISE NOTICE 'V010: modelos de mensagem adaptados ao PDF anexo.';
END $do$;

-- Os COMMENT ON que documentariam a aposentadoria do {{link}} ficaram DE FORA
-- de propósito: comentar relação exige ser DONO dela, e o dono aqui é o
-- `postgres`. Não vale derrubar um deploy por uma linha de documentação — a
-- explicação está no cabeçalho deste arquivo e em PreviaMensagem.tsx.

COMMIT;
