BEGIN;
ALTER TABLE "SolarCosta_Placas"
 ADD COLUMN produto_id uuid REFERENCES "SolarCosta_Produtos"(id);
CREATE UNIQUE INDEX "SolarCosta_Placas_produto_unico"
 ON "SolarCosta_Placas"(produto_id) WHERE produto_id IS NOT NULL;
COMMENT ON COLUMN "SolarCosta_Placas".produto_id IS
 'Produto do catálogo ao qual pertencem os dados técnicos da placa. Nulo somente para cadastros anteriores ao vínculo.';
COMMIT;
