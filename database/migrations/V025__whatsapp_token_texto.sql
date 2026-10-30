-- Mantem o nome da coluna por compatibilidade com instalacoes existentes.
-- Valores legados cifrados continuam legiveis pela API com a chave original.
-- A mudanca de formato e feita pela API, sem alterar o schema ou os dados.
-- Nao executar COMMENT ON COLUMN: exige propriedade da tabela e pode impedir
-- o boot em instalacoes onde a tabela pertence a outro papel.
-- Mantem a versao para instalacoes que ja registraram a V025.
SELECT 1;
