// Acesso ao PostgreSQL.
//
// Ponto central do desenho: toda escrita passa por `emTransacao`, que injeta o
// usuário logado nas variáveis de sessão. Os triggers de auditoria do banco
// (SolarCosta_fn_usuario_atual) leem essas variáveis para saber quem agiu.
// Sem isso a trilha registra "Sistema" e perde a rastreabilidade.

import pg from 'pg';
import { config } from './config.js';

const { Pool, types } = pg;

// O driver devolve NUMERIC como string para não perder precisão. Como todos os
// nossos NUMERIC cabem com folga num double (valores em reais, kWp, estoque),
// convertemos para number e o JSON sai limpo para o front.
types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));
// DATE volta como 'YYYY-MM-DD' em vez de Date, evitando surpresa de fuso.
types.setTypeParser(1082, (v) => v);
// int8 (count) como number — nossas contagens nunca chegam perto de 2^53.
types.setTypeParser(20, (v) => (v === null ? null : Number(v)));

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  max: config.DATABASE_POOL_MAX,
  ssl: config.DATABASE_SSL ? { rejectUnauthorized: false } : undefined,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  application_name: 'solarcosta-api',
});

pool.on('error', (err) => {
  console.error('[pool] erro em conexão ociosa', err);
});

export type Cliente = pg.PoolClient;

/** Quem está executando a operação — vai para a trilha de auditoria. */
export interface Ator {
  id: string;
  nome: string;
}

/**
 * Executa `fn` dentro de uma transação, com o contexto do usuário aplicado.
 *
 * Usa `set_config(chave, valor, true)` em vez de `SET LOCAL chave = valor`
 * porque SET LOCAL não aceita bind parameters — interpolar o valor na string
 * abriria injeção. O terceiro argumento `true` é o que torna o efeito local
 * à transação, exatamente como SET LOCAL.
 */
export async function emTransacao<T>(
  fn: (cliente: Cliente) => Promise<T>,
  ator?: Ator,
): Promise<T> {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');

    if (ator) {
      await cliente.query(
        `SELECT set_config('app.usuario_id', $1, true),
                set_config('app.usuario_nome', $2, true)`,
        [ator.id, ator.nome],
      );
    }

    const resultado = await fn(cliente);
    await cliente.query('COMMIT');
    return resultado;
  } catch (erro) {
    try {
      await cliente.query('ROLLBACK');
    } catch (erroRollback) {
      console.error('[db] falha ao reverter transação', erroRollback);
    }
    throw erro;
  } finally {
    cliente.release();
  }
}

/** Consulta simples de leitura, sem transação explícita. */
export async function consultar<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const { rows } = await pool.query<T>(sql, params);
  return rows;
}

/** Consulta que espera no máximo uma linha. */
export async function consultarUm<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const { rows } = await pool.query<T>(sql, params);
  return rows[0] ?? null;
}

/** Verifica a conectividade na subida da API. */
export async function verificarConexao(): Promise<void> {
  const linha = await consultarUm<{ tabelas: number }>(
    `SELECT count(*)::int AS tabelas
       FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name LIKE 'SolarCosta%'`,
  );

  const total = linha?.tabelas ?? 0;
  if (total < 36) {
    throw new Error(
      `Banco incompleto: encontrei ${total} tabelas SolarCosta_ (esperado 36). ` +
        'Aplique as migrations em database/ antes de subir a API.',
    );
  }
  console.log(`[db] conectado · ${total} tabelas SolarCosta_ encontradas`);
}

export async function fecharPool(): Promise<void> {
  await pool.end();
}
