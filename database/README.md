# Banco de dados — CRM Solar Costa

PostgreSQL 14+. Todas as relações usam o prefixo **`SolarCosta_`**, para conviver
com outros sistemas no mesmo banco (ex.: `Recanto_*`).

Como os identificadores têm maiúsculas, o PostgreSQL exige **aspas duplas**
em toda referência: `SELECT * FROM "SolarCosta_Leads";`

## Ordem de execução no DBeaver

Abra cada arquivo, confirme que está conectado ao banco certo e execute o script
inteiro (`Alt+X`). Todos abrem com `BEGIN` e fecham com `COMMIT`.

| # | Arquivo | O que faz | Obrigatório |
|---|---------|-----------|-------------|
| 1 | `migrations/V001__schema_inicial.sql` | Extensões, 16 tipos ENUM, 36 tabelas | Sim |
| 2 | `migrations/V002__indices.sql` | Índices + função imutável de busca sem acento | Sim |
| 3 | `migrations/V003__funcoes_e_triggers.sql` | Numeração, estoque, auditoria, histórico | Sim |
| 4 | `migrations/V004__views.sql` | 16 views de leitura (dashboard, notificações, painéis) | Sim |
| 5 | `seeds/S001__configuracao_base.sql` | Empresa, parâmetros, domínios, admin de bootstrap | Sim |
| 6 | `seeds/S002__dados_demo.sql` | Migração dos dados mockados de `storage.ts` | Só em dev/homolog |

> **O `rollback/R001__drop_all.sql` não está nessa lista de propósito.**
> Ele é a saída de emergência: apaga todos os objetos `SolarCosta_`. Se for
> executado junto com as migrations, derruba tudo que elas acabaram de criar.
> Por isso ele vem travado — só roda depois de você descomentar a linha
> `SET LOCAL solarcosta.confirmar_drop` no topo do arquivo. Use apenas em
> desenvolvimento e sempre depois de um `pg_dump`.

## Se der erro no DBeaver

O DBeaver, por padrão, **continua enviando** as instruções seguintes depois de
uma falha. Como cada script é uma transação única, todas as seguintes retornam
o mesmo erro genérico:

```
25P02: current transaction is aborted, commands ignored until end of transaction block
```

Esse **não é o erro real** — é só o eco. O erro verdadeiro é o primeiro da lista.

**Atenção à transação zumbi.** Em modo *Manual Commit*, o DBeaver mantém a
transação aberta entre execuções. Depois de uma falha, a transação continua
abortada e **todo** comando novo nessa conexão devolve `25P02` — inclusive o
diagnóstico e a re-execução do próprio script. Se o erro aparece já na primeira
instrução, é isso.

1. Botão direito na conexão → **Invalidate/Reconnect** (ou rode `ROLLBACK;`).
2. Troque **Manual Commit** por **Auto-commit** na barra de ferramentas. Os
   scripts têm `BEGIN`/`COMMIT` próprios, então seguem atômicos.
3. Feche e reabra o arquivo `.sql` — o editor guarda o conteúdo em cache.
4. Em *Preferences → Editors → SQL Editor → SQL Processing*, marque
   **"Stop at error"** para parar na primeira falha em vez de cascatear.
5. Rode `00_diagnostico.sql` para ver versão, extensões e o que já foi criado.
6. Ao rodar os scripts, clique em **Parar** no primeiro erro — nunca em
   "Ignorar todos", que esconde a causa.

As causas mais comuns:

| Sintoma no diagnóstico | Causa | Correção |
|---|---|---|
| Erro `25P02` já na **primeira** instrução | Transação abortada de uma execução anterior | Invalidate/Reconnect + Auto-commit |
| `42710: type "SolarCosta_…" already exists` | Estado parcial de uma tentativa anterior | Rode `rollback/R001__drop_all.sql` e reaplique o V001 |

**Ciclo de recuperação.** Enquanto o banco ainda não tem dados reais, o caminho
seguro depois de qualquer falha é sempre o mesmo: `R001__drop_all.sql` →
`V001` → `V002` → `V003` → `V004` → `S001`. Não tente corrigir um schema
meio-criado à mão; é mais rápido e mais confiável recomeçar do zero. Depois que
houver dado real, isso deixa de valer — aí cada correção vira uma migration
nova (`V005…`).
| `tabelas = 0` depois de rodar o V001 | O V001 falhou no meio e reverteu tudo | Rode o V001 de novo e leia o **primeiro** erro |
| `disponivel = false` em alguma extensão | Falta `postgresql-contrib` no servidor | `apt install postgresql-contrib-<versão>` e reinicie |
| `e_superusuario = false` | Sem permissão para `CREATE EXTENSION` | Rode só o bloco de extensões como superusuário |
| Dicionário `unaccent` não aparece | Extensão não criada | `CREATE EXTENSION unaccent;` |

## Pré-requisitos

As extensões `pgcrypto`, `citext`, `unaccent` e `pg_trgm` precisam estar
disponíveis. Em Postgres oficial (Debian/Alpine) elas vêm no pacote
`postgresql-contrib`. O `CREATE EXTENSION` exige superusuário na primeira vez.

O seed `S002` desliga e religa dois triggers durante a carga, o que exige que
ele rode com o usuário **dono** das tabelas — o mesmo que executou as migrations.
Ele também aborta se já houver leads na base, para não duplicar histórico.

## Contexto de usuário exigido pela API

Os triggers de auditoria leem o usuário logado a partir de variáveis de sessão.
A API Express deve abrir **toda transação de escrita** definindo essas variáveis.

Consultando à mão no DBeaver, `SET LOCAL` resolve:

```sql
BEGIN;
SET LOCAL app.usuario_id   = '00000000-0000-0000-0000-000000000000';
SET LOCAL app.usuario_nome = 'Fulano';
-- ... suas alterações ...
COMMIT;
```

Na API, use `set_config` — **`SET LOCAL` não aceita bind parameters**, e
interpolar o valor na string abriria injeção de SQL. O terceiro argumento
`true` é o que torna o efeito local à transação, igual ao `SET LOCAL`:

```sql
SELECT set_config('app.usuario_id', $1, true),
       set_config('app.usuario_nome', $2, true);
```

Sem isso, a trilha registra `Sistema` como autor. É o que `emTransacao()` faz
em [`server/src/db.ts`](../server/src/db.ts).

## Rotina diária

Agende `SELECT * FROM "SolarCosta_fn_rotina_diaria"();` uma vez por dia
(pg_cron, cron do sistema ou job da API). Ela marca boletos vencidos e obras
atrasadas — o que hoje o front simula com a data fixa `REFERENCE_TODAY`.

## Usuários do banco

Recomendado criar dois papéis separados:

```sql
-- Aplicação: só DML nas tabelas do CRM
CREATE ROLE solarcosta_app LOGIN PASSWORD '<senha forte>';
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO solarcosta_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO solarcosta_app;

-- Consulta no DBeaver: somente leitura
CREATE ROLE solarcosta_leitura LOGIN PASSWORD '<senha forte>';
GRANT SELECT ON ALL TABLES IN SCHEMA public TO solarcosta_leitura;
```

Ajuste os `GRANT` para as tabelas com prefixo `SolarCosta_` se o banco for
compartilhado com outros sistemas.

## Backup

```bash
pg_dump -h <host> -U <user> -d <db> -Fc -f solarcosta_$(date +%F).dump
```
