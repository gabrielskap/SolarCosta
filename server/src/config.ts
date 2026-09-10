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

  // Chave de servidor do Google Maps Platform (Solar API + Geocoding).
  // Opcional de propósito: sem ela a API sobe normalmente e só o recurso de
  // telhado por satélite fica desligado — não vale derrubar o sistema inteiro
  // por causa de um extra da proposta.
  GOOGLE_MAPS_SERVER_KEY: z.string().min(1).optional(),

  // Chave de BROWSER do Google Maps Platform (Maps JavaScript API), usada só
  // pelo editor de telhado em tela cheia. É outra chave, não a de cima: o Maps
  // JS roda no navegador, e a de servidor é restrita por IP da VPS — morreria
  // aqui. Esta precisa ser restrita por REFERRER HTTP, com apenas a Maps
  // JavaScript API liberada.
  //
  // Chave de browser é pública por natureza: quem abre o mapa consegue lê-la.
  // O que a protege é a restrição de referrer e o teto de cota no Cloud
  // Console, não o sigilo. Ainda assim ela sai pelo /api/config, que exige
  // login, em vez de ir no HTML — não impede um usuário logado de copiá-la,
  // mas mantém a chave fora do alcance de quem nunca autenticou.
  //
  // Opcional pelo mesmo motivo da de servidor: sem ela o card do telhado
  // continua igual, só não abre em tela cheia.
  GOOGLE_MAPS_BROWSER_KEY: z.string().min(1).optional(),

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
  /** Falso quando GOOGLE_MAPS_SERVER_KEY não foi configurada. */
  googleMapsAtivo: Boolean(parsed.data.GOOGLE_MAPS_SERVER_KEY),
  /** Falso quando GOOGLE_MAPS_BROWSER_KEY não foi configurada. */
  googleMapsBrowserAtivo: Boolean(parsed.data.GOOGLE_MAPS_BROWSER_KEY),
  isProd: parsed.data.NODE_ENV === 'production',
};
