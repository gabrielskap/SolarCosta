// Cliente HTTP da API.
//
// Estratégia de token:
//   · access token  -> só em memória. Não vai para o localStorage, então um XSS
//                      não consegue lê-lo de um lugar previsível.
//   · refresh token -> localStorage, porque precisa sobreviver ao F5.
//
// Quando um request devolve 401, o cliente tenta renovar UMA vez e repete a
// chamada. Requests simultâneos compartilham a mesma renovação (`renovando`),
// para não disparar cinco refreshes ao mesmo tempo e invalidar uns aos outros
// pela rotação do servidor.

// Front e API rodam no mesmo container/origem em produção, então o padrão é
// caminho relativo (''). VITE_API_URL só é necessário em dev, quando o front
// (vite --port=3000) e a API (tsx watch, porta 4000) sobem separados.
const rawBaseUrl =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  (import.meta.env.DEV ? 'https://systems-solar-costa.wfuhig.easypanel.host' : '');

// Se estiver rodando em produção no navegador (não-localhost) e a URL apontar para localhost,
// força caminho relativo ('') para evitar bloqueio de CORS / chamada ao próprio computador do cliente.
const BASE_URL =
  typeof window !== 'undefined' &&
    window.location.hostname !== 'localhost' &&
    window.location.hostname !== '127.0.0.1' &&
    rawBaseUrl.includes('localhost')
    ? ''
    : rawBaseUrl
const CHAVE_REFRESH = 'solar_costa_refresh_v1';

let accessToken: string | null = null;
let renovando: Promise<boolean> | null = null;

/** Disparado quando a sessão morre de vez — o App volta para o login. */
type OuvinteSessao = () => void;
const ouvintesSessaoExpirada: OuvinteSessao[] = [];

export function aoExpirarSessao(fn: OuvinteSessao): () => void {
  ouvintesSessaoExpirada.push(fn);
  return () => {
    const i = ouvintesSessaoExpirada.indexOf(fn);
    if (i >= 0) ouvintesSessaoExpirada.splice(i, 1);
  };
}

function avisarSessaoExpirada(): void {
  for (const fn of ouvintesSessaoExpirada) fn();
}

/* ------------------------------------------------------------- tokens --- */

export function definirTokens(access: string, refresh: string): void {
  accessToken = access;
  try {
    localStorage.setItem(CHAVE_REFRESH, refresh);
  } catch {
    // Navegador com storage bloqueado: a sessão vale só até o F5.
  }
}

export function limparTokens(): void {
  accessToken = null;
  try {
    localStorage.removeItem(CHAVE_REFRESH);
  } catch {
    /* ignorado */
  }
}

export function obterRefreshToken(): string | null {
  try {
    return localStorage.getItem(CHAVE_REFRESH);
  } catch {
    return null;
  }
}

export function temSessaoSalva(): boolean {
  return obterRefreshToken() !== null;
}

/* -------------------------------------------------------------- erros --- */

export interface CampoInvalido {
  campo: string;
  mensagem: string;
}

export class ErroApi extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly codigo?: string,
    public readonly campos?: CampoInvalido[],
  ) {
    super(message);
    this.name = 'ErroApi';
  }

  /** Mensagem pronta para o toast, já com os campos inválidos anexados. */
  get mensagemCompleta(): string {
    if (!this.campos?.length) return this.message;
    return `${this.message} ${this.campos.map((c) => c.mensagem).join(' ')}`;
  }
}

/* ---------------------------------------------------------- requisição --- */

interface Opcoes {
  metodo?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  corpo?: unknown;
  /** Interno: evita laço infinito de renovação. */
  jaRenovou?: boolean;
  /** Rotas de login/refresh não mandam Authorization. */
  semAuth?: boolean;
}

async function renovarSessao(): Promise<boolean> {
  const refresh = obterRefreshToken();
  if (!refresh) return false;

  try {
    const resposta = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });

    if (!resposta.ok) {
      limparTokens();
      return false;
    }

    const dados = await resposta.json();
    definirTokens(dados.accessToken, dados.refreshToken);
    return true;
  } catch {
    return false;
  }
}

export async function requisitar<T = unknown>(caminho: string, opcoes: Opcoes = {}): Promise<T> {
  const { metodo = 'GET', corpo, jaRenovou = false, semAuth = false } = opcoes;

  const cabecalhos: Record<string, string> = {};
  if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';
  if (!semAuth && accessToken) cabecalhos.Authorization = `Bearer ${accessToken}`;

  let resposta: Response;
  try {
    resposta = await fetch(`${BASE_URL}${caminho}`, {
      method: metodo,
      headers: cabecalhos,
      ...(corpo !== undefined ? { body: JSON.stringify(corpo) } : {}),
    });
  } catch {
    throw new ErroApi(0, 'Não foi possível falar com o servidor. Verifique sua conexão.', 'offline');
  }

  // 401: tenta renovar uma vez e repete a chamada.
  if (resposta.status === 401 && !jaRenovou && !semAuth) {
    renovando ??= renovarSessao().finally(() => {
      renovando = null;
    });

    const renovou = await renovando;
    if (renovou) {
      return requisitar<T>(caminho, { ...opcoes, jaRenovou: true });
    }

    limparTokens();
    avisarSessaoExpirada();
    throw new ErroApi(401, 'Sua sessão expirou. Entre novamente.', 'sessao_expirada');
  }

  if (resposta.status === 204) return undefined as T;

  const texto = await resposta.text();
  let dados: any = null;
  if (texto) {
    try {
      dados = JSON.parse(texto);
    } catch {
      dados = null;
    }
  }

  if (!resposta.ok) {
    throw new ErroApi(
      resposta.status,
      dados?.erro ?? `Erro ${resposta.status} ao chamar a API.`,
      dados?.codigo,
      dados?.campos,
    );
  }

  return dados as T;
}

export const http = {
  get: <T>(caminho: string) => requisitar<T>(caminho),
  post: <T>(caminho: string, corpo?: unknown) => requisitar<T>(caminho, { metodo: 'POST', corpo }),
  patch: <T>(caminho: string, corpo?: unknown) => requisitar<T>(caminho, { metodo: 'PATCH', corpo }),
  put: <T>(caminho: string, corpo?: unknown) => requisitar<T>(caminho, { metodo: 'PUT', corpo }),
  delete: <T>(caminho: string) => requisitar<T>(caminho, { metodo: 'DELETE' }),
  /** Sem Authorization — login, refresh e as rotas /api/publico do site. */
  getPublico: <T>(caminho: string) => requisitar<T>(caminho, { semAuth: true }),
  postPublico: <T>(caminho: string, corpo?: unknown) =>
    requisitar<T>(caminho, { metodo: 'POST', corpo, semAuth: true }),
};
