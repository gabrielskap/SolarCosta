ALTER TABLE "SolarCosta_Usuarios"
  ADD COLUMN IF NOT EXISTS trocar_senha boolean NOT NULL DEFAULT false;
