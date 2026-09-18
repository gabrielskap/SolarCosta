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
  /** Sobrescreve o TIMEOUT_MS padrão. Só quem sobe arquivo precisa disto. */
  timeoutMs?: number;
}

async function chamar<T>(caminho: string, opcoes: OpcoesChamada): Promise<T> {
  const { metodo = 'POST', corpo, auth, timeoutMs = TIMEOUT_MS } = opcoes;

  const cabecalhos: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth.tipo === 'admin') cabecalhos.admintoken = tokenAdmin();
  else cabecalhos.token = auth.token;

  let resposta: Response;
  try {
    resposta = await fetch(`${baseUrl()}${caminho}`, {
      method: metodo,
      headers: cabecalhos,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: AbortSignal.timeout(timeoutMs),
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

    // 400 e 415 ganham código próprio por um motivo prático, não estético: os
    // dois significam que a requisição foi RECUSADA NA PORTA — nada saiu para
    // o cliente. É isso que torna seguro o reenvio do /send/media em outro
    // formato de arquivo (ver enviarDocumento). Confundi-los com o 502 genérico
    // transformaria esse reenvio numa chance de mandar a mesma mensagem duas
    // vezes.
    case 400:
      return new AppError(
        422,
        detalhe || 'O servidor de WhatsApp recusou os dados da mensagem.',
        'whatsapp_requisicao_invalida',
      );

    case 415:
      return new AppError(
        422,
        detalhe || 'O servidor de WhatsApp recusou o formato do arquivo.',
        'whatsapp_midia_recusada',
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
 * Manda um documento (PDF) com legenda.
 *
 * `/send/media` com `type: 'document'`. O arquivo vai em BASE64, e não como
 * URL, de propósito: uma URL obrigaria a expor o PDF num endereço público que
 * o servidor da uazapi conseguisse buscar — mais uma rota sem login servindo
 * documento de cliente, para economizar um upload que leva menos de um segundo.
 *
 * `docName` é o que o cliente vê no WhatsApp; sem ele o arquivo chega com um
 * nome gerado, do tipo `document.pdf`, e a proposta perde o número.
 *
 * O `text` é a LEGENDA do anexo. No WhatsApp o documento e a legenda são uma
 * mensagem só — não são duas, e por isso o caminho de envio não manda um texto
 * antes do arquivo.
 *
 * A DOCUMENTAÇÃO NÃO DIZ QUAL DOS DOIS BASE64 ELA QUER — só "URL ou base64 do
 * arquivo". Em vez de escolher um e torcer, esta função tenta o cru e, se for
 * recusada NA PORTA (400/415, quando nada saiu), repete uma vez com data URI.
 * A primeira forma que funcionar fica memorizada no processo, então o custo da
 * dúvida é uma requisição perdida por boot, e só na primeira vez.
 *
 * O reenvio só é seguro por causa dos códigos que o traduzirErro separa acima:
 * 400 e 415 são recusa antes do envio. Qualquer outro erro sobe direto, porque
 * "não sei se saiu" nunca pode virar "manda de novo".
 */
type FormatoArquivo = 'base64' | 'dataUri';
let formatoQueFunciona: FormatoArquivo | null = null;

export async function enviarDocumento(
  token: string,
  numero: string,
  base64: string,
  nomeArquivo: string,
  legenda: string,
): Promise<MensagemEnviada> {
  const delay = 1000 + Math.floor(Math.random() * 2000);

  const tentar = async (formato: FormatoArquivo): Promise<MensagemEnviada> => {
    const r = await chamar<RespostaMensagem>('/send/media', {
      auth: { tipo: 'instancia', token },
      corpo: {
        number: numero,
        type: 'document',
        file: formato === 'dataUri' ? `data:application/pdf;base64,${base64}` : base64,
        docName: nomeArquivo,
        mimetype: 'application/pdf',
        ...(legenda ? { text: legenda } : {}),
        delay,
      },
      // Sobe um arquivo, não um JSON de duas linhas: o timeout curto das outras
      // chamadas cortaria uma proposta com imagem de satélite em rede ruim.
      timeoutMs: TIMEOUT_MIDIA_MS,
    });
    return { messageid: r.messageid ?? r.id ?? null, status: r.status ?? null };
  };

  const ordem: FormatoArquivo[] = formatoQueFunciona
    ? [formatoQueFunciona]
    : ['base64', 'dataUri'];

  let ultimoErro: unknown;
  for (const formato of ordem) {
    try {
      const enviada = await tentar(formato);
      if (formatoQueFunciona !== formato) {
        console.log(`[uazapi] /send/media aceita o arquivo como ${formato}`);
        formatoQueFunciona = formato;
      }
      return enviada;
    } catch (e) {
      const recusaNaPorta =
        e instanceof AppError &&
        (e.codigo === 'whatsapp_midia_recusada' || e.codigo === 'whatsapp_requisicao_invalida');
      if (!recusaNaPorta) throw e;
      console.warn(`[uazapi] /send/media recusou o arquivo como ${formato}; tentando o outro formato`);
      ultimoErro = e;
    }
  }

  throw ultimoErro;
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

/* ============================================================= MÍDIA == */

/**
 * Teto do arquivo recebido: 16 MB.
 *
 * O WhatsApp já limita anexo comum a 16 MB, então este teto recusa pouca coisa
 * legítima. Ele existe porque os bytes vão para uma coluna `bytea` e passam
 * inteiros pela memória do processo — sem limite, um vídeo grande derruba a API
 * para todo mundo.
 */
export const TETO_MIDIA_BYTES = 16 * 1024 * 1024;

/**
 * Mais folgado que o TIMEOUT_MS das outras chamadas.
 *
 * As demais falam com a uazapi e voltam; esta transfere um arquivo, e 15 s
 * cortariam um áudio de celular em rede ruim.
 */
const TIMEOUT_MIDIA_MS = 30_000;

export interface MidiaBaixada {
  bytes: Buffer;
  mimeType: string;
  nomeArquivo: string;
}

/**
 * Falha ao trazer um anexo.
 *
 * Classe própria, e não AppError, porque isto NÃO é erro de requisição: o
 * download roda depois de o webhook já ter respondido 200. O destino desta
 * mensagem é a coluna `erro` da mensagem, para a thread explicar por que o
 * arquivo não abriu.
 */
export class FalhaMidia extends Error {}

/**
 * ===================== POR QUE EXISTE UMA LISTA DE HOSTS =====================
 *
 * A URL do anexo vem DENTRO do corpo do webhook, ou seja, de um POST anônimo da
 * internet. Buscar cegamente o que chega ali transformaria a nossa API num
 * proxy: `http://169.254.169.254/latest/meta-data/` (credencial da nuvem),
 * `http://postgres:5432` na rede interna do Easypanel, `http://localhost:4000`
 * — e o resultado ainda seria GRAVADO no banco e servido de volta pela rota de
 * mídia. É SSRF com exfiltração, e o fato de exigir o segredo do webhook não
 * muda o desenho: defesa em profundidade é o que sobra quando o segredo vaza.
 *
 * Então só três origens são aceitas: o host da própria UAZAPI_URL, `*.uazapi.com`
 * e `*.whatsapp.net` (o CDN de mídia do WhatsApp).
 */
function hostPermitido(url: URL): boolean {
  if (url.protocol !== 'https:') return false;

  const host = url.hostname.toLowerCase();

  // IP literal nunca: é a forma mais direta de alcançar a rede interna, e
  // nenhum dos hosts legítimos é numérico.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(':')) return false;

  let hostUazapi = '';
  try {
    hostUazapi = new URL(baseUrl()).hostname.toLowerCase();
  } catch {
    /* UAZAPI_URL inválida: sobram os dois domínios fixos abaixo */
  }

  return (
    (hostUazapi !== '' && host === hostUazapi) ||
    host === 'uazapi.com' || host.endsWith('.uazapi.com') ||
    host === 'whatsapp.net' || host.endsWith('.whatsapp.net')
  );
}

/** A URL, validada, ou `null` quando não serve. */
function urlDeMidia(bruta: string): URL | null {
  let url: URL;
  try {
    url = new URL(bruta);
  } catch {
    return null;
  }
  return hostPermitido(url) ? url : null;
}

/**
 * Lê o corpo cortando no teto, em vez de carregar tudo e medir depois.
 *
 * `content-length` é conferido antes por ser barato, mas não dá para confiar
 * nele: é cabeçalho opcional, e um servidor que o omita (ou minta) passaria
 * direto. O corte no fluxo é o que realmente segura.
 *
 * `redirect: 'manual'` porque seguir redirecionamento automaticamente anularia
 * a lista de hosts: bastaria a uazapi (ou quem falsificasse o webhook) apontar
 * para um 302 em direção à rede interna. O Location é revalidado e seguido no
 * máximo uma vez.
 *
 * O header `token` só vai quando o host é o da própria uazapi. Mandá-lo para o
 * CDN do WhatsApp entregaria a credencial que envia mensagem no nome da
 * empresa a um terceiro que não precisa dela.
 */
async function baixarBytes(url: URL, token: string, saltos = 1): Promise<MidiaBaixada> {
  const cabecalhos: Record<string, string> = {};
  let hostUazapi = '';
  try {
    hostUazapi = new URL(baseUrl()).hostname.toLowerCase();
  } catch {
    /* sem UAZAPI_URL válida não há a quem mandar o token */
  }
  if (hostUazapi && url.hostname.toLowerCase() === hostUazapi) cabecalhos.token = token;

  let resposta: Response;
  try {
    resposta = await fetch(url, {
      headers: cabecalhos,
      redirect: 'manual',
      signal: AbortSignal.timeout(TIMEOUT_MIDIA_MS),
    });
  } catch (erro) {
    throw new FalhaMidia(
      `não foi possível baixar o arquivo (${erro instanceof Error ? erro.message : String(erro)})`,
    );
  }

  if (resposta.status >= 300 && resposta.status < 400) {
    const destino = resposta.headers.get('location');
    if (!destino || saltos <= 0) throw new FalhaMidia('o arquivo redirecionou para lugar nenhum');

    const proxima = urlDeMidia(new URL(destino, url).toString());
    if (!proxima) throw new FalhaMidia('o arquivo redirecionou para um endereço não permitido');

    return baixarBytes(proxima, token, saltos - 1);
  }

  if (!resposta.ok) throw new FalhaMidia(`o servidor devolveu ${resposta.status} para o arquivo`);

  const anunciado = Number(resposta.headers.get('content-length'));
  if (Number.isFinite(anunciado) && anunciado > TETO_MIDIA_BYTES) {
    throw new FalhaMidia('arquivo acima do limite de 16 MB');
  }

  const pedacos: Uint8Array[] = [];
  let total = 0;

  if (resposta.body) {
    const leitor = resposta.body.getReader();
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      total += value.byteLength;
      if (total > TETO_MIDIA_BYTES) {
        // Cancelar fecha a conexão em vez de continuar recebendo bytes que já
        // decidimos jogar fora.
        await leitor.cancel().catch(() => {});
        throw new FalhaMidia('arquivo acima do limite de 16 MB');
      }
      pedacos.push(value);
    }
  }

  if (total === 0) throw new FalhaMidia('o arquivo veio vazio');

  return {
    bytes: Buffer.concat(pedacos),
    mimeType: resposta.headers.get('content-type') ?? 'application/octet-stream',
    nomeArquivo: '',
  };
}

interface RespostaDownload {
  fileURL?: string;
  fileUrl?: string;
  file?: string;
  url?: string;
  mimetype?: string;
  mimeType?: string;
  fileName?: string;
}

/**
 * Traz os bytes de um anexo recebido.
 *
 * POR QUE COPIAR EM VEZ DE LINKAR: a uazapi apaga mídia depois de 2 dias e o
 * endereço que ela devolve morre junto. A foto do padrão do telhado que o
 * cliente mandou em março precisa abrir em dezembro.
 *
 * DOIS CAMINHOS, e o primeiro que servir vence:
 *   1. a URL que veio no próprio evento, quando veio e quando passa pela lista
 *      de hosts;
 *   2. `POST /message/download` com o id da mensagem, que devolve o endereço —
 *      e esse endereço passa pela MESMA validação.
 *
 * PRECISA CONFIRMAÇÃO EMPÍRICA: nem o nome do campo de URL no evento nem o
 * formato da resposta do /message/download estão publicados. O corpo manda
 * `id` e `messageid` juntos porque campo a mais é inofensivo e dobra a chance
 * de acertar de primeira. O primeiro anexo real que chegar diz qual caminho
 * funciona, e aí isto pode encolher.
 */
export async function baixarMidia(
  token: string,
  alvo: {
    url: string | null;
    mensagemId: string;
    mimeType: string | null;
    nomeArquivo: string | null;
  },
): Promise<MidiaBaixada> {
  let url = alvo.url ? urlDeMidia(alvo.url) : null;
  let mimeDaApi = alvo.mimeType;
  let nomeDaApi = alvo.nomeArquivo;

  if (alvo.url && !url) {
    console.warn(`[uazapi] URL de mídia recusada pela lista de hosts: ${alvo.url.slice(0, 200)}`);
  }

  if (!url) {
    let r: RespostaDownload;
    try {
      r = await chamar<RespostaDownload>('/message/download', {
        auth: { tipo: 'instancia', token },
        corpo: { id: alvo.mensagemId, messageid: alvo.mensagemId },
      });
    } catch (erro) {
      // AppError daqui não pode subir como erro de rota: mídia que não baixa é
      // um aviso na thread, não uma falha de requisição.
      throw new FalhaMidia(erro instanceof Error ? erro.message : String(erro));
    }

    const bruta = r.fileURL ?? r.fileUrl ?? r.url ?? r.file ?? null;
    mimeDaApi = mimeDaApi ?? r.mimetype ?? r.mimeType ?? null;
    nomeDaApi = nomeDaApi ?? r.fileName ?? null;

    url = bruta ? urlDeMidia(bruta) : null;
    if (!url) {
      console.error('[uazapi] /message/download sem URL utilizável', JSON.stringify(r).slice(0, 300));
      throw new FalhaMidia('o servidor de WhatsApp não informou onde baixar o arquivo');
    }
  }

  const baixado = await baixarBytes(url, token);

  // O mime que a uazapi informou vence o `content-type`: um CDN devolvendo
  // `application/octet-stream` transformaria a foto em download em vez de
  // imagem na tela.
  const mimeType = mimeDaApi ?? baixado.mimeType;

  return {
    bytes: baixado.bytes,
    mimeType,
    nomeArquivo: nomeDaApi ?? nomeProvavel(mimeType),
  };
}

/**
 * Nome para quando a uazapi não mandar nenhum.
 *
 * Foto e áudio de WhatsApp normalmente chegam sem nome — o aparelho não dá um.
 * "arquivo" puro, sem extensão, faria o navegador do vendedor não saber com o
 * que abrir depois de salvar.
 */
function nomeProvavel(mime: string): string {
  const extensao = mime.split('/')[1]?.split(';')[0]?.replace(/[^a-z0-9]/gi, '') || 'bin';
  return `arquivo.${extensao}`;
}

