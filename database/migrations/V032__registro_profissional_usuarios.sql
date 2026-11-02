ALTER TABLE "SolarCosta_Usuarios"
 ADD COLUMN tipo_profissional text CHECK (tipo_profissional IN ('engenheiro', 'tecnico')),
 ADD COLUMN crt varchar(40);
UPDATE "SolarCosta_Usuarios" SET tipo_profissional = 'engenheiro' WHERE cargo = 'Engenheiro' OR NULLIF(btrim(crea), '') IS NOT NULL;
ALTER TABLE "SolarCosta_Propostas"
 ADD COLUMN responsavel_tecnico_id uuid REFERENCES "SolarCosta_Usuarios"(id) ON DELETE SET NULL,
 ADD COLUMN conselho_profissional text CHECK (conselho_profissional IN ('CREA', 'CRT'));
