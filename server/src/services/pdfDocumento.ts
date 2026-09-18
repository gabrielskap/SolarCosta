// A proposta (ou o contrato) virando bytes de PDF.
//
// POR QUE ISTO EXISTE, depois de o projeto ter recusado Chromium uma vez:
// até aqui o cliente recebia um LINK, porque o PDF não existia como arquivo —
// o documento é React (src/components/PDFModal.tsx) e virava papel por
// window.print(). O link dava contagem de abertura e revogação de graça. Mas
// link não é o que o cliente guarda, reencaminha para o cônjuge nem leva ao
// banco para financiar, e foi isso que se pediu.
//
// COMO, SEM DESENHAR O DOCUMENTO DUAS VEZES: em vez de reconstruir o layout
// numa biblioteca de PDF — que drift[ar]ia do PDFModal no primeiro ajuste de
// margem —, abrimos a PRÓPRIA PÁGINA PÚBLICA (/p/<token>) num Chromium e
// mandamos imprimir. O CSS de impressão já existe e já está afinado: o
// `@page { size: A4; margin: 12mm }` e o zoom de 0,784 que encaixa a folha de
// 896px em 186mm estão em src/index.css desde antes disto. Por isso o
// `preferCSSPageSize` abaixo é obrigatório e não uma preferência: sem ele o
// Puppeteer impõe Letter com margem zero e joga fora esse ajuste.
//
// O CUSTO, declarado: a imagem cresce ~300 MB e cada impressão segura uns
// 200–300 MB de RAM por alguns segundos. Daí as três defesas: uma impressão
// por vez, navegador desligado quando ocioso, e cache curto para o caso comum
// de mandar a mesma proposta para três pessoas seguidas.

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { launch, type Browser } from 'puppeteer-core';
import { config } from '../config.js';
import { AppError } from '../errors.js';
import { cabecalhosDeRender } from './renderInterno.js';

/**
 * Onde procurar o navegador quando CHROMIUM_PATH não foi preenchida.
 *
 * O primeiro da lista é o do container (pacote `chromium` do Alpine, instalado
 * pelo Dockerfile), então em produção a sondagem acerta de primeira e não custa
 * nada. Os demais existem para que a máquina de quem desenvolve funcione sem
 * configuração — foi justamente o padrão fixo do Alpine que fez o primeiro
 * envio local morrer com "Confira CHROMIUM_PATH".
 *
 * O Edge entra na lista porque é Chromium e vem instalado em todo Windows: numa
 * máquina sem Chrome, ele é a diferença entre funcionar e não funcionar.
 */
function candidatosDeNavegador(): string[] {
  const linux = [
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
  ];
  const windows = [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    `${process.env.LOCALAPPDATA ?? ''}/Google/Chrome/Application/chrome.exe`,
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ];
  const mac = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  ];

  if (process.platform === 'win32') return [...windows, ...linux];
  if (process.platform === 'darwin') return [...mac, ...linux];
  return [...linux, ...mac];
}

/** Memoizado: a sondagem é barata, mas repeti-la a cada envio é ruído no disco. */
let caminhoResolvido: string | null = null;

function acharNavegador(): string {
  if (caminhoResolvido) return caminhoResolvido;

  // Caminho explícito manda: quem preencheu a variável quer AQUELE binário, e
  // cair num outro silenciosamente esconderia o erro de digitação.
  if (config.CHROMIUM_PATH) {
    if (!existsSync(config.CHROMIUM_PATH)) {
      throw new AppError(
        503,
        'O navegador que gera o PDF não foi encontrado no caminho configurado. Confira CHROMIUM_PATH no servidor.',
        'pdf_sem_navegador',
      );
    }
    caminhoResolvido = config.CHROMIUM_PATH;
    return caminhoResolvido;
  }

  const tentados = candidatosDeNavegador();
  const achado = tentados.find((c) => c && existsSync(c));
  if (!achado) {
    console.error(
      '[pdf] nenhum navegador encontrado. Caminhos tentados:\n  ' + tentados.join('\n  '),
    );
    throw new AppError(
      503,
      'Nenhum navegador para gerar o PDF foi encontrado no servidor. Instale o Chrome/Chromium ou defina CHROMIUM_PATH.',
      'pdf_sem_navegador',
    );
  }

  console.log(`[pdf] navegador encontrado em ${achado}`);
  caminhoResolvido = achado;
  return achado;
}

/** Tempo sem uso até desligar o navegador e devolver a memória à VPS. */
const OCIOSO_MS = 2 * 60_000;

/** Teto da geração inteira: carregar a página, esperar as fontes e imprimir. */
const TIMEOUT_MS = 45_000;

/**
 * Cache do PDF por documento.
 *
 * O caso que ele resolve é o da tela: mandar a mesma proposta para o cliente e
 * para o cônjuge são duas chamadas a /enviar, e sem cache seriam duas
 * impressões completas — dois Chromium acordando, seis segundos de espera e o
 * dobro de memória, para produzir bytes idênticos.
 *
 * TTL curto de propósito: proposta editada precisa sair atualizada, e cinco
 * minutos é mais do que qualquer sequência de envios e menos do que qualquer
 * sessão de edição.
 */
const CACHE_MS = 5 * 60_000;
const CACHE_MAX = 6;

/** O pedaço de `window` que a impressão usa, já que aqui não há lib DOM. */
interface JanelaDoDocumento {
  document: { fonts: { ready: Promise<unknown> } };
}

interface PdfGerado {
  bytes: Buffer;
  nomeArquivo: string;
  /** SHA-256 dos bytes — serve de dedupe e de identificador no log. */
  hash: string;
}

const cache = new Map<string, { em: number; pdf: PdfGerado }>();

let navegador: Browser | null = null;
let desligarEm: NodeJS.Timeout | null = null;
/** Fila de um: a próxima impressão espera a anterior terminar. */
let vez: Promise<unknown> = Promise.resolve();

function adiarDesligamento(): void {
  if (desligarEm) clearTimeout(desligarEm);
  desligarEm = setTimeout(() => {
    void fecharNavegador();
  }, OCIOSO_MS);
  // Um timer pendente não deve segurar o processo no ar no encerramento.
  desligarEm.unref();
}

export async function fecharNavegador(): Promise<void> {
  if (desligarEm) {
    clearTimeout(desligarEm);
    desligarEm = null;
  }
  const atual = navegador;
  navegador = null;
  if (!atual) return;
  try {
    await atual.close();
    console.log('[pdf] navegador desligado por ociosidade');
  } catch (e) {
    console.warn('[pdf] falha ao desligar o navegador:', e instanceof Error ? e.message : e);
  }
}

async function obterNavegador(): Promise<Browser> {
  if (navegador?.connected) {
    adiarDesligamento();
    return navegador;
  }

  const executavel = acharNavegador();

  try {
    navegador = await launch({
      executablePath: executavel,
      args: [
        // O container roda como USER node. O sandbox do Chromium precisa de
        // capabilities que um processo não-root não tem, e concedê-las seria
        // abrir mais do que se fecha: aqui o navegador só abre uma URL nossa,
        // em loopback, com conteúdo que a nossa própria API serviu.
        '--no-sandbox',
        '--disable-setuid-sandbox',
        // /dev/shm do Docker tem 64 MB por padrão; sem isto o Chromium trava
        // ao renderizar página com imagem grande — e a proposta tem satélite.
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--hide-scrollbars',
      ],
    });
  } catch (e) {
    // O caminho configurado vai para o LOG, não para a resposta: é quase sempre
    // ele o culpado num ambiente novo, mas expor caminho de sistema ao
    // navegador não ajuda quem está do outro lado da tela.
    console.error(
      `[pdf] não foi possível iniciar o navegador em ${executavel}:`,
      e instanceof Error ? e.message : e,
    );
    throw new AppError(
      503,
      'Não foi possível abrir o navegador que gera o PDF. Confira CHROMIUM_PATH no servidor.',
      'pdf_sem_navegador',
    );
  }

  console.log('[pdf] navegador iniciado');
  adiarDesligamento();
  return navegador;
}

function chaveDe(tipo: 'proposta' | 'contrato', id: string): string {
  return `${tipo}:${id}`;
}

function doCache(chave: string): PdfGerado | null {
  const linha = cache.get(chave);
  if (!linha) return null;
  if (Date.now() - linha.em > CACHE_MS) {
    cache.delete(chave);
    return null;
  }
  return linha.pdf;
}

function guardarNoCache(chave: string, pdf: PdfGerado): void {
  cache.set(chave, { em: Date.now(), pdf });
  // Map preserva ordem de inserção: o primeiro é o mais antigo.
  while (cache.size > CACHE_MAX) {
    const maisVelho = cache.keys().next().value;
    if (maisVelho === undefined) break;
    cache.delete(maisVelho);
  }
}

/** `Proposta 2026-0184.pdf` — é este o nome que aparece no WhatsApp. */
function nomeDoArquivo(tipo: 'proposta' | 'contrato', numero: string): string {
  const rotulo = tipo === 'proposta' ? 'Proposta' : 'Contrato';
  const limpo = (numero || '').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '');
  return `${rotulo}${limpo ? ` ${limpo}` : ''}.pdf`;
}

async function imprimir(token: string): Promise<Buffer> {
  const browser = await obterNavegador();
  const page = await browser.newPage();

  try {
    // Viewport de desktop: abaixo de 768px o index.css reduz a folha por
    // `--escala-folha` para caber no celular, e imprimir daquele estado sairia
    // com o documento encolhido.
    await page.setViewport({ width: 1280, height: 1024 });
    await page.setExtraHTTPHeaders(cabecalhosDeRender());

    const url = `${config.pdfBaseUrl}/p/${encodeURIComponent(token)}`;
    const resposta = await page.goto(url, { waitUntil: 'load', timeout: 30_000 });

    // Conferir o status ANTES de esperar a folha. Em produção isto nunca
    // dispara — o mesmo Express serve a API e o SPA. Em desenvolvimento dispara
    // sempre que PDF_BASE_URL aponta para a API sozinha, que não tem o SPA para
    // servir e devolve 404 em /p/<token>. Sem esta checagem o sintoma seria um
    // timeout mudo de 20 segundos esperando uma folha que nunca vem.
    const status = resposta?.status() ?? 0;
    if (status >= 400) {
      console.error(`[pdf] ${url} respondeu ${status} — a página do documento não foi servida.`);
      throw new AppError(
        503,
        `A página do documento respondeu ${status}. Em desenvolvimento, aponte PDF_BASE_URL para o servidor que serve o front (ex.: http://localhost:3000).`,
        'pdf_pagina_indisponivel',
      );
    }

    // `networkidle` seria frágil aqui: a página busca o documento, depois a
    // imagem de satélite, e uma rede lenta faria o "ocioso" chegar antes do
    // conteúdo. Esperar a folha existir é a condição que realmente importa.
    try {
      await page.waitForSelector('.folha-pdf', { timeout: 20_000 });
    } catch {
      console.error(`[pdf] a folha do documento não apareceu em ${url} dentro de 20 s.`);
      throw new AppError(
        504,
        'O documento não terminou de carregar para virar PDF. Confira se o link ainda é válido e se o servidor alcança a própria página.',
        'pdf_pagina_nao_renderizou',
      );
    }
    // Sem isto, a primeira impressão de um container frio sai com fonte
    // substituta — as webfonts ainda não terminaram de carregar.
    //
    // O cast existe porque este arquivo compila com lib ES2023, sem DOM: o
    // corpo da função roda no NAVEGADOR, mas o TypeScript o tipa aqui.
    await page.evaluate(() => (globalThis as unknown as JanelaDoDocumento).document.fonts.ready);

    const bytes = await page.pdf({
      printBackground: true,
      // Obrigatório: respeita o `@page { size: A4; margin: 12mm }` do
      // index.css em vez de impor Letter com margem zero.
      preferCSSPageSize: true,
    });

    return Buffer.from(bytes);
  } finally {
    // Fecha a aba mesmo em erro: aba vazada é memória vazada, e o navegador
    // fica de pé por mais dois minutos depois disto.
    await page.close().catch(() => {});
  }
}

/**
 * Gera o PDF do documento e devolve os bytes.
 *
 * `token` é o do link público — o mesmo de SolarCosta_LinksPublicos. Ele não
 * vai para o cliente (a mensagem leva só o anexo), mas continua sendo como o
 * renderizador alcança o documento sem login.
 *
 * Serializado por `vez`: duas impressões ao mesmo tempo dobrariam o pico de
 * memória, e numa VPS pequena é assim que a API inteira morre por OOM enquanto
 * alguém manda uma proposta.
 */
export async function gerarPdfDocumento(
  tipo: 'proposta' | 'contrato',
  id: string,
  numero: string,
  token: string,
): Promise<PdfGerado> {
  const chave = chaveDe(tipo, id);
  const guardado = doCache(chave);
  if (guardado) return guardado;

  const minhaVez = vez.then(async () => {
    // Confere o cache de novo: enquanto esta chamada esperava na fila, a
    // anterior pode ter gerado exatamente o mesmo documento — é o caso do
    // envio para vários destinatários.
    const agora = doCache(chave);
    if (agora) return agora;

    const inicio = Date.now();
    const bytes = await comTimeout(imprimir(token), TIMEOUT_MS);
    const pdf: PdfGerado = {
      bytes,
      nomeArquivo: nomeDoArquivo(tipo, numero),
      hash: createHash('sha256').update(bytes).digest('hex'),
    };
    console.log(
      `[pdf] ${pdf.nomeArquivo} — ${(bytes.length / 1024).toFixed(0)} kB em ${Date.now() - inicio} ms`,
    );
    guardarNoCache(chave, pdf);
    return pdf;
  });

  // A fila não pode parar por causa de uma falha: sem o catch, um erro aqui
  // deixaria `vez` rejeitada e toda impressão seguinte falharia junto.
  vez = minhaVez.catch(() => {});
  return minhaVez;
}

function comTimeout<T>(promessa: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolver, rejeitar) => {
    const t = setTimeout(() => {
      rejeitar(
        new AppError(
          504,
          'A geração do PDF demorou demais. Tente de novo; se repetir, o servidor pode estar sem memória.',
          'pdf_demorou',
        ),
      );
    }, ms);
    promessa.then(
      (v) => {
        clearTimeout(t);
        resolver(v);
      },
      (e) => {
        clearTimeout(t);
        rejeitar(e);
      },
    );
  });
}
