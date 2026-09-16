// Integração com a uazapi (uazapiGO) — WhatsApp.
//
// Segunda integração externa do projeto, depois do Google (googleSolar.ts), e
// segue o mesmo desenho: `fetch` nativo, chave opcional no config, erro
// traduzido para AppError antes de sair daqui. Nenhuma rota fala com a uazapi
// direto — tudo passa por este arquivo.
//
// DOIS TOKENS, e confundi-los é o erro fácil:
//   · `admintoken` (header) — do CONTAINER. Só cria e lista instâncias. É raiz:
//     GET /instance/all devolve o token de todas as instâncias em texto puro.
//     Vem do .env e nunca sai daqui.
//   · `token` (header) — da INSTÂNCIA. Faz todo o resto, inclusive apagar a
//     própria instância. Nasce do /instance/create e vive cifrado no banco.
//
// O que esta camada NÃO faz: tocar no banco. Ela traduz HTTP em tipos nossos e
// para por aí; quem persiste é whatsapp.routes.ts. É o mesmo corte do
// googleSolar.ts, e é o que torna as duas testáveis sem Postgres.

import { config } from '../config.js';
import { AppError } from '../errors.js';

/**
 * Teto por chamada.
 *
 * O googleSolar.ts não precisa disto e este precisa: a uazapi não responde
 * sozinha, ela fala com o WhatsApp. Uma chamada pendurada seguraria um handler
 * do Express e, no caminho de envio, uma conexão do pool junto — e o pool tem
 * 10 conexões por padrão (DATABASE_POOL_MAX).
 */
const TIMEOUT_MS = 15_000;

/** Status da instância, como a uazapi os nomeia. */
export type StatusUazapi = 'disconnected' | 'connecting' | 'connected' | 'hibernated';

/** Os mesmos status, no vocabulário do nosso banco (CHECK do V009). */
export type StatusInstancia = 'desconectada' | 'conectando' | 'conectada' | 'hibernada';

const TRADUCAO_STATUS: Record<StatusUazapi, StatusInstancia> = {
  disconnected: 'desconectada',
  connecting: 'conectando',
  connected: 'conectada',
  hibernated: 'hibernada',
};

/** Status desconhecido vira 'desconectada': o único chute que não mente para o usuário. */
export function traduzirStatus(bruto: string | undefined | null): StatusInstancia {
  return TRADUCAO_STATUS[(bruto ?? '') as StatusUazapi] ?? 'desconectada';
}

export interface InstanciaUazapi {
  id: string | null;
  token: string | null;
  status: StatusInstancia;
  /** PNG em data URI, pronto para <img src>. Só existe enquanto status = conectando. */
  qrcode: string | null;
  /** Código de pareamento de 8 dígitos, alternativa ao QR. */
  paircode: string | null;
  /** Número conectado, só dígitos com DDI. Null enquanto não conectou. */
  numero: string | null;
  profileName: string | null;
}

/* ====================================================== CHAMADA BASE == */

function baseUrl(): string {
  if (!config.UAZAPI_URL) {
    throw new AppError(
      503,
      'WhatsApp indisponível: UAZAPI_URL não configurada.',
      'whatsapp_desligado',
    );
  }
  // Barra final na env é erro comum e geraria "https://host//instance/status",
  // que alguns proxies recusam antes de a uazapi ver.
  return config.UAZAPI_URL.replace(/\/+$/, '');
}

function tokenAdmin(): string {
  if (!config.UAZAPI_ADMIN_TOKEN) {
    throw new AppError(
      503,
      'WhatsApp indisponível: UAZAPI_ADMIN_TOKEN não configurada.',
      'whatsapp_desligado',
    );
  }
  return config.UAZAPI_ADMIN_TOKEN;
}

interface OpcoesChamada {
  metodo?: 'GET' | 'POST' | 'DELETE';
  corpo?: unknown;
  /** Header de autenticação. `admin` usa o token do container. */
  auth: { tipo: 'admin' } | { tipo: 'instancia'; token: string };
}

async function chamar<T>(caminho: string, opcoes: OpcoesChamada): Promise<T> {
  const { metodo = 'POST', corpo, auth } = opcoes;

  const cabecalhos: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth.tipo === 'admin') cabecalhos.admintoken = tokenAdmin();
  else cabecalhos.token = auth.token;

  let resposta: Response;
  try {
    resposta = await fetch(`${baseUrl()}${caminho}`, {
      method: metodo,
      headers: cabecalhos,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (erro) {
    // TimeoutError e falha de rede caem no mesmo lugar: do lado de fora, os
    // dois significam "a uazapi não respondeu".
    console.error(`[uazapi] ${caminho} não respondeu:`, erro instanceof Error ? erro.message : erro);
    throw new AppError(
      504,
      'O servidor de WhatsApp não respondeu. Tente novamente em instantes.',
      'whatsapp_sem_resposta',
    );
  }

  if (!resposta.ok) throw traduzirErro(resposta, await resposta.text());

  // DELETE /instance devolve corpo, mas nem todo endpoint devolve — e um
  // 200 com corpo vazio não pode virar SyntaxError no JSON.parse.
  const texto = await resposta.text();
  if (!texto) return {} as T;

  try {
    return JSON.parse(texto) as T;
  } catch {
    console.error(`[uazapi] ${caminho} devolveu corpo não-JSON:`, texto.slice(0, 300));
    throw new AppError(502, 'Resposta inesperada do servidor de WhatsApp.', 'whatsapp_resposta_invalida');
  }
}

/** Traduz o HTTP da uazapi em algo que o vendedor consiga agir a respeito. */
function traduzirErro(resposta: Response, corpo: string): AppError {
  console.error(`[uazapi] ${resposta.status}`, corpo.slice(0, 400));

  // A uazapi responde {error: "..."} na maioria das recusas.
  let detalhe = '';
  try {
    const j = JSON.parse(corpo) as { error?: string; message?: string; response?: string };
    detalhe = j.error ?? j.message ?? j.response ?? '';
  } catch {
    /* corpo não-JSON: o log acima já guardou o texto cru */
  }

  switch (resposta.status) {
    case 401:
    case 403:
      return new AppError(
        502,
        'O servidor de WhatsApp recusou nossas credenciais. Confira UAZAPI_ADMIN_TOKEN, ou reconecte o número.',
        'whatsapp_credencial_recusada',
      );

    case 404:
      // Instância apagada do lado de lá — acontece com o container gratuito,
      // que derruba e remove a instância depois de uma hora.
      return new AppError(
        404,
        'Instância não encontrada no servidor de WhatsApp. Conecte o número novamente.',
        'whatsapp_instancia_sumiu',
      );

    case 429:
      return new AppError(
        429,
        'O servidor de WhatsApp está limitando as chamadas. Aguarde alguns minutos antes de tentar de novo.',
        'whatsapp_limite',
      );

    case 503:
      return new AppError(
        503,
        'O servidor de WhatsApp está sem capacidade no momento. Tente novamente em instantes.',
        'whatsapp_sem_capacidade',
      );

    default:
      return new AppError(
        502,
        `Falha no servidor de WhatsApp${detalhe ? `: ${detalhe}` : '.'}`,
        'whatsapp_falhou',
      );
  }
}

/* ================================================== FORMA DA RESPOSTA == */

/**
 * O que lemos do objeto `instance` da uazapi.
 *
 * Ele traz bem mais do que isto — inclusive `token` e `openai_apikey`, que é
 * exatamente por que ele NUNCA é repassado cru para o navegador; o que sai
 * daqui é o InstanciaUazapi acima, montado campo a campo.
 *
 * `plataform` está escrito assim no contrato da API deles. Não é erro de
 * digitação nosso, e corrigir aqui só faria o campo vir undefined.
 */
interface InstanceBruta {
  id?: string;
  token?: string;
  status?: string;
  qrcode?: string;
  paircode?: string;
  profileName?: string;
  plataform?: string;
}

interface RespostaInstancia {
  instance?: InstanceBruta;
  token?: string;
  connected?: boolean;
  loggedIn?: boolean;
  status?: {
    connected?: boolean;
    loggedIn?: boolean;
    jid?: { user?: string; server?: string };
  };
}

function normalizar(r: RespostaInstancia): InstanciaUazapi {
  const i = r.instance ?? {};

  // O status vem no objeto `instance`; `connected` no nível de cima é o
  // booleano equivalente e serve de desempate quando o primeiro falta.
  const statusBruto = i.status ?? (r.status?.connected ?? r.connected ? 'connected' : undefined);

  return {
    id: i.id ?? null,
    // Na prática só o /instance/create devolve token; nas outras respostas
    // fica null, e quem grava trata null como "não mexe no que já está lá".
    // Preencher aqui com o token que o chamador já tem faria a rota recifrá-lo
    // (IV novo, escrita nova) a cada volta do laço de QR, de 3 em 3 segundos.
    token: i.token ?? r.token ?? null,
    status: traduzirStatus(statusBruto),
    // String vazia é o que a uazapi manda quando não há QR pendente; virar
    // null aqui evita um <img src=""> na tela.
    qrcode: i.qrcode || null,
    paircode: i.paircode || null,
    numero: r.status?.jid?.user ?? null,
    profileName: i.profileName ?? null,
  };
}

/* ========================================================= INSTÂNCIA == */

/**
 * Cria a instância no container. Devolve o token que ela usará daqui para a
 * frente — é a ÚNICA vez que ele aparece, então quem chama tem que persistir.
 */
export async function criarInstancia(nome: string): Promise<InstanciaUazapi> {
  const r = await chamar<RespostaInstancia>('/instance/create', {
    auth: { tipo: 'admin' },
    corpo: { name: nome },
  });

  const instancia = normalizar(r);
  if (!instancia.token) {
    console.error('[uazapi] /instance/create não devolveu token', JSON.stringify(r).slice(0, 300));
    throw new AppError(
      502,
      'O servidor de WhatsApp criou a instância mas não devolveu o token de acesso.',
      'whatsapp_sem_token',
    );
  }
  return instancia;
}

/**
 * Inicia o pareamento e devolve o QR code.
 *
 * Sem `phone` no corpo a uazapi devolve QR; com `phone`, devolve código de
 * pareamento. O QR expira em 2 minutos (o pareamento, em 5) — a tela mostra o
 * contador e chama de novo, em vez de deixar o cliente escanear algo morto.
 *
 * `proxy_managed_country: 'br'` sai da saída de rede por uma região brasileira.
 * A própria uazapi registra que isso reduz o alerta de "conexão suspeita" do
 * WhatsApp, que é o caminho comum para restrição e banimento. O Brasil é o
 * único país que eles suportam hoje, o que por acaso é o nosso caso.
 */
export async function conectar(token: string, nomeSistema: string): Promise<InstanciaUazapi> {
  const r = await chamar<RespostaInstancia>('/instance/connect', {
    auth: { tipo: 'instancia', token },
    corpo: { systemName: nomeSistema, proxy_managed_country: 'br' },
  });
  return normalizar(r);
}

/**
 * Status atual — e, durante o pareamento, o QR **renovado**.
 *
 * É esta rota que a tela consulta em laço enquanto o QR está na frente do
 * usuário, e não o /instance/connect de novo: chamar connect outra vez
 * reinicia o pareamento e invalida o código que a pessoa está escaneando.
 */
export async function statusInstancia(token: string): Promise<InstanciaUazapi> {
  const r = await chamar<RespostaInstancia>('/instance/status', {
    metodo: 'GET',
    auth: { tipo: 'instancia', token },
  });
  return normalizar(r);
}

/** Logout: derruba a sessão do WhatsApp. Reconectar exige QR novo. */
export async function desconectar(token: string): Promise<void> {
  await chamar('/instance/disconnect', { auth: { tipo: 'instancia', token } });
}

/* =========================================================== WEBHOOK == */

/**
 * Registra (ou atualiza) o webhook da instância.
 *
 * Omitir `action` e `id` é o modo simples documentado: a uazapi cria se não
 * existir e atualiza se existir, então chamar a cada conexão é seguro e evita
 * ficar com dois webhooks apontando para URLs antigas.
 *
 * `excludeMessages: ['wasSentByApi']` é obrigatório na prática: sem ele, toda
 * mensagem que NÓS enviamos volta como evento recebido. A documentação da
 * uazapi avisa duas vezes sobre o laço que isso cria. Não perdemos nada — a
 * mensagem enviada já é gravada no envio, e a confirmação de entrega chega
 * pelo `messages_update`, que este filtro não afeta.
 */
export async function configurarWebhook(token: string, url: string): Promise<void> {
  await chamar('/webhook', {
    auth: { tipo: 'instancia', token },
    corpo: {
      enabled: true,
      url,
      events: ['messages', 'messages_update', 'connection'],
      excludeMessages: ['wasSentByApi'],
    },
  });
}

/* ============================================================= ENVIO == */

export interface MensagemEnviada {
  /** Id da mensagem no WhatsApp. É a chave de idempotência do webhook. */
  messageid: string | null;
  /** Status como a uazapi devolve: Queued, Sent, Delivered, Read, Failed… */
  status: string | null;
}

/** Os status da uazapi vêm capitalizados; o CHECK do V009 espera os nossos. */
const TRADUCAO_ENVIO: Record<string, string> = {
  Queued: 'fila',
  Sent: 'enviada',
  Delivered: 'entregue',
  Read: 'lida',
  Failed: 'falhou',
  Canceled: 'cancelada',
};

/**
 * Traduz o status de uma mensagem. Desconhecido vira 'enviada': a uazapi
 * aceitou a chamada, então a mensagem saiu — inventar 'falhou' aqui mostraria
 * erro para um envio que deu certo.
 */
export function traduzirStatusMensagem(bruto: string | null | undefined): string {
  return TRADUCAO_ENVIO[bruto ?? ''] ?? 'enviada';
}

interface RespostaMensagem {
  messageid?: string;
  id?: string;
  status?: string;
  error?: string;
}

/**
 * Manda uma mensagem de texto.
 *
 * `delay` não é atraso técnico: a uazapi mostra "digitando…" durante ele. Uma
 * conta que dispara mensagens instantâneas em sequência tem cara de robô, e
 * banimento é a forma mais cara de falha nesta integração — recuperar um
 * número banido é processo, não conserto. O valor sai sorteado para que a
 * cadência não fique uniforme.
 *
 * `linkPreview` fica LIGADO porque toda proposta vai com link: a prévia mostra
 * ao cliente que o endereço é da empresa, em vez de uma URL crua que parece
 * golpe.
 */
export async function enviarTexto(
  token: string,
  numero: string,
  texto: string,
): Promise<MensagemEnviada> {
  const delay = 1000 + Math.floor(Math.random() * 2000);

  const r = await chamar<RespostaMensagem>('/send/text', {
    auth: { tipo: 'instancia', token },
    corpo: { number: numero, text: texto, linkPreview: true, delay },
  });

  return { messageid: r.messageid ?? r.id ?? null, status: r.status ?? null };
}

/**
 * Confere quais números existem no WhatsApp.
 *
 * Chamado antes de enviar. O motivo é concreto: a uazapi aceita a chamada para
 * um número inexistente e devolve 200, então sem esta conferência o vendedor
 * veria "proposta enviada" para um telefone digitado errado e ficaria
 * esperando uma resposta que nunca vem.
 */
export async function numeroExiste(token: string, numero: string): Promise<boolean> {
  const r = await chamar<Array<{ query?: string; isInWhatsapp?: boolean }>>('/chat/check', {
    auth: { tipo: 'instancia', token },
    corpo: { numbers: [numero] },
  });

  // Resposta fora do formato esperado NÃO bloqueia o envio: esta checagem é
  // uma cortesia, e transformá-la em porteiro faria uma mudança de contrato
  // do lado deles derrubar o envio inteiro.
  if (!Array.isArray(r) || r.length === 0) return true;
  return r[0]?.isInWhatsapp !== false;
}
