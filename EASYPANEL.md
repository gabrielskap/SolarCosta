# Deploy no Easypanel

Um único serviço Docker: o `Dockerfile` na raiz builda o front (Vite) e a API
(`server/`) e sobe um único container Express, que serve a API em `/api/*` e
o `index.html` do React para todo o resto (SPA fallback). Ver
[server/src/app.ts](server/src/app.ts).

Não precisa de `docker-compose` — é um app só, uma imagem só.

---

## 1. Criar o app

No Easypanel: **Create Service → App**, aponte para este repositório Git,
build via **Dockerfile** (o da raiz). Nenhum build command extra é necessário
— tudo acontece dentro do `docker build`.

## 2. Porta (aba Domains / Ports)

Porta interna do container: **`80`**

É a porta que o Express escuta (`PORT`, default `80` já embutido na imagem) e
onde o `HEALTHCHECK` do Dockerfile bate em `/health`. Configure o
domínio/proxy do Easypanel apontando para `80`.

O container roda como usuário não-root (`node`), mas o Dockerfile concede ao
binário do Node a capability `cap_net_bind_service` via `setcap` — assim ele
consegue abrir a porta 80 (privilegiada, <1024) sem precisar rodar como root.

## 3. Variáveis de ambiente

### Obrigatórias

| Variável | Exemplo | Observação |
|---|---|---|
| `DATABASE_URL` | `postgres://solarcosta_app:SENHA@HOST:5432/SolarCosta` | Use o papel `solarcosta_app`, **não** `postgres`. Ver [database/README.md](database/README.md#usuários-do-banco). O Postgres roda fora deste container — precisa estar acessível pela rede do Easypanel. |
| `JWT_SECRET` | — | Mín. 32 caracteres. Gere com `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `JWT_REFRESH_SECRET` | — | Igual acima, **diferente** de `JWT_SECRET`. |
| `CORS_ORIGINS` | `https://crm.solarcosta.com.br` | Domínio público que o Easypanel vai atribuir ao app. Como front e API são a mesma origem em produção, isso só importa para clientes externos (Postman, app mobile, etc.). |

### Opcionais (têm default no código, ver [server/src/config.ts](server/src/config.ts))

| Variável | Default | Observação |
|---|---|---|
| `NODE_ENV` | `production` | Já fixado no Dockerfile; não precisa redefinir. |
| `PORT` | `80` | Já fixado no Dockerfile; só mude se também mudar a porta configurada no passo 2. |
| `DATABASE_SSL` | `false` | `true` se o Postgres exigir SSL. |
| `DATABASE_POOL_MAX` | `10` | Conexões simultâneas no pool. |
| `ACCESS_TOKEN_TTL` | `15m` | Duração do access token. |
| `REFRESH_TOKEN_TTL_DIAS` | `30` | Duração do refresh token, em dias. |
| `SCHEDULER_ATIVO` | `true` | Rotina diária (boletos vencidos, obras atrasadas) direto na API. Desligue (`false`) se preferir rodar via `pg_cron` — ver [deploy/postgres/rotina-diaria-pg_cron.sql](deploy/postgres/rotina-diaria-pg_cron.sql). |
| `SCHEDULER_HORA` / `SCHEDULER_MINUTO` | `3` / `10` | Horário da rotina diária (também roda uma vez na subida do container). |

**Não** existe mais `VITE_API_URL` em produção — o front usa caminho relativo
porque agora está na mesma origem da API. (Só é usado em desenvolvimento
local, quando front e API sobem em processos/portas separadas.)

## 4. Banco de dados

O Postgres **não** está neste Dockerfile — é auto-gerenciado, fora do
Easypanel (ver [deploy/README.md](deploy/README.md)). Antes do primeiro
deploy:

1. Crie os papéis (`solarcosta_app`, `solarcosta_leitura`) rodando
   [database/02_papeis.sql](database/02_papeis.sql) como superusuário.
2. Garanta que o host/porta do Postgres aceitem conexão vindas do Easypanel
   (rede privada, ou libere o IP de saída do Easypanel no firewall).

**As migrations (`database/migrations/V001` a `V004`) rodam automaticamente**
a cada deploy, antes da API subir (`npm run migrate && npm start` no
Dockerfile — ver [server/src/migrate.ts](server/src/migrate.ts)). É
idempotente: uma tabela `SolarCosta_SchemaMigrations` registra o que já foi
aplicado, então redeploys não tentam recriar nada.

**Os seeds continuam manuais** — rode uma vez, via DBeaver, depois do
primeiro deploy bem-sucedido:

- [database/seeds/S001__configuracao_base.sql](database/seeds/S001__configuracao_base.sql)
  (obrigatório: empresa, parâmetros, usuário admin de bootstrap)
- `S002` é só para dev/homolog — **não** rode em produção.

## 5. Primeiro deploy — checklist

- [ ] Papéis do Postgres criados (`02_papeis.sql`)
- [ ] `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGINS` configurados
- [ ] Porta do serviço apontando para `80`
- [ ] Deploy concluído e log mostrando `[migrate] banco atualizado.` seguido de `[api] Solar Costa ouvindo em http://localhost:80`
- [ ] `S001__configuracao_base.sql` rodado manualmente (uma vez)
- [ ] Login testado com o admin criado pelo `S001` e senha trocada (ver [deploy/trocar-senha-admin.sh](deploy/trocar-senha-admin.sh) para o caminho via VPS, ou troque direto pela API depois do primeiro login)
- [ ] `curl -I https://SEU_DOMINIO/health` retornando 200
