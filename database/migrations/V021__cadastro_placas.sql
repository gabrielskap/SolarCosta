BEGIN;
CREATE TABLE "SolarCosta_Placas" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 fabricante varchar(120) NOT NULL,
 modelo varchar(160) NOT NULL,
 potencia_wp integer NOT NULL CHECK (potencia_wp BETWEEN 1 AND 3000),
 largura_m numeric NOT NULL CHECK (largura_m BETWEEN 0.2 AND 10),
 altura_m numeric NOT NULL CHECK (altura_m BETWEEN 0.2 AND 10),
 peso_kg numeric NOT NULL CHECK (peso_kg > 0 AND peso_kg <= 200),
 observacoes text NOT NULL DEFAULT '',
 ativo boolean NOT NULL DEFAULT true,
 UNIQUE(fabricante, modelo)
);
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'solarcosta_app') THEN
  GRANT SELECT, INSERT, UPDATE, DELETE ON "SolarCosta_Placas" TO solarcosta_app;
 END IF;
END $$;
COMMIT;
