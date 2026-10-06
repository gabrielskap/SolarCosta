// OAuth2 (client_credentials) para as APIs do Banco do Brasil.
//
// Mesmo desenho do uazapi.ts: `fetch` nativo, config opcional, erro traduzido
// para AppError antes de sair daqui. A diferença é que aqui não existe token
// por registro — é UM token por aplicação, reaproveitado até expirar. Guardar
// em memória (e não cifrado no banco, como o token da instância uazapi) porque
// ele nasce de client_id/client_secret que já estão no .env: persistir seria
// duplicar um segredo que já vive em outro lugar, sem ganhar nada em troca — a
// pior consequência de perdê-lo com o restart da API é pedir um novo, o que já
// é exatamente o que este módulo faz.

import { config } from '../../config.js';
import { AppError } from '../../errors.js';

function urlToken(): string {
  return config.BB_AMBIENTE === 'producao'
    ? 'https://oauth.bb.com.br/oauth/token'
    : 'https://oauth.hm.bb.com.br/oauth/token';
}

function credenciais(): { clientId: string; clientSecret: string } {
  if (!config.BB_CLIENT_ID || !config.BB_CLIENT_SECRET) {
    throw new AppError(
      503,
      'Integração com o Banco do Brasil indisponível: BB_CLIENT_ID/BB_CLIENT_SECRET não configuradas.',
      'bb_desligado',
    );
  }
  return { clientId: config.BB_CLIENT_ID, clientSecret: config.BB_CLIENT_SECRET };
}

interface TokenCache {
  valor: string;
  expiraEm: number; // epoch ms
}

// Um cache POR SCOPE, não um token único: o BB amarra o access_token aos
// escopos pedidos no /token (ver guia Segurança > Parâmetro scope), e cada
// API do BB (Cobranças, Pix, Extratos...) tem os seus. Reutilizar o token de
// uma API para chamar outra falharia por permissão, não por autenticação.
const cache = new Map<string, TokenCache>();

/** Margem antes do vencimento real, para nunca sair com um token que expira no meio do request. */
const MARGEM_MS = 30_000;
const TIMEOUT_MS = 15_000;

interface RespostaToken {
  access_token: string;
  expires_in: number; // segundos
}

/**
 * Devolve um access_token válido para o(s) escopo(s) informados, renovando via
 * client_credentials quando necessário. NÃO gera um token novo por chamada —
 * reutiliza enquanto o cache estiver dentro da validade.
 *
 * `scope`: lista separada por espaço, EXATAMENTE como documentado para a API
 * (ex.: 'cobrancas.boletos-requisicao cobrancas.boletos-info'). O BB rejeita
 * a requisição com `invalid_scope` se vier vazio ou com um escopo que a
 * aplicação não tem autorização para pedir — não é opcional, mesmo que o
 * endpoint OAuth não distinga isso de "não autenticado".
 */
export async function obterToken(scope: string): Promise<string> {
  const cacheado = cache.get(scope);
  if (cacheado && cacheado.expiraEm > Date.now()) return cacheado.valor;

  const { clientId, clientSecret } = credenciais();
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  let resposta: Response;
  try {
    resposta = await fetch(urlToken(), {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope }),
      signal: controlador.signal,
    });
  } catch (erro) {
    if (erro instanceof Error && erro.name === 'AbortError') {
      throw new AppError(504, 'O Banco do Brasil não respondeu à autenticação a tempo.', 'bb_timeout');
    }
    throw new AppError(502, 'Não foi possível contatar o Banco do Brasil para autenticar.', 'bb_indisponivel');
  } finally {
    clearTimeout(timeout);
  }

  if (!resposta.ok) {
    console.error(`[bb/auth] token recusado: ${resposta.status} ${await resposta.text().catch(() => '')}`);
    throw new AppError(502, 'O Banco do Brasil recusou as credenciais da aplicação.', 'bb_credenciais_invalidas');
  }

  const corpo = (await resposta.json()) as RespostaToken;
  cache.set(scope, {
    valor: corpo.access_token,
    expiraEm: Date.now() + corpo.expires_in * 1000 - MARGEM_MS,
  });
  return corpo.access_token;
}
