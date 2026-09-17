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
| `MIGRATION_DATABASE_URL` | `postgres://solarcosta_migrator:SENHA@HOST:5432/SolarCosta` | Papel `solarcosta_migrator`, usado **só** pelo `npm run migrate` do passo de deploy. O `solarcosta_app` acima não tem DDL de propósito — sem esta variável o deploy para em `permission denied for schema public` e a API não sobe. Ver [database/03_papel_migracao.sql](database/03_papel_migracao.sql). |
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
| `GOOGLE_MAPS_SERVER_KEY` | — (vazio) | Liga a busca de telhado por satélite na proposta. Chave de **servidor**, restrita por **IP da VPS**, com **Solar API + Geocoding API + Maps Static API** liberadas. Vazia, a busca some da tela e o resto do sistema funciona igual. |
| `GOOGLE_MAPS_BROWSER_KEY` | — (vazio) | Liga o editor de telhado em tela cheia. Chave **separada** da de cima — esta roda no navegador, então precisa ser restrita por **referrer HTTP** (`https://SEU-DOMINIO/*`) e ter só a **Maps JavaScript API** liberada. Vazia, o card do telhado continua igual, só não abre em tela cheia. |

### WhatsApp (uazapi) — tudo ou nada

Vazias, a API sobe normalmente e só o WhatsApp fica desligado: a tela
`/sistema/whatsapp` mostra "Integração desligada no servidor" e o botão de
conectar fica inerte. O resto do sistema funciona igual.

> **CUIDADO: preencher só uma delas IMPEDE A API DE SUBIR.** O `superRefine` de
> [server/src/config.ts](server/src/config.ts) torna as outras três obrigatórias
> assim que `UAZAPI_ADMIN_TOKEN` existe, e configuração inválida derruba o
> processo na inicialização — de propósito. Ligar a integração pela metade daria
> erro no meio de um envio, que é o pior lugar possível para descobrir uma
> variável faltando. **Grave as quatro na mesma gravação.**

| Variável | Exemplo | Observação |
|---|---|---|
| `UAZAPI_ADMIN_TOKEN` | — | Token de **administrador do container** uazapi (header `admintoken`). É a variável que liga a integração. **É raiz**: `GET /instance/all` devolve o token de todas as instâncias do container em texto puro. Ele nunca sai de `server/src/services/uazapi.ts`. |
| `UAZAPI_URL` | `https://SEU-CONTAINER.uazapi.com` | Host do **seu** container uazapi, **sem barra final**. O `free.uazapi.com` serve para testar o fluxo do QR e nada mais — ele apaga a instância depois de 1 hora. |
| `APP_URL` | `https://crm.solarcosta.com.br` | URL pública, com protocolo e **sem barra final**. Duas coisas dependem dela e nenhuma consegue adivinhá-la a partir de um request: o endereço do webhook que registramos na uazapi, e o link público da proposta que vai para o cliente. |
| `WHATSAPP_CRIPTO_KEY` | — | Chave AES-256-GCM que cifra o token da instância no banco. Gere com `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |

> **Guarde a `WHATSAPP_CRIPTO_KEY` no mesmo lugar onde guarda as senhas do
> banco.** O token da instância nasce do `POST /instance/create` — disparado pelo
> clique em "Conectar número" — e vive cifrado com esta chave. Perder a chave
> torna o token indecifrável, e a única saída é reconectar o número pelo QR.
>
> Ela é separada do `JWT_SECRET` de propósito: rotacionar o segredo do JWT é
> operação de rotina e só derruba as sessões. Se ele também cifrasse este token,
> a mesma troca desconectaria o WhatsApp da empresa sem aviso.

Depois de ligar, ainda falta **dar a permissão**: a coluna `usar_whatsapp` nasce
`false`, então ligue o toggle "Usar WhatsApp" em **Usuários** para quem vai
atender. O cargo Administrador recebe por definição.

O webhook é registrado automaticamente no `POST /instancia/conectar`, apontando
para `{APP_URL}/api/webhooks/whatsapp/{segredo}` — o segredo é sorteado por
instalação e vive no banco, não em variável de ambiente.

> **Sobre as duas chaves do Google.** São duas porque as restrições são
> incompatíveis: a de servidor é travada por IP (e morreria no navegador), a de
> browser é travada por referrer (e é pública por natureza — quem abre o mapa
> consegue lê-la). O que protege a de browser é o referrer **mais um teto de
> cota no Cloud Console**: os tiles do mapa são cobrados direto do navegador, sem
> passar pela nossa API, então o cache e o debounce que seguram a fatura da
> busca por satélite não alcançam esse caminho. Defina o teto ao criar a chave.

**Não** existe mais `VITE_API_URL` em produção — o front usa caminho relativo
porque agora está na mesma origem da API. (Só é usado em desenvolvimento
local, quando front e API sobem em processos/portas separadas.)

## 4. Banco de dados

O Postgres **não** está neste Dockerfile — é auto-gerenciado, fora do
Easypanel (ver [deploy/README.md](deploy/README.md)). Antes do primeiro
deploy:

1. Crie os papéis (`solarcosta_app`, `solarcosta_leitura`) rodando
   [database/02_papeis.sql](database/02_papeis.sql) como superusuário.
2. Crie o papel de migração rodando
   [database/03_papel_migracao.sql](database/03_papel_migracao.sql), também
   como superusuário. **Este passo não é opcional** — sem ele o deploy
   automático do item abaixo não funciona.
3. Garanta que o host/porta do Postgres aceitem conexão vindas do Easypanel
   (rede privada, ou libere o IP de saída do Easypanel no firewall).

**As migrations rodam automaticamente** a cada deploy, antes da API subir
(`npm run migrate && npm start` no Dockerfile — ver
[server/src/migrate.ts](server/src/migrate.ts)). É idempotente: uma tabela
`SolarCosta_SchemaMigrations` registra o que já foi aplicado, então redeploys
não tentam recriar nada.

> **Isto exige `MIGRATION_DATABASE_URL`.** Até a introdução do
> `03_papel_migracao.sql`, esta seção descrevia um passo que não tinha como
> funcionar: o `solarcosta_app` tem `USAGE` no schema, não `CREATE`, então o
> migrate saía com código 1, o `&&` cortava o `npm start` e o container não
> subia. Na prática as migrations vinham sendo aplicadas à mão como `postgres`.
> Quem tem uma instalação anterior precisa rodar o `03` e definir a variável.

**Os seeds continuam manuais** — rode uma vez, via DBeaver, depois do
primeiro deploy bem-sucedido:

- [database/seeds/S001__configuracao_base.sql](database/seeds/S001__configuracao_base.sql)
  (obrigatório: empresa, parâmetros, usuário admin de bootstrap)
- `S002` é só para dev/homolog — **não** rode em produção.

## 5. Primeiro deploy — checklist

- [ ] Papéis do Postgres criados (`02_papeis.sql` **e** `03_papel_migracao.sql`)
- [ ] `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGINS` configurados
- [ ] Porta do serviço apontando para `80`
- [ ] Deploy concluído e log mostrando `[migrate] banco atualizado.` seguido de `[api] Solar Costa ouvindo em http://localhost:80`
- [ ] `S001__configuracao_base.sql` rodado manualmente (uma vez)
- [ ] Login testado com o admin criado pelo `S001` e senha trocada (ver [deploy/trocar-senha-admin.sh](deploy/trocar-senha-admin.sh) para o caminho via VPS, ou troque direto pela API depois do primeiro login)
- [ ] `curl -I https://SEU_DOMINIO/health` retornando 200

### Se for usar o WhatsApp

- [ ] `UAZAPI_ADMIN_TOKEN`, `UAZAPI_URL`, `APP_URL` e `WHATSAPP_CRIPTO_KEY` gravadas **juntas** (só uma delas derruba a API na subida)
- [ ] `WHATSAPP_CRIPTO_KEY` guardada em backup — sem ela o número precisa ser reconectado
- [ ] Toggle "Usar WhatsApp" ligado em **Usuários** para quem vai atender
- [ ] `/sistema/whatsapp` sem o aviso âmbar e com "Conectar número" clicável
- [ ] QR escaneado e o card mostrando "Conectado" com número e nome de perfil
- [ ] Webhook conferido do lado da uazapi, apontando para `{APP_URL}/api/webhooks/whatsapp/…`
- [ ] Proposta de teste enviada: mensagem chega com o link, o link abre o documento
