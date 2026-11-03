// Isola os testes de migrations em tabelas temporárias, sem dados de clientes
// nem ALTER/locks nas tabelas reais. A conexão e o rollback pertencem ao teste.
import { readFile } from 'node:fs/promises';
import type { Cliente } from '../server/src/db';

export async function prepararBancoTemporario(c: Cliente) {
  const tabelas = (await c.query(`SELECT tablename AS nome FROM pg_tables
    WHERE schemaname='public' AND tablename LIKE 'SolarCosta_%' ORDER BY tablename`)).rows;
  const fks = (await c.query(`SELECT t.relname AS nome, k.conname, pg_get_constraintdef(k.oid) AS definicao
    FROM pg_constraint k JOIN pg_class t ON t.oid=k.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public' AND t.relname LIKE 'SolarCosta_%' AND k.contype='f'`)).rows;
  const triggers = (await c.query(`SELECT pg_get_triggerdef(g.oid) AS definicao
    FROM pg_trigger g JOIN pg_class t ON t.oid=g.tgrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public' AND t.relname LIKE 'SolarCosta_%' AND NOT g.tgisinternal`)).rows;
  const id = (s: string) => '"' + s.replaceAll('"','""') + '"';
  // INCLUDING ALL cria sequências temporárias próprias para colunas IDENTITY.
  await c.query(tabelas.map(t => `CREATE TEMP TABLE ${id(t.nome)} (LIKE public.${id(t.nome)} INCLUDING ALL);`).join('\n'));
  // Relações sem qualificação passam a resolver as tabelas temporárias.
  await c.query(fks.map(f => `ALTER TABLE pg_temp.${id(f.nome)} ADD CONSTRAINT ${id(f.conname)} ${f.definicao.replaceAll('REFERENCES public.', 'REFERENCES pg_temp.')};`).join('\n'));
  await c.query(triggers.map(t => t.definicao.replace(/ ON public\./, ' ON pg_temp.') + ';').join('\n'));
  for (const arquivo of ['V033__ajustes_financiamento.sql', 'V034__garantias_proposta.sql']) {
    const migracao = await readFile(new URL(`../database/migrations/${arquivo}`, import.meta.url), 'utf8');
    await c.query(migracao.replace(/^BEGIN;\s*$/gm,'').replace(/^COMMIT;\s*$/gm,''));
  }
  await c.query(`INSERT INTO "SolarCosta_Sequencias" (chave,prefixo) VALUES ('proposta','QA-')`);
  await c.query(`INSERT INTO "SolarCosta_Usuarios" (nome,email,senha_hash,cargo,status)
    VALUES ('Teste temporário','qa-financiamento@example.invalid','hash-apenas-teste','Administrador','ativo')`);
}
