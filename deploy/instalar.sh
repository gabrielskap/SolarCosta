#!/usr/bin/env bash
#
# Instalador de produção do CRM Solar Costa.
#
#   sudo ./instalar.sh --tudo
#   sudo ./instalar.sh --firewall --backup          # só algumas etapas
#   sudo ./instalar.sh --tudo --simular             # mostra sem executar
#
# Idempotente: rodar duas vezes não duplica cron, nem regra de firewall,
# nem link do Nginx.
#
# Ordem importa. O firewall libera a 22 ANTES de ativar, senão você se
# tranca para fora da própria VPS.

set -Eeuo pipefail

# ============================================================== parâmetros ==
DOMINIO="${DOMINIO:-}"
EMAIL_CERTBOT="${EMAIL_CERTBOT:-}"
PGPORT="${PGPORT:-5434}"
PGDATABASE="${PGDATABASE:-SolarCosta}"
PGUSER_BACKUP="${PGUSER_BACKUP:-postgres}"
APP_DIR="${APP_DIR:-/opt/solarcosta}"
WEB_DIR="${WEB_DIR:-/var/www/solarcosta}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/solarcosta}"

FAZER_FIREWALL=0
FAZER_BACKUP=0
FAZER_NGINX=0
FAZER_API=0
SIMULAR=0

# =============================================================== utilidades ==
V='\033[0;32m'; A='\033[0;33m'; R='\033[0;31m'; C='\033[0;36m'; N='\033[0m'

titulo()  { printf "\n${C}══ %s ${N}\n" "$*"; }
ok()      { printf "  ${V}✓${N} %s\n" "$*"; }
aviso()   { printf "  ${A}!${N} %s\n" "$*"; }
erro()    { printf "  ${R}✗${N} %s\n" "$*" >&2; }
morrer()  { erro "$*"; exit 1; }

executar() {
    if [ "$SIMULAR" = "1" ]; then
        printf "  ${A}[simulado]${N} %s\n" "$*"
    else
        eval "$@"
    fi
}

confirmar() {
    [ "$SIMULAR" = "1" ] && return 0
    local resposta
    read -r -p "  $1 [s/N] " resposta
    [[ "$resposta" =~ ^[sS]$ ]]
}

trap 'erro "falhou na linha $LINENO"; exit 1' ERR

# =================================================================== flags ==
[ $# -eq 0 ] && { sed -n '2,16p' "$0" | sed 's/^#//'; exit 1; }

while [ $# -gt 0 ]; do
    case "$1" in
        --tudo)     FAZER_FIREWALL=1; FAZER_BACKUP=1; FAZER_NGINX=1; FAZER_API=1 ;;
        --firewall) FAZER_FIREWALL=1 ;;
        --backup)   FAZER_BACKUP=1 ;;
        --nginx)    FAZER_NGINX=1 ;;
        --api)      FAZER_API=1 ;;
        --simular)  SIMULAR=1 ;;
        --dominio)  DOMINIO="$2"; shift ;;
        --email)    EMAIL_CERTBOT="$2"; shift ;;
        *)          morrer "opção desconhecida: $1" ;;
    esac
    shift
done

[ "$(id -u)" = "0" ] || morrer "rode com sudo."
[ "$SIMULAR" = "1" ] && aviso "MODO SIMULAÇÃO — nada será alterado"

# ================================================== 1. PORTA DO POSTGRES ====
# Não altero docker-compose nem postgresql.conf automaticamente: um erro aqui
# derruba o banco. O script detecta e mostra exatamente o que mudar.
titulo "Exposição do Postgres"

porta_exposta=0
if ss -tlnp 2>/dev/null | grep -qE "0\.0\.0\.0:${PGPORT}|\[::\]:${PGPORT}"; then
    porta_exposta=1
    erro "a porta ${PGPORT} escuta em 0.0.0.0 — acessível pela internet"
    echo
    if docker ps --format '{{.Ports}}' 2>/dev/null | grep -q ":${PGPORT}->"; then
        contêiner=$(docker ps --filter "publish=${PGPORT}" --format '{{.Names}}' | head -1)
        echo "    Postgres em Docker (contêiner: ${contêiner:-desconhecido})."
        echo "    No docker-compose.yml, troque:"
        echo
        echo "        ports:"
        echo "          - \"${PGPORT}:5432\""
        echo "      por:"
        echo "          - \"127.0.0.1:${PGPORT}:5432\""
        echo
        echo "    e recrie:  docker compose up -d"
    else
        echo "    Postgres nativo. No postgresql.conf:"
        echo "        listen_addresses = 'localhost'"
        echo "    e reinicie:  systemctl restart postgresql"
    fi
    echo
    aviso "o firewall abaixo já bloqueia a porta de fora, mas corrija isto também"
    aviso "(defesa em profundidade: se o firewall cair, a porta continua fechada)"
else
    ok "porta ${PGPORT} não está exposta em 0.0.0.0"
fi

# ========================================================== 2. FIREWALL =====
if [ "$FAZER_FIREWALL" = "1" ]; then
    titulo "Firewall"

    command -v ufw >/dev/null || executar "apt-get install -y ufw"

    # SSH PRIMEIRO. Ativar o ufw sem isto derruba sua sessão e você perde a VPS.
    porta_ssh=$(ss -tlnp 2>/dev/null | grep -oP 'sshd.*:\K[0-9]+' | head -1 || echo 22)
    executar "ufw allow ${porta_ssh}/tcp comment 'SSH'"
    ok "SSH liberado na porta ${porta_ssh} (antes de ativar o firewall)"

    executar "ufw allow 80/tcp  comment 'HTTP'"
    executar "ufw allow 443/tcp comment 'HTTPS'"
    ok "HTTP e HTTPS liberados"

    executar "ufw default deny incoming"
    executar "ufw default allow outgoing"

    if ufw status 2>/dev/null | grep -q '^Status: active'; then
        ok "firewall já estava ativo"
    else
        if confirmar "Ativar o firewall agora? (a porta ${porta_ssh} está liberada)"; then
            executar "ufw --force enable"
            ok "firewall ativado"
        else
            aviso "firewall não ativado"
        fi
    fi

    [ "$SIMULAR" = "0" ] && ufw status numbered || true
fi

# =========================================================== 3. BACKUP ======
if [ "$FAZER_BACKUP" = "1" ]; then
    titulo "Backup"

    command -v pg_dump >/dev/null || executar "apt-get install -y postgresql-client"

    diretorio_script="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    executar "install -m 755 '${diretorio_script}/backup/solarcosta-backup.sh'    /usr/local/bin/"
    executar "install -m 755 '${diretorio_script}/backup/solarcosta-restaurar.sh' /usr/local/bin/"
    executar "mkdir -p '${BACKUP_DIR}'/{diario,semanal,mensal}"
    executar "chmod 700 '${BACKUP_DIR}'"
    executar "touch /var/log/solarcosta-backup.log"
    ok "scripts instalados em /usr/local/bin"

    # Credencial em ~/.pgpass, nunca na linha de comando (visível em `ps`).
    if [ -f /root/.pgpass ] && grep -q ":${PGDATABASE}:" /root/.pgpass 2>/dev/null; then
        ok "/root/.pgpass já tem credencial para ${PGDATABASE}"
    elif [ "$SIMULAR" = "1" ]; then
        printf "  ${A}[simulado]${N} pediria a senha do Postgres para gravar em /root/.pgpass\n"
    else
        echo
        echo "  Senha do usuário '${PGUSER_BACKUP}' no Postgres."
        echo "  Vai para /root/.pgpass com modo 600 e não aparece na tela."
        read -r -s -p "  Senha: " senha_pg
        echo
        [ -n "$senha_pg" ] || morrer "senha vazia"
        printf '127.0.0.1:%s:%s:%s:%s\n' "$PGPORT" "$PGDATABASE" "$PGUSER_BACKUP" "$senha_pg" >> /root/.pgpass
        chmod 600 /root/.pgpass
        unset senha_pg
        ok "/root/.pgpass gravado (modo 600)"
    fi

    # Cron idempotente: remove a linha antiga antes de escrever a nova.
    if [ "$SIMULAR" = "0" ]; then
        linha_cron="30 2 * * * /usr/local/bin/solarcosta-backup.sh >> /var/log/solarcosta-backup.log 2>&1"
        (crontab -l 2>/dev/null | grep -v 'solarcosta-backup.sh' || true; echo "$linha_cron") | crontab -
        ok "agendado no cron: todo dia às 02:30"
    else
        printf "  ${A}[simulado]${N} agendaria o backup às 02:30\n"
    fi

    # Um backup que nunca rodou é uma suposição.
    if [ "$SIMULAR" = "0" ]; then
        echo
        echo "  Executando o primeiro backup..."
        if /usr/local/bin/solarcosta-backup.sh; then
            ok "primeiro backup concluído e verificado"
        else
            erro "o primeiro backup FALHOU — veja /var/log/solarcosta-backup.log"
            erro "corrija antes de considerar o backup instalado"
            exit 1
        fi
    fi
fi

# ============================================================ 4. NGINX ======
if [ "$FAZER_NGINX" = "1" ]; then
    titulo "Nginx e TLS"

    [ -n "$DOMINIO" ] || morrer "informe o domínio: --dominio crm.exemplo.com.br"

    # O certificado só é emitido se o DNS já apontar para esta máquina.
    ip_servidor=$(curl -s --max-time 5 https://api.ipify.org || echo '')
    ip_dominio=$(getent hosts "$DOMINIO" | awk '{print $1}' | head -1 || echo '')
    if [ -n "$ip_servidor" ] && [ -n "$ip_dominio" ] && [ "$ip_servidor" != "$ip_dominio" ]; then
        aviso "DNS de ${DOMINIO} aponta para ${ip_dominio}, mas esta máquina é ${ip_servidor}"
        aviso "o certbot vai falhar até o DNS propagar"
        confirmar "Continuar mesmo assim?" || exit 1
    elif [ -n "$ip_dominio" ]; then
        ok "DNS de ${DOMINIO} aponta para esta máquina"
    fi

    command -v nginx >/dev/null || executar "apt-get install -y nginx"
    command -v certbot >/dev/null || executar "apt-get install -y certbot python3-certbot-nginx"

    diretorio_script="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    destino=/etc/nginx/sites-available/solarcosta

    if [ "$SIMULAR" = "0" ]; then
        sed "s/crm\.solarcosta\.com\.br/${DOMINIO}/g" \
            "${diretorio_script}/nginx/solarcosta.conf" > "$destino"

        # `http2 on` exige Nginx >= 1.25.1; antes disso a sintaxe é outra.
        versao=$(nginx -v 2>&1 | grep -oP '\d+\.\d+\.\d+')
        maior=$(printf '%s\n1.25.1\n' "$versao" | sort -V | tail -1)
        if [ "$maior" != "$versao" ]; then
            sed -i 's/^\( *\)http2 on;/\1# http2 on; (Nginx < 1.25.1)/' "$destino"
            sed -i 's/^\( *listen 443 ssl\);/\1 http2;/' "$destino"
            sed -i 's/^\( *listen \[::\]:443 ssl\);/\1 http2;/' "$destino"
            ok "sintaxe de HTTP\/2 ajustada para o Nginx ${versao}"
        fi

        # Antes do certificado existir, as diretivas ssl_certificate quebram o
        # `nginx -t`. O certbot preenche isso; até lá, servimos só o bloco :80.
        if [ ! -d "/etc/letsencrypt/live/${DOMINIO}" ]; then
            aviso "certificado ainda não existe — subindo só o bloco HTTP por ora"
            sed -i '/^server {$/,/^}$/{ /listen 443/,$ s/^/#/ }' "$destino" 2>/dev/null || true
        fi

        mkdir -p /var/www/certbot "$WEB_DIR"
        ln -sf "$destino" /etc/nginx/sites-enabled/solarcosta
        rm -f /etc/nginx/sites-enabled/default

        nginx -t || morrer "configuração do Nginx inválida"
        systemctl reload nginx
        ok "Nginx configurado para ${DOMINIO}"
    fi

    if [ ! -d "/etc/letsencrypt/live/${DOMINIO}" ]; then
        argumentos_email=""
        [ -n "$EMAIL_CERTBOT" ] && argumentos_email="--email ${EMAIL_CERTBOT} --agree-tos --no-eff-email"
        executar "certbot --nginx -d '${DOMINIO}' ${argumentos_email} --redirect --non-interactive || certbot --nginx -d '${DOMINIO}'"
        ok "certificado emitido"
    else
        ok "certificado já existe"
    fi

    executar "systemctl enable --now certbot.timer"
    ok "renovação automática ativa"

    echo
    aviso "ajuste o CORS da API: CORS_ORIGINS=https://${DOMINIO} em ${APP_DIR}/server/.env"
    aviso "e rebuilde o front com VITE_API_URL=https://${DOMINIO}"
fi

# ============================================================== 5. API ======
if [ "$FAZER_API" = "1" ]; then
    titulo "API como serviço"

    if ! id solarcosta >/dev/null 2>&1; then
        executar "useradd --system --home-dir '${APP_DIR}' --shell /usr/sbin/nologin solarcosta"
        ok "usuário de sistema 'solarcosta' criado"
    else
        ok "usuário 'solarcosta' já existe"
    fi

    if [ "$SIMULAR" = "0" ]; then
        cat > /etc/systemd/system/solarcosta-api.service <<UNIT
[Unit]
Description=API Solar Costa
After=network.target docker.service

[Service]
Type=simple
User=solarcosta
WorkingDirectory=${APP_DIR}/server
EnvironmentFile=${APP_DIR}/server/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${APP_DIR}/server

[Install]
WantedBy=multi-user.target
UNIT
        systemctl daemon-reload
        ok "serviço solarcosta-api criado"

        if [ -f "${APP_DIR}/server/dist/index.js" ]; then
            systemctl enable --now solarcosta-api
            sleep 3
            if systemctl is-active --quiet solarcosta-api; then
                ok "API no ar"
            else
                erro "a API não subiu — veja: journalctl -u solarcosta-api -n 50"
            fi
        else
            aviso "${APP_DIR}/server/dist não existe — rode 'npm ci && npm run build' lá"
            aviso "e depois: systemctl enable --now solarcosta-api"
        fi
    fi
fi

# ============================================================== resumo ======
titulo "Resumo"

[ "$porta_exposta" = "1" ] && erro "porta ${PGPORT} ainda exposta — corrija o docker-compose/postgresql.conf"
ufw status 2>/dev/null | grep -q '^Status: active' && ok "firewall ativo" || aviso "firewall inativo"
[ -f /usr/local/bin/solarcosta-backup.sh ] && ok "backup instalado" || aviso "backup não instalado"
crontab -l 2>/dev/null | grep -q solarcosta-backup && ok "backup agendado" || aviso "backup não agendado"
[ -n "$DOMINIO" ] && [ -d "/etc/letsencrypt/live/${DOMINIO}" ] && ok "TLS ativo" || aviso "TLS não configurado"
systemctl is-enabled --quiet solarcosta-api 2>/dev/null && ok "API como serviço" || aviso "API não é serviço"

echo
echo "  Falta ainda, fora deste script:"
echo "    · trocar a senha do admin:  ./trocar-senha-admin.sh"
echo "    · testar o fluxo completo:  cd server && node testar-fluxo.mjs"
echo "    · replicar o backup para fora da VPS (rclone/rsync)"
echo
