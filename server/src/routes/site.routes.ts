// Conteúdo do site institucional — o que a tela /sistema/site edita.
//
// Leitura exige apenas login; toda escrita exige `gerenciar_site`. A permissão
// é separada de `gerenciar_usuarios` de propósito: quem cuida do marketing
// edita o site sem ganhar junto o cadastro de usuários e os parâmetros
// comerciais que ficam em /api/config.
//
// A forma de `conteudo` depende do `tipo` do bloco, e é AQUI que ela é
// validada — a coluna no banco é jsonb livre (ver V008). O `schemaConteudo`
// abaixo é a autoridade sobre o que pode entrar; o site, do outro lado,
// ignora tipo que não conhece. Publicar é direto, sem rascunho: por isso a
// validação é estreita, e não "aceita e vê no que dá".

import { Router } from 'express';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { consultar, consultarUm, emTransacao, type Cliente } from '../db.js';
import { asyncHandler, conflito, naoEncontrado } from '../errors.js';
import { ator, exigirLogin, exigirPermissao, type RequestAutenticado } from '../auth/middleware.js';

export const siteRouter = Router();
siteRouter.use(exigirLogin);

const escrever = exigirPermissao('gerenciar_site');

/* ======================================================= tipos de bloco == */

/**
 * Espelha TIPOS_BLOCO de src/site/blocos/tipos.ts. Acrescentar um tipo aqui
 * sem criar o componente correspondente faz o bloco sumir da página (o
 * renderizador ignora o que não conhece) — não quebra, mas não aparece.
 */
const TIPOS_BLOCO = [
  'heroi',
  'selos',
  'cabecalho_pagina',
  'cards_servicos',
  'passos',
  'faq',
  'cta',
  'lista_itens',
  'banner_conversao',
  'dados_empresa',
  'contato_canais',
  'simulador',
  'texto_rico',
  'galeria',
] as const;

const link = z.object({ rotulo: z.string().max(120), destino: z.string().max(400) });

/**
 * Teto genérico para o jsonb de um bloco.
 *
 * Não é um discriminated union campo a campo, e a escolha é deliberada: o
 * catálogo de campos vive no front (CAMPOS_BLOCO), muda junto com o
 * componente, e duplicá-lo aqui criaria duas listas para manter em sincronia —
 * com o sintoma pior possível, que é um texto salvo na tela e recusado pela
 * API. O que o servidor precisa garantir é o que ele de fato sabe: profundidade
 * e tamanho limitados, sem função nem protótipo, e nada grande o bastante para
 * virar problema. Semântica de cada campo é do componente.
 */
const valorJson: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string().max(5000),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(valorJson).max(60),
    z.record(valorJson),
  ]),
);

const schemaConteudo = z.record(valorJson).refine(
  (v) => JSON.stringify(v).length <= 60_000,
  'Conteúdo do bloco grande demais.',
);

/* ============================================================== leitura == */

/** Blocos de todas as páginas, já agrupados por página. */
async function lerPaginas(): Promise<unknown[]> {
  const paginas = await consultar(
    `SELECT id, slug, caminho, nome, titulo_seo, descricao_seo, publicada, ordem
       FROM "SolarCosta_SitePaginas" ORDER BY ordem, nome`,
  );
  const blocos = await consultar(
    `SELECT id, pagina_id, tipo, ordem, visivel, conteudo
       FROM "SolarCosta_SiteBlocos" ORDER BY pagina_id, ordem, criado_em`,
  );

  return paginas.map((p) => ({
    ...p,
    blocos: blocos.filter((b) => (b as { pagina_id: string }).pagina_id === (p as { id: string }).id),
  }));
}

async function lerMenus(): Promise<unknown[]> {
  const menus = await consultar(
    `SELECT id, chave, nome, descricao FROM "SolarCosta_SiteMenus" ORDER BY chave`,
  );
  const itens = await consultar(
    `SELECT id, menu_id, rotulo, destino, nova_aba, destaque, visivel, ordem
       FROM "SolarCosta_SiteMenuItens" ORDER BY menu_id, ordem, criado_em`,
  );

  return menus.map((m) => ({
    ...m,
    itens: itens.filter((i) => (i as { menu_id: string }).menu_id === (m as { id: string }).id),
  }));
}

/** Metadados da biblioteca. `conteudo` (bytea) JAMAIS entra num SELECT destes. */
const COLUNAS_MIDIA = `id, nome_arquivo, mime_type, tamanho_bytes, largura, altura,
                       texto_alternativo, enviado_em`;

async function lerMidia(): Promise<unknown[]> {
  return consultar(
    `SELECT ${COLUNAS_MIDIA} FROM "SolarCosta_SiteMidia"
      WHERE excluido_em IS NULL ORDER BY enviado_em DESC`,
  );
}

siteRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const [paginas, menus, midia] = await Promise.all([lerPaginas(), lerMenus(), lerMidia()]);
    res.json({ paginas, menus, midia });
  }),
);

siteRouter.get(
  '/midia',
  asyncHandler(async (_req, res) => {
    res.json({ midia: await lerMidia() });
  }),
);

/* ============================================================== páginas == */

siteRouter.patch(
  '/paginas/:id',
  escrever,
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const d = z
      .object({
        titulo_seo: z.string().trim().min(1, 'Informe o título de SEO.').max(200).optional(),
        descricao_seo: z.string().trim().min(1, 'Informe a descrição de SEO.').max(400).optional(),
        publicada: z.boolean().optional(),
      })
      .parse(req.body);

    const pagina = await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_SitePaginas" SET
            titulo_seo    = COALESCE($2, titulo_seo),
            descricao_seo = COALESCE($3, descricao_seo),
            publicada     = COALESCE($4, publicada),
            atualizado_em = now()
          WHERE id = $1
          RETURNING id, slug, caminho, nome, titulo_seo, descricao_seo, publicada, ordem`,
        [id, d.titulo_seo ?? null, d.descricao_seo ?? null, d.publicada ?? null],
      );
      if (rows.length === 0) throw naoEncontrado('Página');

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('editar', 'Site', $1, NULL, 'Página do site atualizada')`,
        [`Página ${rows[0]!.nome}`],
      );
      return rows[0];
    }, ator(req));

    res.json({ pagina });
  }),
);

/* =============================================================== blocos == */

/** Devolve o bloco no mesmo formato da listagem, para o front trocar em memória. */
async function lerBloco(cliente: Cliente, id: string): Promise<unknown> {
  const { rows } = await cliente.query(
    `SELECT id, pagina_id, tipo, ordem, visivel, conteudo
       FROM "SolarCosta_SiteBlocos" WHERE id = $1`,
    [id],
  );
  return rows[0];
}

siteRouter.post(
  '/paginas/:id/blocos',
  escrever,
  asyncHandler(async (req: RequestAutenticado, res) => {
    const paginaId = z.string().uuid().parse(req.params.id);
    const d = z
      .object({
        tipo: z.enum(TIPOS_BLOCO),
        conteudo: schemaConteudo.default({}),
        ordem: z.number().int().min(0).max(999).optional(),
      })
      .parse(req.body);

    const bloco = await emTransacao(async (cliente) => {
      const { rows: pag } = await cliente.query(
        `SELECT nome FROM "SolarCosta_SitePaginas" WHERE id = $1`,
        [paginaId],
      );
      if (pag.length === 0) throw naoEncontrado('Página');

      // Sem `ordem` explícita o bloco entra no fim da página.
      const { rows } = await cliente.query(
        `INSERT INTO "SolarCosta_SiteBlocos" (pagina_id, tipo, ordem, conteudo, atualizado_por)
         VALUES ($1, $2,
                 COALESCE($3::smallint,
                   (SELECT COALESCE(max(ordem), 0) + 1 FROM "SolarCosta_SiteBlocos"
                     WHERE pagina_id = $1)),
                 $4::jsonb, "SolarCosta_fn_usuario_atual"())
         RETURNING id`,
        [paginaId, d.tipo, d.ordem ?? null, JSON.stringify(d.conteudo)],
      );

      const novoId = rows[0]!.id as string;
      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('criar', 'Site', $1, NULL, $2)`,
        [`Bloco ${d.tipo}`, `Adicionado em ${pag[0]!.nome}`],
      );
      return lerBloco(cliente, novoId);
    }, ator(req));

    res.status(201).json({ bloco });
  }),
);

siteRouter.patch(
  '/blocos/:id',
  escrever,
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const d = z
      .object({ conteudo: schemaConteudo.optional(), visivel: z.boolean().optional() })
      .parse(req.body);

    const bloco = await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_SiteBlocos" SET
            conteudo       = COALESCE($2::jsonb, conteudo),
            visivel        = COALESCE($3, visivel),
            atualizado_em  = now(),
            atualizado_por = "SolarCosta_fn_usuario_atual"()
          WHERE id = $1
          RETURNING tipo`,
        [id, d.conteudo ? JSON.stringify(d.conteudo) : null, d.visivel ?? null],
      );
      if (rows.length === 0) throw naoEncontrado('Bloco');

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('editar', 'Site', $1, NULL, $2)`,
        [
          `Bloco ${rows[0]!.tipo}`,
          d.visivel === undefined
            ? 'Conteúdo do bloco editado'
            : d.visivel
              ? 'Bloco exibido no site'
              : 'Bloco ocultado do site',
        ],
      );
      return lerBloco(cliente, id);
    }, ator(req));

    res.json({ bloco });
  }),
);

siteRouter.delete(
  '/blocos/:id',
  escrever,
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);

    await emTransacao(async (cliente) => {
      // Exclusão é definitiva: bloco é conteúdo editorial, não registro
      // histórico. O que preserva o texto sem mostrá-lo é `visivel = false`,
      // e é isso que a tela oferece primeiro.
      const { rows } = await cliente.query(
        `DELETE FROM "SolarCosta_SiteBlocos" WHERE id = $1 RETURNING tipo`,
        [id],
      );
      if (rows.length === 0) throw naoEncontrado('Bloco');

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('excluir', 'Site', $1, NULL, 'Bloco removido da página')`,
        [`Bloco ${rows[0]!.tipo}`],
      );
    }, ator(req));

    res.status(204).end();
  }),
);

siteRouter.patch(
  '/paginas/:id/blocos/ordem',
  escrever,
  asyncHandler(async (req: RequestAutenticado, res) => {
    const paginaId = z.string().uuid().parse(req.params.id);
    const ordem = z
      .array(z.string().uuid())
      .min(1, 'Envie a lista de blocos na nova ordem.')
      .max(100)
      .parse(req.body?.ordem);

    const blocos = await emTransacao(async (cliente) => {
      // Renumera em bloco. O UPDATE é restrito à página para que uma lista
      // adulterada não consiga reordenar blocos de outra.
      for (const [i, id] of ordem.entries()) {
        const { rowCount } = await cliente.query(
          `UPDATE "SolarCosta_SiteBlocos" SET ordem = $3, atualizado_em = now()
            WHERE id = $1 AND pagina_id = $2`,
          [id, paginaId, i + 1],
        );
        if (rowCount === 0) throw naoEncontrado('Bloco');
      }

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('editar', 'Site', $1, NULL, 'Blocos reordenados')`,
        [`Página ${paginaId}`],
      );

      const { rows } = await cliente.query(
        `SELECT id, pagina_id, tipo, ordem, visivel, conteudo
           FROM "SolarCosta_SiteBlocos" WHERE pagina_id = $1 ORDER BY ordem`,
        [paginaId],
      );
      return rows;
    }, ator(req));

    res.json({ blocos });
  }),
);

/* ================================================================ menus == */

async function menuPorChave(cliente: Cliente, chave: string): Promise<{ id: string; nome: string }> {
  const { rows } = await cliente.query(
    `SELECT id, nome FROM "SolarCosta_SiteMenus" WHERE chave = $1`,
    [chave],
  );
  if (rows.length === 0) throw naoEncontrado('Menu');
  return rows[0] as { id: string; nome: string };
}

const itemMenuSchema = z.object({
  rotulo: z.string().trim().min(1, 'Informe o texto do link.').max(120),
  destino: z.string().trim().min(1, 'Informe o destino do link.').max(400),
  nova_aba: z.boolean().optional(),
  destaque: z.boolean().optional(),
  visivel: z.boolean().optional(),
  ordem: z.number().int().min(0).max(999).optional(),
});

siteRouter.post(
  '/menus/:chave/itens',
  escrever,
  asyncHandler(async (req: RequestAutenticado, res) => {
    const chave = z.string().max(60).parse(req.params.chave);
    const d = itemMenuSchema.parse(req.body);

    const item = await emTransacao(async (cliente) => {
      const menu = await menuPorChave(cliente, chave);

      const { rows } = await cliente.query(
        `INSERT INTO "SolarCosta_SiteMenuItens"
            (menu_id, rotulo, destino, nova_aba, destaque, visivel, ordem)
         VALUES ($1, $2, $3, COALESCE($4, false), COALESCE($5, false), COALESCE($6, true),
                 COALESCE($7::smallint,
                   (SELECT COALESCE(max(ordem), 0) + 1 FROM "SolarCosta_SiteMenuItens"
                     WHERE menu_id = $1)))
         RETURNING id, menu_id, rotulo, destino, nova_aba, destaque, visivel, ordem`,
        [
          menu.id,
          d.rotulo,
          d.destino,
          d.nova_aba ?? null,
          d.destaque ?? null,
          d.visivel ?? null,
          d.ordem ?? null,
        ],
      );

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('criar', 'Site', $1, NULL, $2)`,
        [`Item de menu ${d.rotulo}`, `Adicionado em ${menu.nome}`],
      );
      return rows[0];
    }, ator(req));

    res.status(201).json({ item });
  }),
);

siteRouter.patch(
  '/menu-itens/:id',
  escrever,
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const d = itemMenuSchema.partial().parse(req.body);

    const item = await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_SiteMenuItens" SET
            rotulo        = COALESCE($2, rotulo),
            destino       = COALESCE($3, destino),
            nova_aba      = COALESCE($4, nova_aba),
            destaque      = COALESCE($5, destaque),
            visivel       = COALESCE($6, visivel),
            atualizado_em = now()
          WHERE id = $1
          RETURNING id, menu_id, rotulo, destino, nova_aba, destaque, visivel, ordem`,
        [
          id,
          d.rotulo ?? null,
          d.destino ?? null,
          d.nova_aba ?? null,
          d.destaque ?? null,
          d.visivel ?? null,
        ],
      );
      if (rows.length === 0) throw naoEncontrado('Item de menu');

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('editar', 'Site', $1, NULL, 'Item de menu atualizado')`,
        [`Item de menu ${rows[0]!.rotulo}`],
      );
      return rows[0];
    }, ator(req));

    res.json({ item });
  }),
);

siteRouter.delete(
  '/menu-itens/:id',
  escrever,
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);

    await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `DELETE FROM "SolarCosta_SiteMenuItens" WHERE id = $1 RETURNING rotulo`,
        [id],
      );
      if (rows.length === 0) throw naoEncontrado('Item de menu');

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('excluir', 'Site', $1, NULL, 'Item removido do menu')`,
        [`Item de menu ${rows[0]!.rotulo}`],
      );
    }, ator(req));

    res.status(204).end();
  }),
);

siteRouter.patch(
  '/menus/:chave/ordem',
  escrever,
  asyncHandler(async (req: RequestAutenticado, res) => {
    const chave = z.string().max(60).parse(req.params.chave);
    const ordem = z
      .array(z.string().uuid())
      .min(1, 'Envie a lista de itens na nova ordem.')
      .max(100)
      .parse(req.body?.ordem);

    const itens = await emTransacao(async (cliente) => {
      const menu = await menuPorChave(cliente, chave);

      for (const [i, id] of ordem.entries()) {
        const { rowCount } = await cliente.query(
          `UPDATE "SolarCosta_SiteMenuItens" SET ordem = $3, atualizado_em = now()
            WHERE id = $1 AND menu_id = $2`,
          [id, menu.id, i + 1],
        );
        if (rowCount === 0) throw naoEncontrado('Item de menu');
      }

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('editar', 'Site', $1, NULL, 'Itens reordenados')`,
        [`Menu ${menu.nome}`],
      );

      const { rows } = await cliente.query(
        `SELECT id, menu_id, rotulo, destino, nova_aba, destaque, visivel, ordem
           FROM "SolarCosta_SiteMenuItens" WHERE menu_id = $1 ORDER BY ordem`,
        [menu.id],
      );
      return rows;
    }, ator(req));

    res.json({ itens });
  }),
);

/* ================================================================ mídia == */

const MIMES_ACEITOS = ['image/png', 'image/jpeg', 'image/webp', 'image/avif'];
const TAMANHO_MAXIMO = 5 * 1024 * 1024;

/**
 * Upload sem multipart e sem base64.
 *
 * O browser manda o File cru como corpo, com o Content-Type do arquivo, e o
 * `express.raw` montado em app.ts entrega um Buffer. Base64 dentro de JSON
 * custaria 33% a mais de tráfego e estouraria o `express.json({limit:'2mb'})`
 * global; multipart custaria uma dependência nova para parsear um único campo.
 */
siteRouter.post(
  '/midia',
  escrever,
  asyncHandler(async (req: RequestAutenticado, res) => {
    const q = z
      .object({
        nome: z.string().trim().min(1, 'Informe o nome do arquivo.').max(200),
        alt: z.string().trim().max(300).optional(),
        largura: z.coerce.number().int().min(0).max(30000).optional(),
        altura: z.coerce.number().int().min(0).max(30000).optional(),
      })
      .parse(req.query);

    const mime = (req.headers['content-type'] ?? '').split(';')[0]!.trim().toLowerCase();
    if (!MIMES_ACEITOS.includes(mime)) {
      // SVG fica de fora de propósito: é XML executável e, servido da nossa
      // origem, um <script> embutido rodaria com o domínio do site.
      throw conflito('Formato não suportado. Envie PNG, JPEG, WebP ou AVIF.');
    }

    const bytes = req.body;
    if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
      throw conflito('Arquivo vazio ou não recebido.');
    }
    if (bytes.length > TAMANHO_MAXIMO) {
      throw conflito('Imagem acima de 5 MB. Reduza antes de enviar.');
    }

    const hash = createHash('sha256').update(bytes).digest('hex');

    const midia = await emTransacao(async (cliente) => {
      // Dedupe por hash: a mesma imagem enviada de novo reaproveita a linha
      // (e ressuscita uma que tenha sido excluída), em vez de duplicar bytes.
      const { rows } = await cliente.query(
        `INSERT INTO "SolarCosta_SiteMidia"
            (nome_arquivo, mime_type, tamanho_bytes, largura, altura,
             texto_alternativo, hash_sha256, conteudo, enviado_por_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,"SolarCosta_fn_usuario_atual"())
         ON CONFLICT (hash_sha256) DO UPDATE SET
            excluido_em       = NULL,
            nome_arquivo      = EXCLUDED.nome_arquivo,
            texto_alternativo = COALESCE(EXCLUDED.texto_alternativo,
                                         "SolarCosta_SiteMidia".texto_alternativo)
         RETURNING ${COLUNAS_MIDIA}`,
        [
          q.nome,
          mime,
          bytes.length,
          q.largura ?? null,
          q.altura ?? null,
          q.alt ?? null,
          hash,
          bytes,
        ],
      );

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('criar', 'Site', $1, NULL, 'Imagem enviada para a biblioteca')`,
        [`Imagem ${q.nome}`],
      );
      return rows[0];
    }, ator(req));

    res.status(201).json({ midia });
  }),
);

siteRouter.patch(
  '/midia/:id',
  escrever,
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const d = z
      .object({
        texto_alternativo: z.string().trim().max(300).nullish(),
        nome_arquivo: z.string().trim().min(1).max(200).optional(),
      })
      .parse(req.body);

    const midia = await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_SiteMidia" SET
            texto_alternativo = COALESCE($2, texto_alternativo),
            nome_arquivo      = COALESCE($3, nome_arquivo)
          WHERE id = $1 AND excluido_em IS NULL
          RETURNING ${COLUNAS_MIDIA}`,
        [id, d.texto_alternativo ?? null, d.nome_arquivo ?? null],
      );
      if (rows.length === 0) throw naoEncontrado('Imagem');
      return rows[0];
    }, ator(req));

    res.json({ midia });
  }),
);

siteRouter.delete(
  '/midia/:id',
  escrever,
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);

    // Soft delete: um bloco pode continuar apontando para esta imagem, e
    // apagar os bytes deixaria a página com um buraco sem aviso. A resposta
    // informa quantos blocos ainda citam o id para a tela poder avisar.
    const emUso = await consultarUm<{ total: number }>(
      `SELECT count(*)::int AS total FROM "SolarCosta_SiteBlocos"
        WHERE conteudo::text LIKE '%' || $1 || '%'`,
      [id],
    );

    const nome = await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_SiteMidia" SET excluido_em = now()
          WHERE id = $1 AND excluido_em IS NULL
          RETURNING nome_arquivo`,
        [id],
      );
      if (rows.length === 0) throw naoEncontrado('Imagem');

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('excluir', 'Site', $1, NULL, 'Imagem removida da biblioteca')`,
        [`Imagem ${rows[0]!.nome_arquivo}`],
      );
      return rows[0]!.nome_arquivo as string;
    }, ator(req));

    res.json({ ok: true, nome_arquivo: nome, blocos_em_uso: emUso?.total ?? 0 });
  }),
);
