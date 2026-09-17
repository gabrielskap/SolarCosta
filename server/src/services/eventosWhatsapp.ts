// Leitura dos eventos que a uazapi manda no webhook.
//
// Mesmo corte do uazapi.ts, pelo mesmo motivo: este arquivo NÃO toca o banco.
// Ele recebe o JSON de um terceiro e devolve tipos nossos; quem persiste é
// whatsappWebhook.routes.ts. É isso que o torna testável sem Postgres — e é
// justamente este o código que mais vai precisar de teste, porque ele é um
// palpite sobre um contrato que não está publicado.
//
// ====================== POR QUE ELE SONDA VÁRIOS CAMINHOS ======================
// O formato do corpo do evento `messages` não é documentado. Do contrato da
// uazapi só `EventType` e `token` estão confirmados. O resto aqui é a união do
// que a uazapi mostra em exemplo com o que o Baileys (a biblioteca que ela usa
// por baixo) emite — daí `chatid` e `key.remoteJid` conviverem na mesma lista.
//
// A postura, então, é a oposta de um schema estrito: sondar os caminhos
// plausíveis em ordem, ficar com o primeiro que existir, e quando nem o mínimo
// aparecer, DEVOLVER null E LOGAR O PAYLOAD CRU. Esse log é o que permite
// acertar os nomes com o primeiro evento real em vez de adivinhar duas vezes.
//
// Um zod.parse() aqui recusaria a mensagem inteira por causa de um campo com
// outro nome, e o cliente ficaria sem resposta sem ninguém saber por quê.

import { traduzirStatusMensagem } from './uazapi.js';

/** Os tipos do CHECK de SolarCosta_WhatsAppMensagens (V009). */
export type TipoMensagem =
  | 'texto' | 'imagem' | 'video' | 'audio' | 'documento' | 'contato' | 'local' | 'outro';

export interface MidiaRecebida {
  /**
   * URL http(s) quando o evento traz uma. Null quando o evento só indica que
   * há arquivo — aí o download tem de ser pedido pelo id da mensagem.
   */
  url: string | null;
  mimeType: string | null;
  nomeArquivo: string | null;
}

export interface MensagemRecebida {
  chatid: string;
  mensagemId: string;
  /** Mensagem que NÓS mandamos, voltando como eco. Descartada pelo chamador. */
  deMim: boolean;
  eGrupo: boolean;
  tipo: TipoMensagem;
  texto: string | null;
  /** Nome que o WhatsApp informa (agenda do aparelho ou push name). */
  nomeExibicao: string | null;
  ocorridoEm: Date;
  midia: MidiaRecebida | null;
}

export interface AtualizacaoStatus {
  mensagemId: string;
  /** Já no vocabulário do banco: fila, enviada, entregue, lida, falhou, cancelada. */
  status: string;
  erro: string | null;
}

/* ========================================================== SONDAGEM == */

type Json = Record<string, unknown>;

const ehObjeto = (v: unknown): v is Json =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** Caminha um caminho com pontos (`key.remoteJid`) sem estourar no meio. */
function noCaminho(raiz: unknown, caminho: string): unknown {
  let atual: unknown = raiz;
  for (const parte of caminho.split('.')) {
    if (!ehObjeto(atual)) return undefined;
    atual = atual[parte];
  }
  return atual;
}

/** Primeiro caminho que devolve texto não vazio. */
function primeiroTexto(raizes: unknown[], caminhos: string[]): string | null {
  for (const raiz of raizes) {
    for (const caminho of caminhos) {
      const v = noCaminho(raiz, caminho);
      if (typeof v === 'string' && v.trim() !== '') return v;
      // Alguns campos chegam como número — o timestamp, tipicamente — e ainda
      // assim são o valor que queremos, em forma de texto.
      if (typeof v === 'number' && Number.isFinite(v)) return String(v);
    }
  }
  return null;
}

/** Primeiro caminho que devolve booleano de verdade — `undefined` não conta. */
function primeiroBooleano(raizes: unknown[], caminhos: string[]): boolean | null {
  for (const raiz of raizes) {
    for (const caminho of caminhos) {
      const v = noCaminho(raiz, caminho);
      if (typeof v === 'boolean') return v;
      // 'true'/'false' como texto aparece quando o evento passa por um proxy
      // que serializa tudo como string.
      if (v === 'true') return true;
      if (v === 'false') return false;
    }
  }
  return null;
}

/* =========================================================== CAMPOS == */

const CAMINHOS_CHATID = ['chatid', 'chatId', 'chat_id', 'key.remoteJid', 'remoteJid', 'from', 'jid'];
const CAMINHOS_ID = ['messageid', 'messageId', 'message_id', 'id', 'key.id'];
const CAMINHOS_DE_MIM = ['fromMe', 'from_me', 'key.fromMe', 'wasSentByApi'];
const CAMINHOS_HORARIO = ['messageTimestamp', 'message_timestamp', 'timestamp', 'messageTime', 't'];
const CAMINHOS_NOME = ['pushName', 'push_name', 'senderName', 'notifyName', 'verifiedName', 'name'];
const CAMINHOS_TIPO = ['messageType', 'message_type', 'type', 'mediaType'];

const CAMINHOS_TEXTO = [
  'text', 'body', 'caption', 'content', 'conversation',
  'text.body',
  'message.conversation',
  'message.extendedTextMessage.text',
  'message.imageMessage.caption',
  'message.videoMessage.caption',
  'message.documentMessage.caption',
];

const CAMINHOS_MIDIA_URL = [
  'file', 'fileURL', 'fileUrl', 'mediaUrl', 'media_url', 'url', 'downloadUrl',
  'message.imageMessage.url',
  'message.videoMessage.url',
  'message.audioMessage.url',
  'message.documentMessage.url',
  'message.stickerMessage.url',
];

const CAMINHOS_MIME = [
  'mimetype', 'mimeType', 'mime_type',
  'message.imageMessage.mimetype',
  'message.videoMessage.mimetype',
  'message.audioMessage.mimetype',
  'message.documentMessage.mimetype',
];

const CAMINHOS_NOME_ARQUIVO = [
  'fileName', 'filename', 'file_name',
  'message.documentMessage.fileName',
];

/**
 * Tradução do tipo.
 *
 * As chaves cobrem as duas nomenclaturas: a curta da uazapi (`image`) e a do
 * Baileys (`imageMessage`), comparadas em minúsculas.
 *
 * Figurinha cai em 'imagem', não em 'outro': é um webp que a thread renderiza
 * igual a uma foto, e 'outro' a esconderia atrás de um rótulo genérico. Há
 * também um motivo de banco — figurinha não tem texto, e o CHECK
 * SolarCosta_WhatsAppMensagens_tem_conteudo recusaria tipo 'texto' sem texto.
 */
const TIPOS: Record<string, TipoMensagem> = {
  text: 'texto', chat: 'texto', conversation: 'texto', extendedtextmessage: 'texto',
  image: 'imagem', imagemessage: 'imagem', sticker: 'imagem', stickermessage: 'imagem',
  video: 'video', videomessage: 'video', gif: 'video',
  audio: 'audio', audiomessage: 'audio', ptt: 'audio', pttmessage: 'audio', voice: 'audio',
  document: 'documento', documentmessage: 'documento',
  documentwithcaptionmessage: 'documento',
  contact: 'contato', contactmessage: 'contato', contactsarraymessage: 'contato', vcard: 'contato',
  location: 'local', locationmessage: 'local', livelocationmessage: 'local',
};

function traduzirTipo(bruto: string | null, temMidia: boolean, temTexto: boolean): TipoMensagem {
  const conhecido = TIPOS[(bruto ?? '').toLowerCase().trim()];

  // 'texto' sem texto e sem mídia NÃO pode passar: o CHECK
  // SolarCosta_WhatsAppMensagens_tem_conteudo recusaria a linha, a transação
  // inteira do webhook cairia, e a mensagem se perderia por causa de um campo
  // de texto que veio com outro nome. 'outro' guarda a linha — a thread mostra
  // "mensagem não suportada" e o log diz qual payload não soubemos ler.
  if (conhecido === 'texto' && !temTexto && !temMidia) return 'outro';
  if (conhecido) return conhecido;

  // Sem tipo reconhecido, o conteúdo decide: anexo sem rótulo é 'outro' (a
  // thread mostra o arquivo), e texto sem rótulo é texto.
  if (temMidia) return 'outro';
  return temTexto ? 'texto' : 'outro';
}

/**
 * Horário da mensagem no WhatsApp.
 *
 * O campo vem em segundos numas versões e em milissegundos noutras, e a chave
 * é a mesma nos dois casos. A magnitude resolve: um epoch em segundos de hoje
 * tem 10 dígitos (~1,7e9); em milissegundos, 13 (~1,7e12). O corte em 1e11
 * fica folgado dos dois lados até o ano 5138.
 *
 * Valor ausente ou absurdo vira `now()`: ordenar a conversa por um horário
 * aproximado é melhor do que recusar a mensagem por causa do relógio.
 */
function lerHorario(bruto: string | null): Date {
  const n = Number(bruto);
  if (!Number.isFinite(n) || n <= 0) return new Date();
  const d = new Date(n < 1e11 ? n * 1000 : n);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

/** Log do payload que não deu para ler. 1 KB basta para achar o campo. */
function logarDesconhecido(rotulo: string, corpo: unknown): void {
  let texto: string;
  try {
    texto = JSON.stringify(corpo) ?? String(corpo);
  } catch {
    texto = String(corpo);
  }
  console.warn(`[webhook whatsapp] ${rotulo} — payload não reconhecido: ${texto.slice(0, 1000)}`);
}

/**
 * Normaliza o embrulho do evento numa lista de itens para ler.
 *
 * Cobre `{data: {…}}`, `{data: […]}`, `{messages: […]}` e o corpo cru sem
 * embrulho nenhum.
 */
function itensDoEvento(corpo: unknown): unknown[] {
  if (!ehObjeto(corpo)) return [];

  for (const chave of ['data', 'messages', 'message', 'payload']) {
    const v = corpo[chave];
    if (Array.isArray(v)) return v;
    if (ehObjeto(v)) return [v];
  }

  return [corpo];
}

/* ======================================================== MENSAGENS == */

/**
 * As mensagens de um evento `messages`.
 *
 * Devolve LISTA, não uma mensagem: `data` aparece como objeto em alguns
 * exemplos e como array em outros, e tratar os dois aqui custa uma linha. Quem
 * chama itera sem se importar com qual formato chegou.
 *
 * Item sem `chatid` ou sem id é descartado com log: sem chatid não há conversa
 * onde guardá-lo, e sem id o INSERT perderia a idempotência que o UNIQUE de
 * mensagem_id garante.
 */
export function lerMensagensRecebidas(corpo: unknown): MensagemRecebida[] {
  const lidas: MensagemRecebida[] = [];

  for (const item of itensDoEvento(corpo)) {
    // O corpo inteiro entra como segunda raiz: há exemplos em que os campos
    // ficam no nível de cima, sem o embrulho `data`.
    const raizes = [item, corpo];

    const chatid = primeiroTexto(raizes, CAMINHOS_CHATID);
    const mensagemId = primeiroTexto(raizes, CAMINHOS_ID);
    if (!chatid || !mensagemId) {
      logarDesconhecido('messages', item);
      continue;
    }

    const texto = primeiroTexto(raizes, CAMINHOS_TEXTO);
    const url = primeiroTexto(raizes, CAMINHOS_MIDIA_URL);
    const mimeType = primeiroTexto(raizes, CAMINHOS_MIME);
    const nomeArquivo = primeiroTexto(raizes, CAMINHOS_NOME_ARQUIVO);

    // Mídia é "há arquivo", não "há URL": o evento pode anunciar o anexo sem
    // trazer endereço, e aí o download é pedido pelo id da mensagem.
    const temMidia = Boolean(url || mimeType || nomeArquivo);

    lidas.push({
      chatid,
      mensagemId,
      deMim: primeiroBooleano(raizes, CAMINHOS_DE_MIM) ?? false,
      // '@g.us' é grupo, '@newsletter' é canal. Nenhum dos dois é telefone.
      eGrupo: !chatid.endsWith('@s.whatsapp.net'),
      tipo: traduzirTipo(primeiroTexto(raizes, CAMINHOS_TIPO), temMidia, Boolean(texto)),
      texto,
      nomeExibicao: primeiroTexto(raizes, CAMINHOS_NOME),
      ocorridoEm: lerHorario(primeiroTexto(raizes, CAMINHOS_HORARIO)),
      midia: temMidia
        ? { url: url && /^https?:\/\//i.test(url) ? url : null, mimeType, nomeArquivo }
        : null,
    });
  }

  return lidas;
}

/**
 * As mudanças de status de um evento `messages_update`.
 *
 * Só id e status interessam. O status já sai traduzido para o vocabulário do
 * banco por `traduzirStatusMensagem`, a mesma função usada no envio — repetir a
 * tabela de tradução aqui criaria duas versões para divergir.
 */
export function lerAtualizacoesStatus(corpo: unknown): AtualizacaoStatus[] {
  const lidas: AtualizacaoStatus[] = [];

  for (const item of itensDoEvento(corpo)) {
    const raizes = [item, corpo];

    const mensagemId = primeiroTexto(raizes, CAMINHOS_ID);
    const bruto = primeiroTexto(raizes, ['status', 'messageStatus', 'update.status', 'ack']);
    if (!mensagemId || !bruto) {
      logarDesconhecido('messages_update', item);
      continue;
    }

    lidas.push({
      mensagemId,
      status: traduzirStatusMensagem(bruto),
      erro: primeiroTexto(raizes, ['error', 'erro', 'failureReason']),
    });
  }

  return lidas;
}
