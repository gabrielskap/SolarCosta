# Estágio 1: Build da Aplicação React/Vite
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar manifesto de dependências
COPY package*.json ./

# Instalar dependências de forma reproduzível
RUN npm ci

# Copiar todo o código fonte
COPY . .

# Executar o build do Vite
RUN npm run build

# Estágio 2: Servidor HTTP leve com Nginx
FROM nginx:alpine

# Remover configurações e conteúdos padrões
RUN rm -rf /usr/share/nginx/html/* /etc/nginx/conf.d/default.conf

# Copiar a configuração customizada do Nginx para SPAs
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copiar os arquivos compilados do estágio de build
COPY --from=builder /app/dist /usr/share/nginx/html

# Expor a porta padrão HTTP
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
