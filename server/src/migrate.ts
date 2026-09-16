// Aplica os arquivos de database/migrations, em ordem, uma única vez cada.
// Roda antes da API subir (ver Dockerfile) — sem isso o boot falha em
// verificarConexao() por faltar tabela.
//
// Não toca em database/seeds/: S001/S002 continuam manuais (README do
// database/), já que S001 cria o admin de bootstrap e S002 é dado de demo.
//
// CONEXÃO PRÓPRIA, não o pool de db.js. Este processo é o único do sistema que
// precisa de DDL, e usa o papel solarcosta_migrator (MIGRATION_DATABASE_URL,
// ver database/03_papel_migracao.sql). A API roda com solarcosta_app, que só
// faz DML — é o que garante que uma injeção de SQL numa rota não alcance o
// schema, porque a conexão daquele processo não tem esse poder.

import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { config } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Onde estão os .sql — e são DOIS lugares, não um.
 *
 * No container, o Dockerfile copia database/migrations para /app/database, ao
 * lado de dist/. No repositório, a pasta está na RAIZ, um nível acima de
 * server/. O caminho fixo só contemplava o primeiro caso, então `npm run
 * migrate` rodado à mão morria em "nenhum arquivo .sql encontrado" — ou, pior,
 * como agora, num erro anterior que escondia o problema do caminho.
 */
const CANDIDATOS = [
  path.join(__dirname, '..', 'database', 'migrations'), // container
  path.join(__dirname, '..', '..', 'database', 'migrations'), // repositório (dist/)
  path.join(__dirname, '..', '..', '..', 'database', 'migrations'), // repositório (tsx src/)
];

const MIGRATIONS_DIR = CANDIDATOS.find((c) => existsSync(c)) ?? CANDIDATOS[0]!;

/** Sem MIGRATION_DATABASE_URL cai no DATABASE_URL — instalação antiga segue de pé. */
const usandoPapelProprio = Boolean(config.MIGRATION_DATABASE_URL);

const pool = new pg.Pool({
  connectionString: config.MIGRATION_DATABASE_URL ?? config.DATABASE_URL,
  ssl: config.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
  // Uma conexão basta: as migrations são sequenciais por definição.
  max: 1,
  connectionTimeoutMillis: 10_000,
  application_name: 'solarcosta-migrate',
});

/**
 * Tetos de espera.
 *
 * Migration que altera tabela existente precisa de ACCESS EXCLUSIVE, e o
 * padrão do Postgres é esperar para SEMPRE por ele. No deploy isso é pior do
 * que falhar: o `npm run migrate && npm start` fica pendurado, o container
 * nunca sobe, e não aparece erro nenhum para explicar — só um serviço que não
 * responde. Com o teto, a migration falha rápido e diz o motivo.
 *
 * 15s é folgado para pegar o lock quando o banco está tranquilo, e curto o
 * bastante para não disfarçar uma transação esquecida do outro lado.
 */
async function aplicarTetos(cliente: pg.PoolClient): Promise<void> {
  await cliente.query("SET lock_timeout = '15s'");
  // Teto separado e bem maior: criar índice em tabela grande demora, e isso
  // não é sintoma de contenção.
  await cliente.query("SET statement_timeout = '10min'");
}

async function garantirTabelaControle(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "SolarCosta_SchemaMigrations" (
      versao text PRIMARY KEY,
      aplicada_em timestamptz NOT NULL DEFAULT now()
    )
  `);
}

async function jaAplicada(versao: string): Promise<boolean> {
  const { rows } = await pool.query('SELECT 1 FROM "SolarCosta_SchemaMigrations" WHERE versao = $1', [versao]);
  return rows.length > 0;
}

async function registrar(versao: string): Promise<void> {
  await pool.query('INSERT INTO "SolarCosta_SchemaMigrations" (versao) VALUES ($1)', [versao]);
}

/**
 * "permission denied for schema public" é o erro mais provável aqui, e o mais
 * mudo: ele não diz que o papel está errado nem o que fazer. Como foi
 * exatamente essa mensagem que escondeu por tempo demais a contradição entre o
 * EASYPANEL.md e o 02_papeis.sql, vale traduzi-la.
 */
function explicar(erro: unknown): string {
  const msg = erro instanceof Error ? erro.message : String(erro);

  if (/lock timeout|canceling statement due to lock/i.test(msg)) {
    return (
      `${msg}\n\n` +
      '  Alguma outra sessão está com transação aberta segurando a tabela.\n' +
      '  Encontre e encerre com:\n\n' +
      "    SELECT pid, application_name, state, pg_terminate_backend(pid)\n" +
      "      FROM pg_stat_activity\n" +
      "     WHERE datname = current_database()\n" +
      "       AND state LIKE 'idle in transaction%'\n" +
      '       AND pid <> pg_backend_pid();'
    );
  }

  if (!/permission denied|must be owner/i.test(msg)) return msg;

  return (
    `${msg}\n\n` +
    (usandoPapelProprio
      ? '  O papel de MIGRATION_DATABASE_URL não tem poder para alterar o schema.\n' +
        '  Rode database/03_papel_migracao.sql como superusuário: ele dá CREATE ao\n' +
        '  solarcosta_migrator e transfere a propriedade dos objetos SolarCosta_.'
      : '  MIGRATION_DATABASE_URL não está definida, então a migração tentou usar o\n' +
        '  papel da API (DATABASE_URL). O solarcosta_app só faz DML, de propósito.\n' +
        '  Aplique database/03_papel_migracao.sql como superusuário e defina\n' +
        '  MIGRATION_DATABASE_URL com o papel solarcosta_migrator.')
  );
}

async function main(): Promise<void> {
  console.log(`[migrate] verificando ${MIGRATIONS_DIR}...`);
  if (!usandoPapelProprio) {
    console.warn(
      '[migrate] MIGRATION_DATABASE_URL não definida — usando DATABASE_URL. ' +
        'Ver database/03_papel_migracao.sql.',
    );
  }
  await garantirTabelaControle();

  const arquivos = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();

  if (arquivos.length === 0) {
    console.log('[migrate] nenhum arquivo .sql encontrado, nada a fazer');
    return;
  }

  for (const arquivo of arquivos) {
    if (await jaAplicada(arquivo)) {
      console.log(`[migrate] ${arquivo} já aplicada, pulando`);
      continue;
    }

    console.log(`[migrate] aplicando ${arquivo}...`);
    // Cada arquivo já traz seu próprio BEGIN/COMMIT (ver database/README.md).
    const sql = await readFile(path.join(MIGRATIONS_DIR, arquivo), 'utf8');

    // Conexão dedicada porque os tetos são por sessão: com o pool devolvendo
    // qualquer conexão, o SET valeria para uma e o arquivo rodaria em outra.
    const cliente = await pool.connect();
    try {
      await aplicarTetos(cliente);
      await cliente.query(sql);
    } finally {
      cliente.release();
    }

    await registrar(arquivo);
    console.log(`[migrate] ${arquivo} OK`);
  }

  console.log('[migrate] banco atualizado.');
}

main()
  .catch((erro) => {
    console.error('[migrate] falha:', explicar(erro));
    process.exitCode = 1;
  })
  .finally(() => pool.end());
