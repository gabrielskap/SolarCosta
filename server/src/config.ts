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

  // Conexão usada SÓ pelo `npm run migrate`, com o papel solarcosta_migrator
  // (ver database/03_papel_migracao.sql). O processo que atende requisição
  // nunca a utiliza — é o que mantém a conexão da API incapaz de CREATE,
  // ALTER ou DROP, mesmo diante de injeção de SQL ou bug de rota.
  //
  // Opcional para não quebrar instalação antiga: sem ela o migrate cai no
  // DATABASE_URL e, se aquele papel não tiver DDL, falha dizendo exatamente
  // isso em vez de despejar "permission denied for schema public".
  MIGRATION_DATABASE_URL: z.string().min(1).optional(),
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

  // URL pública da aplicação, com protocolo e sem barra final
  // (https://crm.solarcosta.com.br). Duas coisas dependem dela e NENHUMA
  // consegue adivinhá-la a partir de um request:
  //   · o endereço do webhook que registramos na uazapi — ela precisa saber
  //     para onde mandar a mensagem recebida, e quem conta somos nós;
  //   · o link da proposta que vai para o cliente. Montar esse link pelo
  //     Host da requisição pareceria funcionar em desenvolvimento e mandaria
  //     "http://localhost:4000/p/..." para o WhatsApp de um cliente real no
  //     dia em que alguém rodasse o envio pela máquina errada.
  APP_URL: z.string().url('APP_URL precisa ser uma URL completa.').optional(),

  // -------------------------------------------------------------- WhatsApp --
  // Integração com a uazapi (uazapiGO). Opcional pelo mesmo motivo das chaves
  // do Google: sem ela a API sobe igual e só o WhatsApp fica desligado.
  //
  // Host do SEU container uazapi, sem barra final. O free.uazapi.com serve
  // para testar o fluxo do QR e nada mais — ele apaga a instância em 1 hora.
  UAZAPI_URL: z.string().url('UAZAPI_URL precisa ser uma URL completa.').optional(),

  // Token de ADMINISTRADOR do container (header `admintoken`). Só cria e lista
  // instâncias; todo o resto usa o token da instância, que nasce do
  // /instance/create e fica cifrado no banco.
  //
  // Este token é raiz: GET /instance/all devolve o token de TODAS as
  // instâncias do container em texto puro. Nunca exponha por rota nenhuma.
  UAZAPI_ADMIN_TOKEN: z.string().min(1).optional(),

  // Chave que cifra o token da instância em SolarCosta_WhatsAppInstancia
  // (AES-256-GCM, ver services/segredos.ts). Gere com:
  //   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
  //
  // Separada do JWT_SECRET de propósito: trocar o segredo do JWT é uma
  // operação de rotina que só derruba as sessões: se ele também cifrasse este
  // token, a mesma troca desconectaria o WhatsApp da empresa sem aviso.
  WHATSAPP_CRIPTO_KEY: z.string().min(32, 'WHATSAPP_CRIPTO_KEY precisa de pelo menos 32 caracteres').optional(),

  // Rotina diária (boletos vencidos, obras atrasadas). Desligue se estiver
  // rodando a mesma função pelo pg_cron.
  SCHEDULER_ATIVO: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  SCHEDULER_HORA: z.coerce.number().int().min(0).max(23).default(3),
  SCHEDULER_MINUTO: z.coerce.number().int().min(0).max(59).default(10),
})
  // O WhatsApp é tudo ou nada: ligar pela metade dá erro no meio de um envio,
  // que é o pior lugar possível para descobrir uma variável faltando. Quem
  // não usa a integração não ganha variável obrigatória nenhuma.
  .superRefine((v, ctx) => {
    if (!v.UAZAPI_ADMIN_TOKEN) return;

    const faltando: Array<[keyof typeof v, string]> = [
      ['UAZAPI_URL', 'o endereço do seu container uazapi'],
      ['WHATSAPP_CRIPTO_KEY', 'a chave que cifra o token da instância no banco'],
      ['APP_URL', 'a URL pública, para o webhook e para o link da proposta'],
    ];

    for (const [chave, porque] of faltando) {
      if (!v[chave]) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [chave],
          message: `obrigatória quando UAZAPI_ADMIN_TOKEN está definida — ${porque}.`,
        });
      }
    }
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
  /**
   * Falso quando a integração com a uazapi não foi configurada. O superRefine
   * acima garante que, sendo verdadeiro, UAZAPI_URL, WHATSAPP_CRIPTO_KEY e
   * APP_URL também estão preenchidas — o resto do código conta com isso.
   */
  whatsappAtivo: Boolean(parsed.data.UAZAPI_ADMIN_TOKEN),
  isProd: parsed.data.NODE_ENV === 'production',
};
