# API Solar Costa

Camada entre o front React e o PostgreSQL. O navegador não fala direto com o
banco — tudo passa por aqui.

Node 20+ · Express 4 · `pg` sem ORM (as views do banco já entregam a leitura
quase pronta) · TypeScript estrito.

---

## Setup

### 1. Criar os papéis no banco

A API **não** deve conectar como `postgres`. Rode uma vez, no DBeaver conectado
ao banco `SolarCosta` como superusuário:

```
database/02_papeis.sql
```

Troque as duas senhas marcadas no arquivo antes de executar. Gere cada uma com:

```bash
openssl rand -base64 32
```

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar o ambiente

```bash
cp .env.example .env
```

Gere os dois segredos JWT (precisam ser **diferentes** entre si):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Preencha o `.env` com eles e com a `DATABASE_URL` apontando para
`solarcosta_app`. O `.env` está no `.gitignore` — não comite.

### 4. Subir

```bash
npm run dev
```

A API só sobe depois de confirmar que o banco responde e que as 36 tabelas
existem. Se faltar migration, ela recusa e diz o que fazer.

---

## Testando de ponta a ponta

Login com o admin criado pelo `S001` (use a senha que você definiu ao trocar a
temporária):

```bash
curl -s -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@solarcosta.com.br","senha":"SUA_SENHA"}'
```

A resposta traz `accessToken`, `refreshToken` e o usuário com as permissões.
Guarde o token numa variável:

```bash
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login -H "Content-Type: application/json" -d '{"email":"admin@solarcosta.com.br","senha":"SUA_SENHA"}' | node -pe "JSON.parse(require('fs').readFileSync(0)).accessToken")
```

Listar leads:

```bash
curl -s http://localhost:4000/api/leads -H "Authorization: Bearer $TOKEN"
```

Criar um lead (repare que não mandamos `numero` — quem gera é o banco):

```bash
curl -s -X POST http://localhost:4000/api/leads -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"nome":"Teste API","telefone":"(31) 90000-0000","cidade":"Belo Horizonte","uf":"MG","consumo_kwh":800,"concessionaria":"CEMIG","telhado":"Laje","origem":"Indicação"}'
```

Mover a etapa (o trigger grava histórico e auditoria sozinho):

```bash
curl -s -X PATCH http://localhost:4000/api/leads/COLE_O_ID_AQUI/etapa -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"etapa":"Contato feito"}'
```

Confira no DBeaver que a trilha registrou você — não "Sistema":

```sql
SELECT ocorrido_em, usuario_nome, acao, entidade, alvo, detalhes
  FROM "SolarCosta_vw_Auditoria" LIMIT 10;
```

---

## Como isso está montado

### Contexto de auditoria

Os triggers do banco descobrem quem agiu lendo variáveis de sessão. Toda escrita
passa por `emTransacao(fn, ator)`, que as define antes de rodar `fn`:

```sql
SELECT set_config('app.usuario_id', $1, true),
       set_config('app.usuario_nome', $2, true);
```

Usamos `set_config` e não `SET LOCAL` porque **`SET LOCAL` não aceita bind
parameters** — interpolar o valor na string abriria injeção. O terceiro
argumento `true` dá o mesmo escopo de transação que o `SET LOCAL`.

Esquecer o `ator` não quebra nada: a trilha simplesmente registra `Sistema`.
Por isso toda rota de escrita passa `ator(req)`.

### Erros do banco viram mensagem de tela

O schema carrega muita regra (CHECKs, FKs, triggers que levantam exceção). Em
vez de duplicar validação na API, deixamos o banco recusar e traduzimos o
SQLSTATE em [`errors.ts`](src/errors.ts):

| SQLSTATE | HTTP | Exemplo |
|---|---|---|
| `23505` | 409 | "Já existe um usuário com esse e-mail." |
| `23503` | 409 | "Registro vinculado a outro cadastro." |
| `23514` | 422 | "Estoque insuficiente para X: saldo 7, baixa solicitada 999" |
| `P0001` | 422 | Mensagens dos nossos triggers e funções |

### Autenticação

- **Access token**: JWT de 15 minutos, não persistido. O front guarda em memória.
- **Refresh token**: 64 bytes aleatórios, gravado em `SolarCosta_Sessoes`
  **apenas como hash SHA-256**. Se o banco vazar, os refresh tokens não servem.
  Cada `/refresh` revoga o anterior e emite outro (rotação).
- `/login` tem rate limit de 10 tentativas por IP a cada 15 minutos, e responde
  a mesma mensagem para e-mail inexistente e senha errada — não entregamos quais
  e-mails existem.
- Permissões são lidas do banco **a cada requisição**, então revogar acesso vale
  na hora, sem esperar o token expirar. Administrador tem tudo por definição de
  cargo.

## Superfície completa

80 rotas em 13 grupos. Todas exigem `Authorization: Bearer <accessToken>`,
exceto `/health` e `/api/auth/login|refresh`.

| Grupo | Rotas | Permissão exigida |
|---|---|---|
| `/api/auth` | 4 | — |
| `/api/leads` | 7 | `criar_editar_leads` para escrita |
| `/api/propostas` | 6 | `emitir_propostas` para escrita |
| `/api/contratos` | 8 | `emitir_contratos` para escrita |
| `/api/obras` | 9 | `gerenciar_obras` para escrita |
| `/api/financeiro` | 10 | `ver_lancamentos_financeiro` no grupo inteiro |
| `/api/catalogo` | 12 | leitura e escrita liberadas a usuários logados |
| `/api/agenda` | 5 | logado |
| `/api/usuarios` | 7 | `gerenciar_usuarios`, menos a listagem e `/me/senha` |
| `/api/dashboard` | 4 | logado; KPIs de caixa só com `ver_lancamentos_financeiro` |
| `/api/notificacoes` | 2 | logado |
| `/api/config` | 4 | leitura liberada; escrita exige `gerenciar_usuarios` |
| `/api/auditoria` | 1 | `ver_auditoria` |

### Regras que a API impõe além do banco

- **Proposta aceita não é editada** — vira base de contrato (409).
- **Contrato assinado não é editado** — cancele e emita aditivo (409). Assinar
  também move o lead para `Fechado`.
- **Último administrador** não pode se desativar, mudar de cargo nem ser
  excluído (409), e ninguém exclui a própria conta.
- **Trocar senha revoga as outras sessões** do usuário.
- **`Produtos.estoque` nunca entra num UPDATE** — só muda por movimentação.

### O que ainda não existe

Upload de arquivo (documentos do lead e anexos de obra). O banco guarda
`storage_path` e os metadados, mas falta decidir onde o binário mora: volume na
VPS, MinIO ou S3. É o que trava a aba de documentos do `LeadDetailView`.

Emissão real de boleto (integração bancária ou Asaas) também está fora — as
rotas gravam os dados, mas quem gera a linha digitável hoje é o usuário.

---

## Produção

```bash
npm run build   # tsc -> dist/
npm start
```

Ou via Docker:

```bash
docker build -t solarcosta-api .
```

O container roda como usuário `node`, expõe a 4000 e tem healthcheck em
`/health`. Ponha o Nginx na frente com TLS e `proxy_pass` para a 4000.

Nunca exponha a porta do Postgres na internet — a API deve alcançar o banco pela
rede interna, e o DBeaver por túnel SSH.
