// Documentos anexados ao lead — pastas, upload, download e exclusão.
//
// Montado no MESMO prefixo /api/leads do leads.routes.ts, pelo mesmo motivo
// dos dois routers em /api/whatsapp: separar por assunto em vez de deixar um
// arquivo crescer. Lá é o CRUD do lead; aqui, tudo que mexe com arquivo. Não
// há colisão de caminho — nenhuma rota de leads.routes.ts termina em
// `/pastas` ou `/documentos`.
//
// O router precisa do seu PRÓPRIO exigirLogin: o `use` do outro router não
// alcança este, mesmo montados no mesmo caminho.
//
// A base de dados para tudo isto existe desde a V001 (SolarCosta_LeadDocumentos
// e SolarCosta_PastasDocumento) e a contagem por pasta desde a V004
// (SolarCosta_vw_PastasDocumentos). Nada disso jamais foi consultado: a tela
// vinha de um array literal no componente. A V015 só acrescentou onde os bytes
// ficam. Estas também são as PRIMEIRAS rotas a usar `anexar_documentos` — a
// permissão existia no banco, no middleware e no toggle da tela de usuários,
// sem nenhuma rota atrás dela.

import { createHash } from 'node:crypto';
import express, { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { consultar, consultarUm, emTransacao } from '../db.js';
import { asyncHandler, conflito, naoEncontrado, semPermissao } from '../errors.js';
import { ator, exigirLogin, exigirPermissao, type RequestAutenticado } from '../auth/middleware.js';
import { contentDisposition, tipoSeguro } from '../services/arquivoSeguro.js';

export const documentosRouter = Router();
documentosRouter.use(exigirLogin);

const podeAnexar = exigirPermissao('anexar_documentos');

/**
 * Pasta é GLOBAL: `SolarCosta_PastasDocumento.nome` é UNIQUE sem lead_id, e a
 * view cruza todas as pastas ativas com todos os leads. Criar uma pasta muda a
 * tela de TODO cliente, e isso é administração do sistema, não atendimento de
 * um lead — daí o cargo em vez de uma permissão granular. Não existe permissão
 * para isto, e o Administrador recebe todas por definição (middleware.ts).
 */
function exigirAdministrador(req: Request, _res: Response, next: NextFunction): void {
  const usuario = (req as RequestAutenticado).usuario;
  if (usuario?.cargo !== 'Administrador') {
    next(semPermissao('Só o Administrador pode criar pastas de documentos.'));
    return;
  }
  next();
}

/* ================================================================ PASTAS == */

documentosRouter.get(
  '/:id/pastas',
  asyncHandler(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);

    // A view faz CROSS JOIN com as pastas ativas, então pasta vazia também
    // aparece (com qtd_arquivos = 0) — é o que mantém a grade de 7 cards de
    // pé num lead que nunca recebeu arquivo.
    const pastas = await consultar<{ qtd_arquivos: number }>(
      `SELECT pasta_id, pasta, ordem, qtd_arquivos, ultimo_envio
         FROM "SolarCosta_vw_PastasDocumentos"
        WHERE lead_id = $1
        ORDER BY ordem, pasta`,
      [id],
    );

    // Somado aqui e não no front para que o número do cabeçalho venha da mesma
    // consulta que os cards — era exatamente onde o mock mentia ("48 arquivos"
    // era a soma dos contadores fixos, escrita à mão).
    const total = pastas.reduce((soma, p) => soma + Number(p.qtd_arquivos), 0);

    res.json({ pastas, total });
  }),
);

documentosRouter.post(
  '/pastas',
  exigirAdministrador,
  asyncHandler(async (req: RequestAutenticado, res) => {
    const d = z
      .object({ nome: z.string().trim().min(1, 'Informe o nome da pasta.').max(80) })
      .parse(req.body);

    const pasta = await emTransacao(async (cliente) => {
      // Reativa em vez de recusar: uma pasta desativada com o mesmo nome é o
      // que o usuário quer de volta, não um 409 que ele não sabe resolver.
      const { rows } = await cliente.query(
        `INSERT INTO "SolarCosta_PastasDocumento" (nome, ordem)
         VALUES ($1, (SELECT coalesce(max(ordem), 0) + 1 FROM "SolarCosta_PastasDocumento"))
         ON CONFLICT (nome) DO UPDATE SET ativo = true
         RETURNING id, nome, ordem`,
        [d.nome],
      );

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('criar', 'Lead', $1, NULL, 'Pasta de documentos criada')`,
        [`Pasta ${d.nome}`],
      );
      return rows[0];
    }, ator(req));

    res.status(201).json({ pasta });
  }),
);

/* ============================================================ DOCUMENTOS == */

/**
 * O que a tela aceita. A chave é a EXTENSÃO, não o MIME que o navegador manda.
 *
 * Para .dwg e .xlsx o Content-Type do browser vai de vazio a
 * `application/octet-stream` conforme o sistema operacional — filtrar por ele
 * recusaria arquivo legítimo e, pior, aceitaria um .exe renomeado que viesse
 * com `application/pdf` no header. A extensão é o que o usuário vê na tela e o
 * que o sistema dele usa para abrir o arquivo, então é por ela que decidimos; o
 * MIME gravado é DERIVADO daqui, nunca copiado da requisição.
 */
const MIME_POR_EXTENSAO: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  dwg: 'application/acad',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
};

// Espelha o client_max_body_size 10M do Nginx (deploy/nginx/solarcosta.conf) e
// o CHECK da V015. Acima disso o proxy devolveria 413 antes da API ver nada.
const TAMANHO_MAXIMO = 10 * 1024 * 1024;

/**
 * Upload sem multipart e sem base64, como o da biblioteca do site: o browser
 * manda o File cru como corpo e o `express.raw` entrega um Buffer.
 *
 * Duas diferenças em relação ao de site.routes.ts, e as duas são de propósito:
 *
 *  · O raw é middleware DESTA rota, e não um `app.use` por prefixo em app.ts,
 *    porque o caminho tem `:id` no meio — montar por prefixo pegaria todas as
 *    rotas de /api/leads.
 *
 *  · `type: () => true` em vez de uma lista de MIMEs. O filtro do body-parser
 *    compara o Content-Type da requisição, e para .dwg ele costuma vir vazio;
 *    com a lista, o handler receberia body vazio e o arquivo sumiria em
 *    silêncio. Aceitamos qualquer tipo aqui e validamos pela extensão logo
 *    abaixo — o limite de tamanho continua valendo, então "qualquer tipo" não
 *    significa "qualquer tamanho".
 */
const receberArquivo = express.raw({ type: () => true, limit: '10mb' });

function extensaoDe(nome: string): string {
  const partes = nome.split('.');
  return partes.length > 1 ? partes.pop()!.toLowerCase() : '';
}

documentosRouter.post(
  '/:id/documentos',
  podeAnexar,
  receberArquivo,
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const q = z
      .object({
        nome: z.string().trim().min(1, 'Informe o nome do arquivo.').max(200),
        pasta_id: z.coerce.number().int().positive(),
      })
      .parse(req.query);

    const extensao = extensaoDe(q.nome);
    const mime = MIME_POR_EXTENSAO[extensao];
    if (!mime) {
      throw conflito('Formato não suportado. Envie PDF, JPG, PNG, WEBP, DWG, XLS(X) ou DOC(X).');
    }

    const bytes = req.body;
    if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
      throw conflito('Arquivo vazio ou não recebido.');
    }
    if (bytes.length > TAMANHO_MAXIMO) {
      throw conflito('Arquivo acima de 10 MB. Reduza antes de enviar.');
    }

    // Antes da transação: um lead inexistente daria erro de FK traduzido como
    // conflito genérico, e "Lead não encontrado" é o que a tela sabe exibir.
    const lead = await consultarUm<{ numero: string }>(
      `SELECT numero FROM "SolarCosta_Leads" WHERE id = $1 AND excluido_em IS NULL`,
      [id],
    );
    if (!lead) throw naoEncontrado('Lead');

    const hash = createHash('sha256').update(bytes).digest('hex');

    const documento = await emTransacao(async (cliente) => {
      // Sem `conteudo` no RETURNING: a resposta devolveria o arquivo inteiro
      // em base64 dentro do JSON, de volta para quem acabou de enviá-lo.
      const { rows } = await cliente.query(
        `INSERT INTO "SolarCosta_LeadDocumentos"
            (lead_id, pasta_id, nome_arquivo, mime_type, extensao,
             tamanho_bytes, hash_sha256, conteudo, enviado_por_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,"SolarCosta_fn_usuario_atual"())
         RETURNING id, pasta_id, nome_arquivo, mime_type, extensao,
                   tamanho_bytes, enviado_em`,
        [id, q.pasta_id, q.nome, mime, extensao, bytes.length, hash, bytes],
      );

      // Entidade 'Lead' e não uma nova no enum: o documento só existe dentro de
      // um lead, e acrescentar valor em EntidadeAuditoria exige ALTER TYPE fora
      // de transação (ver V008/V009) para ganhar pouco.
      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('criar', 'Lead', $1, $2, $3)`,
        [`Documento ${q.nome} — Lead ${lead.numero}`, id, `Anexado em ${bytes.length} bytes`],
      );
      return rows[0];
    }, ator(req));

    res.status(201).json({ documento });
  }),
);

/**
 * Bytes de um documento anexado.
 *
 * Mesmo desenho da mídia do WhatsApp: cache `private` (é documento de cliente,
 * não imagem de site institucional), Content-Type coagido por `tipoSeguro` e
 * `nosniff` para que a coerção valha de fato. `immutable` é seguro porque os
 * bytes de um id nunca mudam — não há rota que os substitua —, e o ETag é o
 * hash do arquivo, então o 304 sai de graça.
 *
 * Só exige login, e não `anexar_documentos`: quem pode abrir o lead pode ler o
 * que está anexado nele; a permissão governa quem ESCREVE.
 */
documentosRouter.get(
  '/:id/documentos/:docId/arquivo',
  asyncHandler(async (req, res) => {
    const params = z
      .object({ id: z.string().uuid(), docId: z.string().uuid() })
      .safeParse(req.params);
    if (!params.success) {
      res.status(404).json({ erro: 'Documento não encontrado.', codigo: 'nao_encontrado' });
      return;
    }

    // lead_id no WHERE: sem ele, um id de documento válido serviria por
    // qualquer lead da URL, e a tela deixaria de ser a fronteira que parece ser.
    const linha = await consultarUm<{
      nome_arquivo: string;
      mime_type: string | null;
      hash_sha256: string | null;
      conteudo: Buffer | null;
    }>(
      `SELECT nome_arquivo, mime_type, hash_sha256, conteudo
         FROM "SolarCosta_LeadDocumentos"
        WHERE id = $1 AND lead_id = $2 AND excluido_em IS NULL`,
      [params.data.docId, params.data.id],
    );

    if (!linha?.conteudo) {
      // conteudo nulo é linha anterior à V015 (bytes nunca existiram). A V015
      // marcou essas como excluídas, mas a checagem fica: é barata e o dia em
      // que alguém inserir à mão pelo DBeaver ela evita um 500.
      res.status(404).json({ erro: 'Documento não encontrado.', codigo: 'nao_encontrado' });
      return;
    }

    const { contentType, inline } = tipoSeguro(linha.mime_type ?? '');
    const etag = `"${linha.hash_sha256 ?? 'sem-hash'}"`;

    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', contentDisposition(linha.nome_arquivo, inline));
    res.setHeader('X-Content-Type-Options', 'nosniff');

    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }

    res.send(linha.conteudo);
  }),
);

documentosRouter.delete(
  '/:id/documentos/:docId',
  podeAnexar,
  asyncHandler(async (req: RequestAutenticado, res) => {
    const params = z
      .object({ id: z.string().uuid(), docId: z.string().uuid() })
      .parse(req.params);

    // Soft delete: a trilha de auditoria cita o documento, e apagar os bytes
    // deixaria a entrada apontando para o nada. O índice da V002 filtra por
    // excluido_em IS NULL, então a linha some das consultas sem custo.
    const nome = await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_LeadDocumentos" SET excluido_em = now()
          WHERE id = $1 AND lead_id = $2 AND excluido_em IS NULL
          RETURNING nome_arquivo`,
        [params.docId, params.id],
      );
      if (rows.length === 0) throw naoEncontrado('Documento');

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('excluir', 'Lead', $1, $2, 'Documento removido da pasta')`,
        [`Documento ${rows[0]!.nome_arquivo}`, params.id],
      );
      return rows[0]!.nome_arquivo as string;
    }, ator(req));

    res.json({ ok: true, nome_arquivo: nome });
  }),
);
