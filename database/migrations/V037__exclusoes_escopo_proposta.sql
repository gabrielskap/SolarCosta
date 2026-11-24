BEGIN;
ALTER TABLE "SolarCosta_Propostas"
  ADD COLUMN IF NOT EXISTS exclusoes_escopo text;
COMMENT ON COLUMN "SolarCosta_Propostas".exclusoes_escopo IS
  'Texto editável de exclusões do escopo. NULL usa o padrão; vazio oculta a seção.';
COMMIT;
