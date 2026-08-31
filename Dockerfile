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
# Estágio 3: runtime de produção — só o necessário para rodar
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Dependências de produção da API (pg, express, jwt, etc.)
COPY server/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Backend compilado (tsc -> dist/)
COPY --from=backend-builder /app/server/dist ./dist
# Frontend compilado, servido como estático pelo Express (ver app.ts)
COPY --from=frontend-builder /app/dist ./public
# SQL das migrations, aplicado por dist/migrate.js antes da API subir
COPY database/migrations ./database/migrations

# Porta 80 é privilegiada (<1024) — bind exigiria root. Em vez de rodar o
# processo inteiro como root, concede só ao binário do node a capability de
# abrir portas privilegiadas; USER continua não-root para tudo o mais.
RUN apk add --no-cache libcap && \
    setcap 'cap_net_bind_service=+ep' "$(readlink -f "$(which node)")" && \
    apk del libcap

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
