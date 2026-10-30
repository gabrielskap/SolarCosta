-- Mantem o nome da coluna por compatibilidade com instalacoes existentes.
-- Valores legados cifrados continuam legiveis pela API com a chave original.
COMMENT ON COLUMN "SolarCosta_WhatsAppInstancia".token_cifrado IS
  'Token da instancia em texto puro. Nome legado mantido por compatibilidade; valores antigos v1 podem permanecer cifrados ate a substituicao do token.';
