import { emTransacao } from '../db.js';
import { CacheConsulta } from './cacheConsulta.js';

// Sem retenção em memória: a validade é sempre conferida no PostgreSQL.
const consultas = new CacheConsulta(0);

export function consultarCacheGoogle<T>(chave: string, buscar: () => Promise<T>): Promise<T> {
  return consultas.consultar(chave, () => emTransacao(async (cliente) => {
    // Serializa a mesma busca inclusive quando existem várias instâncias da API.
    await cliente.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [chave]);
    await cliente.query('DELETE FROM "SolarCosta_CacheConsultasGoogle" WHERE expira_em <= clock_timestamp()');
    const { rows } = await cliente.query<{ resposta: T }>(
      'SELECT resposta FROM "SolarCosta_CacheConsultasGoogle" WHERE chave = $1 AND expira_em > clock_timestamp()',
      [chave],
    );
    if (rows[0]) return rows[0].resposta;

    const resposta = await buscar();
    await cliente.query(
      `INSERT INTO "SolarCosta_CacheConsultasGoogle" (chave, resposta, criado_em, expira_em)
       VALUES ($1, $2::jsonb, clock_timestamp(), clock_timestamp() + interval '24 hours')
       ON CONFLICT (chave) DO UPDATE SET resposta = EXCLUDED.resposta,
         criado_em = EXCLUDED.criado_em, expira_em = EXCLUDED.expira_em`,
      [chave, JSON.stringify(resposta)],
    );
    return resposta;
  }));
}
