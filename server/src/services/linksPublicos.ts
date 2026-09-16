// Links sem login para o cliente abrir a proposta ou o contrato dele.
//
// POR QUE LINK E NÃO PDF ANEXO: o PDF não existe como arquivo neste sistema.
// O documento é React — src/components/PDFModal.tsx — e vira papel por
// window.print(). Transformar isso em bytes no servidor exigiria um Chromium
// dentro do container, ~400 MB de imagem e memória de sobra na VPS, para
// produzir algo que o navegador do próprio cliente já sabe gerar.
//
// O link ainda ganha duas coisas que o anexo não dá: dá para revogar, e dá
// para saber que o cliente abriu — que é exatamente a informação que muda a
// hora de ligar para ele.
//
// O TOKEN É A ÚNICA CREDENCIAL. Quem o tiver vê o documento, sem sessão. É por
// isso que ele tem 32 bytes de aleatoriedade e que a rota pública devolve
// lista fechada de colunas (ver publico.routes.ts).

import crypto from 'node:crypto';
import { config } from '../config.js';
import { consultarUm, type Cliente } from '../db.js';

export type TipoDocumento = 'proposta' | 'contrato';

/**
 * Validade padrão.
 *
 * Generosa de propósito: a proposta vale 10 dias, mas o cliente reabre o link
 * meses depois para conferir o que foi combinado, e um link morto nessa hora
 * vira uma ligação para o vendedor. O que protege o documento é o token ser
 * imprevisível, não ele vencer rápido.
 */
const VALIDADE_DIAS = 180;

/** URL que vai para o WhatsApp do cliente. */
export function urlPublica(token: string): string {
  return `${config.APP_URL!.replace(/\/+$/, '')}/p/${token}`;
}

/**
 * Devolve o link deste documento, criando um se ainda não houver.
 *
 * Reaproveitar é deliberado: reenviar a mesma proposta três vezes deve chegar
 * no cliente com o MESMO endereço. Gerar um token novo a cada envio encheria a
 * tabela de links vivos para o mesmo documento e, na hora de revogar, obrigaria
 * a caçar todos — bastaria esquecer um para a revogação não valer nada.
 */
export async function obterOuCriarLink(
  cliente: Cliente,
  tipo: TipoDocumento,
  referenciaId: string,
  criadoPorId: string,
): Promise<string> {
  const { rows: existente } = await cliente.query<{ token: string }>(
    `SELECT token FROM "SolarCosta_LinksPublicos"
      WHERE tipo = $1 AND referencia_id = $2
        AND revogado_em IS NULL
        AND (expira_em IS NULL OR expira_em > now())
      ORDER BY criado_em DESC LIMIT 1`,
    [tipo, referenciaId],
  );
  if (existente[0]) return existente[0].token;

  const token = crypto.randomBytes(32).toString('base64url');
  await cliente.query(
    `INSERT INTO "SolarCosta_LinksPublicos" (token, tipo, referencia_id, expira_em, criado_por_id)
     VALUES ($1, $2, $3, now() + ($4 || ' days')::interval, $5)`,
    [token, tipo, referenciaId, String(VALIDADE_DIAS), criadoPorId],
  );
  return token;
}

export interface LinkResolvido {
  id: string;
  tipo: TipoDocumento;
  referencia_id: string;
}

/**
 * Valida o token e REGISTRA a abertura. Devolve null quando o link não serve
 * — inexistente, revogado ou vencido dão o mesmo resultado de propósito, para
 * que quem sondar não descubra qual dos três é.
 *
 * O UPDATE ... RETURNING faz a validação e a contagem numa ida só ao banco, e
 * sem janela entre ler e escrever.
 */
export async function abrirLink(token: string): Promise<LinkResolvido | null> {
  return consultarUm<LinkResolvido>(
    `UPDATE "SolarCosta_LinksPublicos" SET
        aberturas            = aberturas + 1,
        primeira_abertura_em = COALESCE(primeira_abertura_em, now()),
        ultima_abertura_em   = now()
      WHERE token = $1
        AND revogado_em IS NULL
        AND (expira_em IS NULL OR expira_em > now())
      RETURNING id, tipo::text AS tipo, referencia_id`,
    [token],
  );
}

/**
 * Como `abrirLink`, mas sem contar abertura.
 *
 * Existe para os recursos que a PÁGINA busca depois de aberta — hoje a imagem
 * de satélite do telhado. Sem isso, um documento com telhado contaria duas
 * aberturas por visita, e o número que o vendedor usa para decidir quando
 * ligar ficaria inflado.
 */
export async function lerLink(token: string): Promise<LinkResolvido | null> {
  return consultarUm<LinkResolvido>(
    `SELECT id, tipo::text AS tipo, referencia_id
       FROM "SolarCosta_LinksPublicos"
      WHERE token = $1
        AND revogado_em IS NULL
        AND (expira_em IS NULL OR expira_em > now())`,
    [token],
  );
}
