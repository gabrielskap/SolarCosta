// Como servir bytes que vieram de fora sem transformar a nossa origem numa
// plataforma de XSS armazenado.
//
// Vale para qualquer rota que devolva arquivo de terceiro: a mídia recebida no
// WhatsApp (whatsappCaixa.routes.ts) e os documentos anexados ao lead
// (documentos.routes.ts). As duas funções nasceram na rota do WhatsApp e foram
// extraídas para cá quando a segunda rota precisou exatamente do mesmo cuidado
// — duplicar lógica de segurança é como ela envelhece em um lugar só.

/**
 * Tipos que o navegador pode RENDERIZAR sem risco.
 *
 * ========================= POR QUE ISTO É UMA LISTA =========================
 * O `mime_type` do arquivo veio de fora — de um webhook ou do upload de um
 * usuário. A CSP do app é `default-src 'self'` (app.ts), então servir
 * `text/html` — ou `image/svg+xml`, que executa script — a partir da NOSSA
 * origem seria XSS armazenado no domínio do CRM, disparado por quem mandasse o
 * arquivo certo.
 *
 * Então: o que está na lista sai com o próprio tipo e `inline`; QUALQUER outra
 * coisa sai como `application/octet-stream` e `attachment`, que o navegador
 * baixa em vez de interpretar. O usuário continua recebendo o arquivo; o que
 * ele não faz é executá-lo no nosso domínio.
 *
 * SVG está fora de propósito, apesar de ser imagem.
 */
const PREFIXOS_SEGUROS = ['image/', 'video/', 'audio/'];
const TIPOS_SEGUROS = new Set(['application/pdf']);

export function tipoSeguro(mime: string): { contentType: string; inline: boolean } {
  const limpo = mime.toLowerCase().split(';')[0]!.trim();

  if (limpo === 'image/svg+xml' || limpo === 'image/svg') {
    return { contentType: 'application/octet-stream', inline: false };
  }
  if (TIPOS_SEGUROS.has(limpo) || PREFIXOS_SEGUROS.some((p) => limpo.startsWith(p))) {
    return { contentType: limpo, inline: true };
  }
  return { contentType: 'application/octet-stream', inline: false };
}

/**
 * Nome de arquivo para o header.
 *
 * O nome também vem de fora, e CR/LF num header é injeção de cabeçalho — o
 * clássico. Sai um nome ASCII conservador em `filename=` e o nome real
 * percent-encoded em `filename*`, que é o que os navegadores atuais usam.
 */
export function contentDisposition(nome: string, inline: boolean): string {
  const seguro = nome.replace(/[^\w.\- ]+/g, '_').slice(0, 120) || 'arquivo';
  return `${inline ? 'inline' : 'attachment'}; filename="${seguro}"; filename*=UTF-8''${encodeURIComponent(nome)}`;
}
