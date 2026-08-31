// Aplica os arquivos de database/migrations, em ordem, uma única vez cada.
// Roda antes da API subir (ver Dockerfile) — sem isso o boot falha em
// verificarConexao() por faltar tabela.
//
// Não toca em database/seeds/: S001/S002 continuam manuais (README do
// database/), já que S001 cria o admin de bootstrap e S002 é dado de demo.

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fecharPool, pool } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', 'database', 'migrations');

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

async function main(): Promise<void> {
  console.log(`[migrate] verificando ${MIGRATIONS_DIR}...`);
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
    await pool.query(sql);
    await registrar(arquivo);
    console.log(`[migrate] ${arquivo} OK`);
  }

  console.log('[migrate] banco atualizado.');
}

main()
  .catch((erro) => {
    console.error('[migrate] falha:', erro instanceof Error ? erro.message : erro);
    process.exitCode = 1;
  })
  .finally(() => fecharPool());
