#!/bin/sh
# Gera env-config.js com a URL da API a partir da variável de ambiente do
# container, ANTES de subir o Nginx. Diferente de VITE_API_URL (que o Vite
# grava no bundle só durante `npm run build`), isto roda a cada `docker run`/
# start do container — então dá pra trocar a URL da API pelo painel do
# Easypanel sem rebuildar a imagem.
set -e

ARQUIVO=/usr/share/nginx/html/env-config.js

printf 'window.__ENV__ = {\n  VITE_API_URL: "%s"\n};\n' "${VITE_API_URL:-}" > "$ARQUIVO"

exec "$@"
