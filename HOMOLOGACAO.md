# Homologação no Easypanel

Ambiente espelho da produção: **a mesma imagem, o mesmo `Dockerfile`, o mesmo
repositório**. O que muda é só o conjunto de variáveis e o banco — aqui,
`SolarCosta_hml`.

Este arquivo cobre **apenas o que difere** de [EASYPANEL.md](EASYPANEL.md). Para
porta, healthcheck, Chromium/PDF e o significado de cada variável, aquele
documento continua valendo.

> **Nada no `Dockerfile` precisa mudar.** Ele não sabe em que ambiente está: DB,
> segredos e URLs entram por ambiente. Um segundo serviço no Easypanel apontando
> para o mesmo Git, com outras variáveis, é tudo o que homologação é.

---

## 1. Banco — `SolarCosta_hml`

O schema já está aplicado (48 relações, 16 views, 21 funções, 16 enums) e as dez
migrations já estão registradas em `SolarCosta_SchemaMigrations`, então o
`npm run migrate` do primeiro deploy não vai tentar recriar nada.

Falta **um passo, e ele não é opcional**: rodar
[database/homologacao/H001__papeis_hml.sql](database/homologacao/H001__papeis_hml.sql)
como superusuário, conectado ao `SolarCosta_hml`.

Ele faz duas coisas:

1. **Cria papéis próprios de homologação** — `solarcosta_hml_app` e
   `solarcosta_hml_migrator`.
2. **Transfere a propriedade** das 48 relações, dos 16 enums e das 21 funções,
   que hoje pertencem ao `postgres`, para o `solarcosta_hml_migrator`.

> **Por que papéis novos, e não os de produção.** Papel no Postgres é objeto de
> **cluster**, não de banco: o `solarcosta_app` existe uma vez só no servidor
> inteiro e já tem `CONNECT` no banco `SolarCosta`. Reusá-lo aqui daria ao
> container de homologação uma credencial que **abre a produção** — e um
> vazamento do painel de homologação valeria nos dois ambientes.

> **Por que a troca de dono.** O schema do `SolarCosta_hml` foi montado à mão
> pelo DBeaver conectado como `postgres`, então tudo nasceu com esse dono.
> `ALTER TABLE` e `ALTER TYPE … ADD VALUE` exigem **ser dono** — GRANT não
> basta. Sem a transferência, a próxima migration que alterar tabela existente
> derruba o `npm run migrate`, o `&&` corta o `npm start` e o container não
> sobe. É exatamente o que aconteceu com as seis tabelas do V009 em produção,
> e o motivo de o V010 precisar de uma checagem de privilégio em volta.

**Não rode `02_papeis.sql` nem `03_papel_migracao.sql` aqui.** Os dois têm
`GRANT CONNECT ON DATABASE "SolarCosta"` fixo no texto: conectado ao
`SolarCosta_hml` eles não dariam erro — dariam o GRANT **no banco de
produção**. O H001 tem uma guarda que o faz recusar rodar fora do
`SolarCosta_hml`.

> `database/homologacao/` fica **fora** de `database/migrations/`, de propósito:
> o runner aplica tudo que encontra naquela pasta, e o Dockerfile só copia ela
> para a imagem. O H001 é passo manual, uma vez só.

### Dados de demonstração

[database/seeds/S002__dados_demo.sql](database/seeds/S002__dados_demo.sql) é
liberado aqui — é para isto que ele existe. Nunca em produção.

---

## 2. Variáveis do serviço de homologação

Substitua o que está em CAIXA ALTA. Não acrescente `NODE_ENV` nem `PORT`: o
Dockerfile já fixa `production` e `80`.

```
# ------------------------------------------------------------------ banco --
DATABASE_URL=postgres://solarcosta_hml_app:SENHA_APP_HML@HOST_POSTGRES:PORTA/SolarCosta_hml
MIGRATION_DATABASE_URL=postgres://solarcosta_hml_migrator:SENHA_MIGRATOR_HML@HOST_POSTGRES:PORTA/SolarCosta_hml
DATABASE_SSL=false
DATABASE_POOL_MAX=5

# ----------------------------------------------------------------- sessão --
JWT_SECRET=GERE_UM_NOVO_SO_PARA_HOMOLOGACAO
JWT_REFRESH_SECRET=GERE_OUTRO_DIFERENTE
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DIAS=30

# ------------------------------------------------------------------- rede --
CORS_ORIGINS=https://SEU-APP-HML.easypanel.host
APP_URL=https://SEU-APP-HML.easypanel.host

# --------------------------------------------------------------- whatsapp --
# Deixe as quatro VAZIAS. Ver a seção 3.
```

`HOST_POSTGRES:PORTA` é o mesmo par que você usa no DBeaver — a conexão de lá
aponta para a porta **5434**, que não é a padrão. Se o Easypanel alcançar o
Postgres pela rede interna, prefira o nome do serviço ao IP público.

Gerando os segredos:

```bash
node -e "console.log('JWT_SECRET='+require('crypto').randomBytes(48).toString('base64url'))"
```

```bash
node -e "console.log('JWT_REFRESH_SECRET='+require('crypto').randomBytes(48).toString('base64url'))"
```

E as senhas dos dois papéis, em `base64url` porque vão dentro de uma URL de
conexão:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

> **`JWT_SECRET` E `JWT_REFRESH_SECRET` PRECISAM SER DIFERENTES DOS DE
> PRODUÇÃO.** O token não carrega o ambiente que o emitiu: repetir o segredo
> faz um login de homologação valer **como sessão autenticada em produção**.
> Como os dois serviços vão existir lado a lado no mesmo painel, copiar o bloco
> de variáveis da produção e trocar só o banco é o erro natural a cometer aqui.

`DATABASE_POOL_MAX=5` em vez de 10 porque os dois ambientes dividem o mesmo
servidor Postgres, e homologação não precisa disputar conexão com produção.

---

## 3. WhatsApp: deixe desligado

Vazias as quatro variáveis, a API sobe normalmente, `/sistema/whatsapp` mostra
"Integração desligada no servidor" e **o resto do sistema funciona igual**.

Isto não é economia de configuração. A base de homologação pode receber uma
cópia de dados reais, e a tela de envio manda mensagem para o telefone que
estiver no cadastro: um teste de "enviar proposta" em homologação chega no
WhatsApp de um cliente de verdade.

Se precisar mesmo testar a integração:

- use um **container uazapi separado** e um **número de teste** — nunca o
  número da empresa, porque conectar o mesmo número em duas instâncias derruba
  a sessão de produção;
- gere uma **`WHATSAPP_CRIPTO_KEY` própria**;
- `APP_URL` tem que ser o domínio de homologação, senão o webhook que a uazapi
  registra aponta para produção.

> Lembre que as quatro variáveis são **tudo ou nada**: preencher só uma faz a
> API sair com código 1 na subida e o container entra em laço de reinício.

---

## 4. Google Maps

As chaves de produção **não funcionam** aqui sem ajuste:

- `GOOGLE_MAPS_SERVER_KEY` é restrita por **IP**. Se o serviço de homologação
  sair pelo mesmo IP da VPS, funciona; se o Easypanel der outro IP de saída,
  acrescente-o na restrição da chave.
- `GOOGLE_MAPS_BROWSER_KEY` é restrita por **referrer**. O domínio de
  homologação precisa entrar na lista da chave, ou o mapa volta erro de
  `RefererNotAllowed`.

Deixar as duas vazias é uma escolha válida: a busca de telhado por satélite
some da tela e o resto continua igual. **Cada chamada em homologação é cobrada
na mesma fatura da produção** — se o objetivo do ambiente não é testar o mapa,
não ligue.

---

## 5. Checklist do primeiro deploy

- [ ] `H001__papeis_hml.sql` rodado como superusuário **no `SolarCosta_hml`**, com as duas senhas trocadas
- [ ] Consulta de conferência do fim do H001 voltando **zero linhas**
- [ ] Serviço criado no Easypanel apontando para este repositório, build por **Dockerfile**
- [ ] Porta interna **80**
- [ ] Bloco de variáveis gravado, com `JWT_SECRET`/`JWT_REFRESH_SECRET` **diferentes dos de produção**
- [ ] Log mostrando `[migrate] V001__schema_inicial.sql já aplicada, pulando` (dez vezes) e depois `[api] Solar Costa ouvindo em http://localhost:80`
- [ ] `curl -I https://SEU-APP-HML/health` retornando 200
- [ ] Login com `admin@solarcosta.com.br` / `TrocarEsta@2026` e **senha trocada**
- [ ] `S002__dados_demo.sql` rodado, se quiser as telas com conteúdo

> O log de migration **precisa** dizer "já aplicada, pulando" nas dez. Se
> aparecer `aplicando V001…`, o `INSERT` em `SolarCosta_SchemaMigrations` não
> chegou no banco certo, e o deploy vai parar na checagem de base limpa do
> V001 — que é o comportamento correto dela.
