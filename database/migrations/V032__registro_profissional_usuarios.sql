BEGIN;
ALTER TABLE "SolarCosta_Usuarios"
 ADD COLUMN IF NOT EXISTS tipo_profissional text CHECK (tipo_profissional IN ('engenheiro', 'tecnico')),
 ADD COLUMN IF NOT EXISTS crt varchar(40);
UPDATE "SolarCosta_Usuarios" SET tipo_profissional = 'engenheiro' WHERE tipo_profissional IS NULL
 AND (cargo = 'Engenheiro' OR NULLIF(btrim(crea), '') IS NOT NULL);
ALTER TABLE "SolarCosta_Propostas"
 ADD COLUMN IF NOT EXISTS responsavel_tecnico_id uuid REFERENCES "SolarCosta_Usuarios"(id) ON DELETE SET NULL,
 ADD COLUMN IF NOT EXISTS conselho_profissional text CHECK (conselho_profissional IN ('CREA', 'CRT'));
COMMIT;
