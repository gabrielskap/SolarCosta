# Implantação — Solar Costa

Guia para deixar o sistema em produção com backup, rotina diária e TLS.
Todos os comandos assumem Ubuntu/Debian na VPS.

---

## 1. Fechar a porta do Postgres

Hoje o banco atende em `38.225.221.230:5434`, exposto à internet. Qualquer um
pode tentar força bruta contra ele. Duas camadas resolvem.

### 1a. O Postgres só escuta em localhost

Se o Postgres roda em Docker, o mapeamento provavelmente está assim:

```yaml
ports:
  - "5434:5432"          # errado: escuta em 0.0.0.0
```

Troque por:

```yaml
ports:
  - "127.0.0.1:5434:5432"   # só a própria máquina alcança
```

E recrie o contêiner (`docker compose up -d`). Se o Postgres está instalado
direto no sistema, o equivalente é `listen_addresses = 'localhost'` no
`postgresql.conf` seguido de `systemctl restart postgresql`.

### 1b. Firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

A porta 5434 fica de fora de propósito.

### 1c. Como acessar o banco pelo DBeaver depois disso

Túnel SSH. No DBeaver, aba **SSH** da conexão:

- Host/porta do túnel: o IP da VPS, porta 22
- Usuário e chave privada
- Na aba **Main**, host passa a ser `localhost` e porta `5434`

O DBeaver abre o túnel e o tráfego vai cifrado dentro do SSH.

### 1d. Conferir que fechou

De **outra** máquina:

```bash
nc -zv 38.225.221.230 5434
```

Tem que dar timeout ou "connection refused". Se conectar, a porta ainda está
aberta.

---

## 2. Rotina diária

Marca boletos vencidos e obras atrasadas. Sem ela, um boleto que passou do
vencimento fica "em aberto" para sempre e a central de notificações não avisa.

**Já está resolvido pela API** — o agendador roda às 03:10 e também na subida,
para pegar o que ficou para trás enquanto a API esteve fora. Configuração no
`server/.env`:

```
SCHEDULER_ATIVO=true
SCHEDULER_HORA=3
SCHEDULER_MINUTO=10
```

No log você vê:

```
[rotina] próxima execução em 29/08/2026, 03:10:00 (686 min)
[rotina] execução na subida · 0 boleto(s) vencido(s), 0 obra(s) atrasada(s) · 96ms
```

### Alternativa: pg_cron

Se preferir que rode mesmo com a API fora do ar, use
`postgres/rotina-diaria-pg_cron.sql` e ponha `SCHEDULER_ATIVO=false` no `.env`.
Ele também agenda o expurgo da auditoria e a limpeza de sessões expiradas —
duas coisas que o agendador da API não faz.

Rodar as duas ao mesmo tempo é inofensivo (a função é idempotente), só polui o
log.

---

## 3. Backup

### Instalar

```bash
sudo mkdir -p /var/backups/solarcosta
sudo chmod 700 /var/backups/solarcosta
sudo cp deploy/backup/solarcosta-*.sh /usr/local/bin/
sudo chmod +x /usr/local/bin/solarcosta-*.sh
sudo touch /var/log/solarcosta-backup.log
```

### Credencial sem senha na linha de comando

Senha em `pg_dump -W` ou em variável fica visível para quem rodar `ps`. Use o
`~/.pgpass` do usuário que executa o cron (aqui, root):

```bash
sudo -i
echo '127.0.0.1:5434:SolarCosta:postgres:SUA_SENHA' > ~/.pgpass
chmod 600 ~/.pgpass
```

O modo 600 é obrigatório — o `pg_dump` ignora o arquivo se estiver mais aberto.

### Agendar

```bash
sudo crontab -e
```

Acrescente:

```
# Backup do CRM Solar Costa, todo dia às 02:30
30 2 * * * /usr/local/bin/solarcosta-backup.sh >> /var/log/solarcosta-backup.log 2>&1
```

### Testar agora, sem esperar

```bash
sudo /usr/local/bin/solarcosta-backup.sh
sudo /usr/local/bin/solarcosta-backup.sh --verificar
```

### O que o script faz

- Dump em formato custom (`-Fc`), comprimido, do qual o `pg_restore` consegue
  extrair tabelas individuais
- Grava como `.parcial` e só renomeia no fim — processo morto no meio não deixa
  backup falso-positivo
- **Confere o dump com `pg_restore --list`** e falha se vier menos de 20 tabelas
  `SolarCosta_`. Backup corrompido que ninguém testou não é backup
- Retenção: 7 diários, 5 semanais (domingo), 12 mensais (dia 1)

### Restaurar

```bash
sudo /usr/local/bin/solarcosta-restaurar.sh            # lista os disponíveis
sudo /usr/local/bin/solarcosta-restaurar.sh /var/backups/solarcosta/diario/solarcosta-20260828-023000.dump
```

Por padrão restaura num banco `SolarCosta_restore_teste`, **não** em produção.
Pede confirmação digitada (`RESTAURAR`) e no fim conta tabelas, views, usuários
e leads para você conferir.

> **Faça esse teste uma vez por trimestre.** Backup nunca restaurado é
> suposição, não garantia.

### Levar para fora da VPS

Backup no mesmo disco do banco não protege contra perda da VPS. Depois que o
local estiver rodando, sincronize para outro lugar:

```bash
# 45 2 * * * — depois do backup das 02:30
rclone sync /var/backups/solarcosta remoto:solarcosta-backups
```

---

## 4. Nginx com TLS

### Publicar o front

```bash
npm run build                                    # na sua máquina
sudo mkdir -p /var/www/solarcosta
sudo rsync -a --delete dist/ root@SEU_IP:/var/www/solarcosta/
```

Antes do build, aponte a API para o domínio no `.env` do front:

```
VITE_API_URL=https://crm.solarcosta.com.br
```

Com o proxy do Nginx, front e API ficam na mesma origem — o CORS deixa de
existir.

### Configurar

```bash
sudo apt install nginx certbot python3-certbot-nginx
sudo cp deploy/nginx/solarcosta.conf /etc/nginx/sites-available/solarcosta
```

Troque `crm.solarcosta.com.br` pelo domínio real no arquivo, então:

```bash
sudo ln -s /etc/nginx/sites-available/solarcosta /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

### Emitir o certificado

O DNS do domínio precisa apontar para o IP da VPS **antes** disto.

```bash
sudo certbot --nginx -d crm.solarcosta.com.br
```

O certbot instala a renovação automática. Confira:

```bash
sudo systemctl status certbot.timer
sudo certbot renew --dry-run
```

### Ajustar o CORS da API

Com tudo na mesma origem, o `server/.env` fica:

```
CORS_ORIGINS=https://crm.solarcosta.com.br
```

### Conferir

```bash
curl -I https://crm.solarcosta.com.br/health
curl -I http://crm.solarcosta.com.br            # deve devolver 301
```

Para a nota do TLS: <https://www.ssllabs.com/ssltest/>

> **Sobre o HSTS.** O `Strict-Transport-Security` está ligado no arquivo. Só
> deixe assim depois de confirmar que o HTTPS funciona: uma vez enviado, o
> navegador recusa HTTP nesse domínio por um ano, e não há como voltar atrás
> pelo servidor.

---

## 5. API como serviço

Para a API subir sozinha no boot e reiniciar se cair:

```ini
# /etc/systemd/system/solarcosta-api.service
[Unit]
Description=API Solar Costa
After=network.target docker.service

[Service]
Type=simple
User=solarcosta
WorkingDirectory=/opt/solarcosta/server
EnvironmentFile=/opt/solarcosta/server/.env
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

# Endurecimento
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/solarcosta/server

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now solarcosta-api
sudo journalctl -u solarcosta-api -f
```

---

## Checklist

- [ ] Postgres escutando só em `127.0.0.1`
- [ ] `ufw` ativo, portas 22/80/443 apenas
- [ ] Porta 5434 inacessível de fora (testado com `nc` de outra máquina)
- [ ] `~/.pgpass` com modo 600
- [ ] Backup no cron e testado com `--verificar`
- [ ] Restauração testada num banco descartável
- [ ] Backup replicado para fora da VPS
- [ ] Certificado emitido e `certbot renew --dry-run` passando
- [ ] `CORS_ORIGINS` com o domínio de produção
- [ ] Senha do `admin@solarcosta.com.br` trocada
- [ ] API rodando como serviço, com restart automático
- [ ] `[rotina]` aparecendo no log
