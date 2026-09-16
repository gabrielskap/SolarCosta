// Cifragem de segredos que precisam VOLTAR ao texto claro.
//
// O resto do projeto só guarda hash: bcrypt na senha (auth.routes.ts) e SHA-256
// no refresh token (auth/tokens.ts). Hash serve quando a pergunta é "confere?".
// Aqui a pergunta é outra — a API precisa do token da instância uazapi em texto
// claro para montar o header de cada chamada, então hash não resolve.
//
// Por que cifrar em vez de guardar cru:
//   database/02_papeis.sql cria o papel solarcosta_leitura, que lê todas as
//   tabelas. Um token de instância vazado envia mensagem no nome da empresa,
//   sem passar por login nenhum e sem deixar rastro na nossa auditoria. Cifrar
//   move o alvo do banco para o .env, que é um lugar bem mais defendido.
//
// AES-256-GCM e não AES-CBC: o GCM autentica o texto cifrado. Sem isso, alguém
// com escrita no banco poderia trocar bytes do token e nós enviaríamos a
// requisição mesmo assim, contra um valor adulterado.

import crypto from 'node:crypto';
import { config } from '../config.js';
import { AppError } from '../errors.js';

const ALGORITMO = 'aes-256-gcm';
const TAMANHO_IV = 12; // 96 bits, o recomendado para GCM
const PREFIXO_VERSAO = 'v1';

/**
 * Sal fixo do scrypt.
 *
 * Sal aleatório por valor cifrado é o certo para SENHA, onde o objetivo é
 * impedir rainbow table sobre milhões de hashes. Aqui existe UM segredo, de 32
 * caracteres ou mais, gerado por `crypto.randomBytes` — não há dicionário para
 * atacar, e um sal por registro exigiria derivar a chave (~100 ms de scrypt) a
 * cada decifragem, ou seja, a cada mensagem enviada.
 */
const SAL = Buffer.from('solarcosta.whatsapp.v1');

let chaveCache: Buffer | null = null;

/**
 * Deriva a chave de 32 bytes a partir de WHATSAPP_CRIPTO_KEY.
 *
 * Memoizada: o scrypt é caro de propósito, e pagar esse custo em todo envio de
 * mensagem apareceria como latência sem motivo.
 */
function chave(): Buffer {
  if (chaveCache) return chaveCache;

  if (!config.WHATSAPP_CRIPTO_KEY) {
    throw new AppError(
      503,
      'WhatsApp indisponível: WHATSAPP_CRIPTO_KEY não configurada.',
      'whatsapp_desligado',
    );
  }

  chaveCache = crypto.scryptSync(config.WHATSAPP_CRIPTO_KEY, SAL, 32);
  return chaveCache;
}

/**
 * Cifra um segredo. O formato é `v1.iv.tag.texto`, tudo em base64url.
 *
 * O prefixo de versão não é enfeite: no dia em que o algoritmo mudar, é ele
 * que permite decifrar o que já está no banco em vez de invalidar tudo.
 */
export function cifrar(texto: string): string {
  const iv = crypto.randomBytes(TAMANHO_IV);
  const cipher = crypto.createCipheriv(ALGORITMO, chave(), iv);

  const cifrado = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    PREFIXO_VERSAO,
    iv.toString('base64url'),
    tag.toString('base64url'),
    cifrado.toString('base64url'),
  ].join('.');
}

/**
 * Devolve o segredo em texto claro.
 *
 * Lança 503 em vez de 500 quando não consegue: na prática isso significa que
 * WHATSAPP_CRIPTO_KEY mudou desde que o token foi gravado, e o conserto é
 * reconectar a instância pelo QR — informação que precisa chegar na tela, não
 * virar "erro interno" no console.
 */
export function decifrar(valor: string): string {
  const partes = valor.split('.');
  if (partes.length !== 4 || partes[0] !== PREFIXO_VERSAO) {
    throw new AppError(
      503,
      'Não foi possível ler o token do WhatsApp. Reconecte o número pelo QR code.',
      'whatsapp_token_ilegivel',
    );
  }

  const [, iv, tag, cifrado] = partes;

  try {
    const decipher = crypto.createDecipheriv(
      ALGORITMO,
      chave(),
      Buffer.from(iv!, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tag!, 'base64url'));

    return Buffer.concat([
      decipher.update(Buffer.from(cifrado!, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch (erro) {
    if (erro instanceof AppError) throw erro;

    // Falha de autenticação do GCM: a chave mudou ou o valor foi adulterado.
    console.error('[segredos] falha ao decifrar', erro instanceof Error ? erro.message : erro);
    throw new AppError(
      503,
      'Não foi possível ler o token do WhatsApp. Reconecte o número pelo QR code.',
      'whatsapp_token_ilegivel',
    );
  }
}

/**
 * Compara dois segredos em tempo constante.
 *
 * Existe aqui, e não no webhook, porque é o mesmo cuidado em dois lugares: a
 * URL secreta e o token que a uazapi manda no corpo. `timingSafeEqual` exige
 * buffers do MESMO tamanho — passar tamanhos diferentes LANÇA, em vez de
 * devolver false, e o comprimento por si só já vaza informação. O hash resolve
 * os dois problemas: qualquer entrada vira 32 bytes.
 */
export function conferirSegredo(recebido: string, esperado: string): boolean {
  const a = crypto.createHash('sha256').update(recebido).digest();
  const b = crypto.createHash('sha256').update(esperado).digest();
  return crypto.timingSafeEqual(a, b);
}
