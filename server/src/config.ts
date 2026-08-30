// Configuração da API a partir do ambiente.
// Falhar aqui, na subida, é melhor do que descobrir uma variável faltando
// no meio de um request.

import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  // postgres://usuario:senha@host:porta/banco
  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatória'),
  DATABASE_SSL: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),

  // Segredos distintos: um token de acesso vazado não pode virar um refresh.
  JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa de pelo menos 32 caracteres'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET precisa de pelo menos 32 caracteres'),
  ACCESS_TOKEN_TTL: z.string().default('15m'),
  REFRESH_TOKEN_TTL_DIAS: z.coerce.number().int().positive().default(30),

  // Origens liberadas no CORS, separadas por vírgula.
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // Rotina diária (boletos vencidos, obras atrasadas). Desligue se estiver
  // rodando a mesma função pelo pg_cron.
  SCHEDULER_ATIVO: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  SCHEDULER_HORA: z.coerce.number().int().min(0).max(23).default(3),
  SCHEDULER_MINUTO: z.coerce.number().int().min(0).max(59).default(10),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const detalhes = parsed.error.issues
    .map((i) => `  · ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  console.error(`Configuração inválida:\n${detalhes}\n\nVeja o .env.example.`);
  process.exit(1);
}

export const config = {
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  isProd: parsed.data.NODE_ENV === 'production',
};
