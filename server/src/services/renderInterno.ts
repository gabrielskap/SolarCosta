// Marca as requisições que vêm do nosso próprio Chromium.
//
// Quando a API gera o PDF de uma proposta, ela abre a PÁGINA PÚBLICA do
// documento (/p/<token>) num navegador headless. Essa página busca os dados em
// GET /api/publico/documento/:token, que conta uma abertura — e contaria uma
// por PDF gerado. O número de aberturas existe para dizer se o CLIENTE olhou a
// proposta; enchê-lo com visitas do próprio servidor transformaria a métrica em
// ruído, e pior: em ruído que parece informação.
//
// O segredo é sorteado na subida e vive só na memória deste processo. Não é
// env, não é banco e não precisa ser: quem gera o PDF e quem atende a rota
// pública são o MESMO processo. Um atacante externo não tem como adivinhá-lo, e
// mesmo que tivesse, o único efeito seria não incrementar um contador.
//
// Fica em arquivo próprio, e não dentro de pdfDocumento.ts, para que
// publico.routes.ts possa conferir o cabeçalho sem arrastar o puppeteer para o
// grafo de imports de uma rota que não gera PDF nenhum.

import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';

export const CABECALHO_RENDER = 'x-solarcosta-render';

const SEGREDO = randomBytes(24).toString('base64url');

/** Cabeçalhos que o Puppeteer injeta em toda requisição da página. */
export function cabecalhosDeRender(): Record<string, string> {
  return { [CABECALHO_RENDER]: SEGREDO };
}

/**
 * Verdadeiro quando a requisição é do nosso renderizador.
 *
 * Comparação em tempo constante pelo mesmo motivo do webhook: um `===` sobre
 * segredo vaza o prefixo correto pelo tempo de resposta.
 */
export function ehRenderInterno(req: Request): boolean {
  const recebido = req.get(CABECALHO_RENDER);
  if (!recebido) return false;

  const a = Buffer.from(recebido);
  const b = Buffer.from(SEGREDO);
  // timingSafeEqual exige o mesmo tamanho; comparar antes não vaza nada útil,
  // porque o tamanho do segredo é fixo e conhecido.
  return a.length === b.length && timingSafeEqual(a, b);
}
