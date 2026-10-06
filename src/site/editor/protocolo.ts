// Contrato de mensagens entre o editor visual (pai, em /sistema/site/editor) e
// o preview do site (filho, num iframe em /?editor=1).
//
// Nada aqui importa React: é dado puro, do mesmo jeito que blocos/tipos.ts.
// Isso é o que permite os DOIS bundles importarem este arquivo — o do CRM e o
// do site público são lazy e separados (ver src/main.tsx), e um contrato
// duplicado entre eles seria a primeira coisa a sair de sincronia.
//
// POR QUE postMessage E NÃO UM ENDPOINT PÚBLICO DE RASCUNHO
//
// O iframe carrega uma rota pública: ele não tem token nenhum. A alternativa
// óbvia seria /api/publico/site?rascunho=1, e ela é ruim — passaria a existir
// um caminho sem autenticação capaz de devolver conteúdo não publicado, e a
// única coisa separando o rascunho do mundo seria um `if` nesse handler. Com
// postMessage o rascunho sai de uma tela que já exige `gerenciar_site` e nunca
// toca a rede. As únicas chamadas que o preview faz são /api/publico/config e
// /api/publico/midia/:id, ambas já públicas hoje.
//
// O payload atravessa por structured clone, então só pode conter JSON — que é
// exatamente o que o conteúdo dos blocos já é.

import type { SitePublico } from '../../services/publico';

/** Marca a URL do preview. O iframe é montado com `/?editor=1`. */
export const PARAM_EDITOR = 'editor';

/* ------------------------------------------------------- pai → preview -- */

export interface ParaPreview {
  /** Conteúdo inteiro do rascunho + qual página mostrar. */
  conteudo: { site: SitePublico; caminho: string };
  /** Destaca um bloco (e, dentro dele, um elemento de área livre). */
  selecao: { blocoId: string | null; elementoId: string | null };
  /** Navega o preview para outro endereço do site. */
  ir: { caminho: string };
  /** Rola até um bloco — usado ao selecionar pela árvore lateral. */
  rolar_para: { blocoId: string };
}

/* ------------------------------------------------------- preview → pai -- */

export interface ParaEditor {
  /** O preview montou e está pronto para receber conteúdo. */
  pronto: Record<string, never>;
  /** Clique no preview: seleciona o bloco (e opcionalmente o campo clicado). */
  selecionou: { blocoId: string; campo?: string; elementoId?: string };
  /** Texto editado no lugar. Só no blur/Enter, nunca tecla a tecla. */
  texto: { blocoId: string; campo: string; valor: string };
  /** Nova ordem completa dos blocos da página, depois de um arrasto. */
  ordem: { ordem: string[] };
  /** Geometria de um elemento de área livre, no fim do gesto. */
  elemento: {
    blocoId: string;
    elementoId: string;
    x: number;
    y: number;
    largura: number;
    altura: number;
  };
  /** Alça de imagem solta: `campo` é o caminho dentro do conteúdo do bloco. */
  imagem: { blocoId: string; campo: string; valor: number };
  /** Lista reordenada dentro do conteúdo (fotos da galeria, por exemplo). */
  lista: { blocoId: string; campo: string; lista: Record<string, unknown>[] };
  /** Link clicado dentro do preview — o pai decide se troca de página. */
  navegou: { caminho: string };
}

/* ------------------------------------------------------------ envelope -- */

type Envelope<M> = {
  [K in keyof M]: { tipo: K; dados: M[K] };
}[keyof M];

export type MensagemParaPreview = Envelope<ParaPreview>;
export type MensagemParaEditor = Envelope<ParaEditor>;

/**
 * Prefixo em toda mensagem nossa.
 *
 * O `window.message` é um barramento compartilhado: extensões de navegador, o
 * HMR do Vite e o próprio service worker conversam por ele. Sem uma marca
 * explícita, qualquer um desses viraria uma mensagem malformada do editor.
 */
const MARCA = 'solarcosta:editor';

interface Encapsulada {
  marca: typeof MARCA;
  tipo: string;
  dados: unknown;
}

export function enviar(
  destino: Window,
  mensagem: MensagemParaPreview | MensagemParaEditor,
): void {
  const pacote: Encapsulada = { marca: MARCA, tipo: mensagem.tipo, dados: mensagem.dados };
  // targetOrigin explícito, nunca '*': com '*' o conteúdo do rascunho seria
  // entregue a qualquer documento que viesse a ocupar o iframe.
  destino.postMessage(pacote, window.location.origin);
}

/**
 * Valida um MessageEvent e devolve a mensagem, ou `null` se não é nossa.
 *
 * Checa origem E remetente. A origem sozinha não basta: qualquer página do
 * mesmo domínio — inclusive uma aberta por `window.open` a partir do site —
 * passaria no teste de origem.
 */
export function receber<M extends MensagemParaPreview | MensagemParaEditor>(
  evento: MessageEvent,
  remetenteEsperado: Window | null,
): M | null {
  if (evento.origin !== window.location.origin) return null;
  if (remetenteEsperado && evento.source !== remetenteEsperado) return null;

  const d = evento.data as Encapsulada | null;
  if (!d || typeof d !== 'object' || d.marca !== MARCA || typeof d.tipo !== 'string') return null;

  return { tipo: d.tipo, dados: d.dados } as M;
}
