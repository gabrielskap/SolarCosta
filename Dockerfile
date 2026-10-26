# =============================================================================
# Solar Costa — imagem única para Easypanel: Express serve a API e o build
# estático do React (SPA fallback). Ver server/src/app.ts para o roteamento.
# =============================================================================

# -----------------------------------------------------------------------------
# Estágio 1: build do frontend (React + Vite)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS frontend-builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY index.html vite.config.ts tsconfig.json ./
COPY public ./public
COPY src ./src
# Motor de geometria puro compartilhado pelo frontend e pela API.
COPY server/src/domain ./server/src/domain
RUN npm run build

# -----------------------------------------------------------------------------
# Estágio 2: build do backend (Express + TypeScript)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS backend-builder
WORKDIR /app/server

COPY server/package*.json ./
RUN npm ci

COPY server/tsconfig.json ./
COPY server/src ./src
RUN npm run build

# -----------------------------------------------------------------------------
# Estágio 3: dependências de produção da API
#
# Em estágio próprio, e não dentro do runner, para o BuildKit resolvê-lo EM
# PARALELO com o `apk add` do chromium — que sozinho domina o tempo de build.
# Em sequência depois do apk, este `npm ci` era tempo somado no fim de um build
# que já raspa o timeout de deploy do Easypanel (ver nota no estágio 4).
# -----------------------------------------------------------------------------
FROM node:20-alpine AS prod-deps
WORKDIR /app

COPY server/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# -----------------------------------------------------------------------------
# Estágio 4: runtime de produção — só o necessário para rodar
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Chromium, para transformar a proposta em PDF.
#
# A API abre a página pública do documento (/p/<token>) num navegador headless
# e manda imprimir — ver server/src/services/pdfDocumento.ts. É o único jeito de
# ter o PDF sem desenhar o documento uma segunda vez numa biblioteca de PDF, o
# que garantiria divergência no primeiro ajuste de layout.
#
# Custa ~300 MB na imagem. Os pacotes ao lado do chromium não são opcionais:
# sem nss o navegador não sobe, e sem as fontes o texto sai em caixas vazias.
#
# `puppeteer-core` (e não `puppeteer`) é dependência de propósito: o pacote
# completo baixa o próprio Chromium no npm install, o que somaria um segundo
# navegador de ~170 MB ao lado deste.
#
# ESTA É A CAMADA MAIS CARA DO BUILD. Sem cache ela leva ~12 min: o chromium do
# Alpine arrasta mesa, llvm, ffmpeg e pipewire junto — 188 pacotes, ~754 MB. Com
# cache o deploy inteiro sai em ~3 min; no dia em que o cache cai (imagem base
# nova, builder novo, prune no host) o mesmo commit passa de 3 para ~15 min e
# morre no timeout do Easypanel. Ver EASYPANEL.md, "Tempo de build".
#
# Por isso ela é a PRIMEIRA instrução do estágio: nada antes dela depende do
# código, então nenhum commit a invalida. Não insira COPY acima deste RUN.
#
# `libcap` entra na mesma camada, e não num `apk add` próprio depois, para o
# setcap não custar um segundo índice + triggers do apk num build apertado. Ele
# é removido no fim do RUN: nada do chromium depende dele.
#
# O setcap existe porque a porta 80 é privilegiada (<1024) e o bind exigiria
# root. Em vez de rodar o processo inteiro como root, concede só ao binário do
# node a capability de abrir portas privilegiadas; USER continua não-root para
# tudo o mais.
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      libcap && \
    setcap 'cap_net_bind_service=+ep' "$(readlink -f "$(which node)")" && \
    apk del libcap
ENV CHROMIUM_PATH=/usr/bin/chromium-browser

# Dependências de produção da API (pg, express, jwt, puppeteer-core, etc.)
COPY server/package*.json ./
COPY --from=prod-deps /app/node_modules ./node_modules

# Backend compilado (tsc -> dist/)
COPY --from=backend-builder /app/server/dist ./dist
# Frontend compilado, servido como estático pelo Express (ver app.ts)
COPY --from=frontend-builder /app/dist ./public
# SQL das migrations, aplicado por dist/migrate.js antes da API subir
COPY database/migrations ./database/migrations

# Não roda como root.
USER node

ENV PORT=80
EXPOSE 80

# Mesmo endpoint que o Easypanel pode usar como healthcheck HTTP.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||80)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Aplica as migrations pendentes (idempotente, ver migrate.ts) e só então
# sobe a API — evita subir servindo erro por tabela faltando.
CMD ["sh", "-c", "npm run migrate && npm start"]
