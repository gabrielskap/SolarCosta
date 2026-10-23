BEGIN;
CREATE TABLE IF NOT EXISTS "SolarCosta_CapturasTelhado" (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 proposta_id uuid NOT NULL REFERENCES "SolarCosta_Propostas"(id),
 lead_id uuid NOT NULL REFERENCES "SolarCosta_Leads"(id),
 pasta_id integer NOT NULL REFERENCES "SolarCosta_PastasDocumento"(id),
 usuario_id uuid NOT NULL REFERENCES "SolarCosta_Usuarios"(id),
 usuario_nome text NOT NULL,
 estado text NOT NULL DEFAULT 'pendente' CHECK (estado IN ('pendente','processando','concluido','falhou','cancelado')),
 pronta boolean NOT NULL DEFAULT false,
 assinatura text NOT NULL CHECK (length(assinatura)=64),
 camera jsonb NOT NULL,
 largura integer NOT NULL CHECK (largura BETWEEN 1 AND 3840),
 altura integer NOT NULL CHECK (altura BETWEEN 1 AND 3840),
 melhorar_ia boolean NOT NULL,
 modelo text,
 original_id uuid REFERENCES "SolarCosta_LeadDocumentos"(id) ON DELETE SET NULL,
 final_id uuid REFERENCES "SolarCosta_LeadDocumentos"(id) ON DELETE SET NULL,
 fundo bytea CHECK (octet_length(fundo)<=10485760),
 mascara bytea CHECK (octet_length(mascara)<=10485760),
 mensagem text,
 criado_em timestamptz NOT NULL DEFAULT now(),
 iniciado_em timestamptz,
 terminado_em timestamptz
);
CREATE INDEX IF NOT EXISTS "SolarCosta_ix_CapturasTelhado_proposta" ON "SolarCosta_CapturasTelhado"(proposta_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS "SolarCosta_ix_CapturasTelhado_fila" ON "SolarCosta_CapturasTelhado"(criado_em) WHERE estado IN ('pendente','processando');
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='solarcosta_app') THEN
  GRANT SELECT,INSERT,UPDATE,DELETE ON "SolarCosta_CapturasTelhado" TO solarcosta_app;
 END IF;
END $$;
COMMIT;
