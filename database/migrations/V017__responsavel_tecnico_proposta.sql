-- =============================================================================
--  SOLAR COSTA · V017 — responsável técnico e CREA por PROPOSTA
--
--  A folha de equipamentos imprime "CREA RESPONSÁVEL: <registro> — <nome>", e
--  até aqui esse par só existia em um lugar: o cadastro da empresa
--  ("SolarCosta_Empresa".crea / .responsavel_tecnico, lidos pelo PDFModal).
--  Com um único registro global, trocar o engenheiro de uma proposta exigia
--  editar o cadastro da empresa — o que reescreveria TODA proposta já emitida,
--  inclusive as assinadas, porque o PDF é remontado a cada impressão.
--
--  Por isso vira snapshot da proposta, exatamente como já acontece em
--  "SolarCosta_Contratos" (V001), que guarda as duas colunas com o mesmo nome e
--  pelo mesmo motivo: o nome e o registro profissional impressos num documento
--  comercial são do momento da emissão e não podem mudar sozinhos depois.
--
--  NULL e não um DEFAULT com o valor da empresa: nulo aqui significa "esta
--  proposta não escolheu ninguém", e é o sinal que faz o front cair de volta no
--  cadastro da empresa. Proposta anterior a esta migration continua imprimindo
--  exatamente o que imprimia ontem — preencher as colunas com o responsável
--  atual congelaria nelas um dado que ninguém conferiu.
--
--  Toca APENAS "SolarCosta_Propostas", criada pela V001 e portanto já de posse
--  do solarcosta_migrator — a V009 criou tabelas cujo dono ficou `postgres` e
--  qualquer migration que as alcance derruba o deploy. Não cria tabela nova
--  nem usa ALTER TYPE, então `npm run migrate` dá conta sozinho e não exige
--  registro à mão em SchemaMigrations.
-- =============================================================================

BEGIN;

ALTER TABLE "SolarCosta_Propostas"
    ADD COLUMN IF NOT EXISTS responsavel_tecnico text,
    ADD COLUMN IF NOT EXISTS crea                text;

COMMENT ON COLUMN "SolarCosta_Propostas".responsavel_tecnico IS
    'Nome do engenheiro responsável impresso na folha de equipamentos, '
    'congelado no momento da emissão. NULL = usar "SolarCosta_Empresa".'
    'responsavel_tecnico (comportamento de toda proposta anterior à V017).';

COMMENT ON COLUMN "SolarCosta_Propostas".crea IS
    'Registro CREA impresso ao lado do responsável técnico, congelado na '
    'emissão. NULL = usar "SolarCosta_Empresa".crea. Mesma dupla de colunas '
    'que "SolarCosta_Contratos" já guarda desde a V001.';

COMMIT;
