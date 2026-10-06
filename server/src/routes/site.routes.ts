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
// ignora tipo que não conhece. A validação é estreita, e não "aceita e vê no
// que dá", porque boa parte das escritas daqui publica direto.
//
// DOIS CAMINHOS DE ESCRITA convivem neste arquivo, e a diferença importa:
//
//   · AO VIVO — POST /paginas/:id/blocos, PATCH /blocos/:id, DELETE
//     /blocos/:id e PATCH /paginas/:id/blocos/ordem. É o que a tela antiga
//     (/sistema/site) usa: grava em SiteBlocos e vai ao ar na hora.
//   · RASCUNHO — PUT /paginas/:id/rascunho + POST /paginas/:id/publicar. É o
//     que o editor visual (/sistema/site/editor) usa: grava um snapshot em
//     SitePaginas.blocos_rascunho e só toca SiteBlocos ao publicar (V013).
//
// Os dois podem agir sobre a mesma página, então toda escrita ao vivo marca
// `rascunho_desatualizado_em` — ver invalidarRascunho() lá embaixo.

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
  'video_youtube',
  'area_livre',
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

/**
 * Blocos de todas as páginas, já agrupados por página.
 *
 * Traz o ESTADO do rascunho (existe? de quem? invalidado?) mas nunca o
 * snapshot em si: `blocos_rascunho` pode ter centenas de KB por página e esta
 * consulta roda ao abrir /sistema/site, onde o que se precisa saber é só se há
 * um rascunho pendente para avisar. O conteúdo vem no GET dedicado.
 */
async function lerPaginas(): Promise<unknown[]> {
  const paginas = await consultar(
    `SELECT p.id, p.slug, p.caminho, p.nome, p.titulo_seo, p.descricao_seo,
            p.publicada, p.ordem,
            p.rascunho_em,
            (p.blocos_rascunho IS NOT NULL)                       AS tem_rascunho,
            (p.rascunho_desatualizado_em > p.rascunho_em)         AS rascunho_desatualizado,
            u.nome                                                AS rascunho_por_nome
       FROM "SolarCosta_SitePaginas" p
       LEFT JOIN "SolarCosta_Usuarios" u ON u.id = p.rascunho_por
      ORDER BY p.ordem, p.nome`,
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

/**
 * Slugs das 5 páginas com rota própria em src/main.tsx. Só elas têm um lugar
 * garantido para aparecer no site — por isso não podem ser excluídas nem ter
 * `caminho`/`nome` trocados (o que quebraria a rota fixa). Página nova, criada
 * por aqui, é servida pela rota curinga (PaginaPorCaminho em PaginaCms.tsx),
 * que resolve qualquer `caminho` do banco — essa sim pode ser excluída.
 */
const PAGINAS_FIXAS = new Set(['home', 'servicos', 'simulador', 'sobre', 'contato']);

/** Só um segmento, minúsculo, sem barra dupla — mesmo padrão das 5 fixas. */
const CAMINHO_REGEX = /^\/[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Rotas e pastas que o Express já usa. (Arquivos estáticos com ponto no nome
 * — robots.txt, sw.js, favicon.png — não entram aqui: CAMINHO_REGEX já barra
 * qualquer segmento com ".", então nunca chegariam a esta lista.)
 */
const CAMINHOS_RESERVADOS = new Set(['api', 'sistema', 'p', 'health', 'icons']);

const criarPaginaSchema = z.object({
  nome: z.string().trim().min(1, 'Informe o nome da página.').max(120),
  caminho: z
    .string()
    .trim()
    .min(1, 'Informe o endereço da página.')
    .max(80)
    .regex(CAMINHO_REGEX, 'Use letras minúsculas, números e hífen, começando com "/". Ex.: /pagina-teste'),
});

siteRouter.post(
  '/paginas',
  escrever,
  asyncHandler(async (req: RequestAutenticado, res) => {
    const d = criarPaginaSchema.parse(req.body);
    const slug = d.caminho.slice(1);

    if (CAMINHOS_RESERVADOS.has(slug)) {
      throw conflito('Esse endereço é reservado pelo sistema. Escolha outro.');
    }

    const pagina = await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `INSERT INTO "SolarCosta_SitePaginas"
            (slug, caminho, nome, titulo_seo, descricao_seo, ordem)
         VALUES ($1, $2, $3, $3, $3,
                 (SELECT COALESCE(max(ordem), 0) + 1 FROM "SolarCosta_SitePaginas"))
         RETURNING id, slug, caminho, nome, titulo_seo, descricao_seo, publicada, ordem`,
        [slug, d.caminho, d.nome],
      );

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('criar', 'Site', $1, NULL, $2)`,
        [`Página ${d.nome}`, `Criada em ${d.caminho}`],
      );
      return { ...rows[0], blocos: [] };
    }, ator(req));

    res.status(201).json({ pagina });
  }),
);

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

siteRouter.delete(
  '/paginas/:id',
  escrever,
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);

    await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `SELECT slug, nome FROM "SolarCosta_SitePaginas" WHERE id = $1`,
        [id],
      );
      if (rows.length === 0) throw naoEncontrado('Página');
      if (PAGINAS_FIXAS.has(rows[0]!.slug)) {
        throw conflito('Esta página é fixa do sistema e não pode ser excluída.');
      }

      // Blocos somem junto por ON DELETE CASCADE (V008).
      await cliente.query(`DELETE FROM "SolarCosta_SitePaginas" WHERE id = $1`, [id]);

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('excluir', 'Site', $1, NULL, 'Página removida do site')`,
        [`Página ${rows[0]!.nome}`],
      );
    }, ator(req));

    res.status(204).end();
  }),
);

/* =============================================================== blocos == */

/**
 * Marca o rascunho da página como desatualizado, se houver um.
 *
 * Chamada por TODA escrita ao vivo em blocos, dentro da mesma transação. Sem
 * isso, publicar um snapshot tirado antes da escrita ao vivo ressuscitaria o
 * conteúdo antigo e apagaria o bloco recém-criado (ele não está no snapshot) —
 * perda de dado, e silenciosa.
 *
 * Note que ela INVALIDA, não funde nem apaga. Apagar jogaria fora o trabalho
 * não publicado de outra pessoa a partir de uma tela que nem menciona o
 * editor; fundir seria merge de três vias sem ancestral comum. O que sobra, e
 * é o certo, é recusar a publicação depois e pedir para recarregar.
 */
async function invalidarRascunho(cliente: Cliente, paginaId: string): Promise<void> {
  await cliente.query(
    `UPDATE "SolarCosta_SitePaginas" SET rascunho_desatualizado_em = now()
      WHERE id = $1 AND blocos_rascunho IS NOT NULL`,
    [paginaId],
  );
}

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
      await invalidarRascunho(cliente, paginaId);
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
          RETURNING tipo, pagina_id`,
        [id, d.conteudo ? JSON.stringify(d.conteudo) : null, d.visivel ?? null],
      );
      if (rows.length === 0) throw naoEncontrado('Bloco');

      await invalidarRascunho(cliente, rows[0]!.pagina_id as string);

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
        `DELETE FROM "SolarCosta_SiteBlocos" WHERE id = $1 RETURNING tipo, pagina_id`,
        [id],
      );
      if (rows.length === 0) throw naoEncontrado('Bloco');

      await invalidarRascunho(cliente, rows[0]!.pagina_id as string);

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

      await invalidarRascunho(cliente, paginaId);

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

/* ============================================================= rascunho == */

/**
 * Um bloco dentro do snapshot de rascunho.
 *
 * `ordem` NÃO entra: ela sai da posição no array, mesma filosofia do endpoint
 * de reordenação acima. Enviar as duas coisas abriria a porta para um snapshot
 * cuja ordem do array discorda do campo `ordem`, e não há resposta certa para
 * isso.
 *
 * O `id` vem do cliente (crypto.randomUUID()) porque um bloco criado só no
 * rascunho precisa de identidade estável antes de existir no banco — é o que
 * permite selecioná-lo, editá-lo e reordená-lo no editor sem ter publicado
 * nada. SiteBlocos.id tem DEFAULT gen_random_uuid(), então INSERT com id
 * explícito é legítimo.
 */
const blocoRascunhoSchema = z.object({
  id: z.string().uuid(),
  tipo: z.enum(TIPOS_BLOCO),
  visivel: z.boolean().default(true),
  conteudo: schemaConteudo.default({}),
});

/**
 * Teto do snapshot inteiro. Cada bloco já é limitado a 60 KB por
 * `schemaConteudo`; 100 blocos no limite dariam 6 MB, o que estouraria o
 * express.json({limit:'2mb'}) do app com um erro genérico de parse em vez de
 * uma mensagem útil. 600 KB cabe com folga e é mais do que qualquer página
 * real — a maior do seed não chega a 20 KB.
 */
const rascunhoSchema = z.object({
  blocos: z.array(blocoRascunhoSchema).max(100),
  /** ISO do `rascunho_em` que o cliente acredita estar no banco; null = primeiro salvamento. */
  rascunho_em: z.string().datetime().nullable().optional(),
}).refine(
  (v) => JSON.stringify(v.blocos).length <= 600_000,
  'Rascunho grande demais. Divida o conteúdo em mais de uma página.',
);

interface EstadoRascunho {
  rascunho_em: string | null;
  rascunho_desatualizado_em: string | null;
}

/**
 * Lê o estado do rascunho travando a linha da página (FOR UPDATE).
 *
 * O lock importa: sem ele, dois PUTs simultâneos leriam o mesmo `rascunho_em`,
 * ambos passariam na checagem e o segundo sobrescreveria o primeiro — que é
 * exatamente o que a checagem existe para impedir.
 */
async function travarPagina(cliente: Cliente, paginaId: string): Promise<EstadoRascunho> {
  const { rows } = await cliente.query(
    `SELECT rascunho_em, rascunho_desatualizado_em
       FROM "SolarCosta_SitePaginas" WHERE id = $1 FOR UPDATE`,
    [paginaId],
  );
  if (rows.length === 0) throw naoEncontrado('Página');
  return rows[0] as EstadoRascunho;
}

const MSG_DESATUALIZADO =
  'Esta página mudou fora do editor depois que o rascunho começou. ' +
  'Recarregue para partir do conteúdo que está no ar.';

const MSG_OUTRO_EDITOR =
  'Outra pessoa salvou um rascunho desta página enquanto você editava. ' +
  'Recarregue para ver o que mudou.';

/** `true` quando houve escrita ao vivo depois do último salvamento do rascunho. */
function desatualizado(e: EstadoRascunho): boolean {
  if (!e.rascunho_desatualizado_em || !e.rascunho_em) return false;
  return new Date(e.rascunho_desatualizado_em) > new Date(e.rascunho_em);
}

/**
 * O rascunho de uma página, mais os blocos que estão no ar.
 *
 * Os dois vêm juntos porque o editor precisa dos dois: o rascunho quando
 * existe, e os blocos vivos para SEMEAR o rascunho quando não existe (ou
 * quando o usuário manda recarregar depois de um 409).
 *
 * Exige `gerenciar_site` mesmo sendo um GET: ler conteúdo que ainda não foi
 * publicado está mais perto de escrever do que de ler o site.
 */
siteRouter.get(
  '/paginas/:id/rascunho',
  escrever,
  asyncHandler(async (req, res) => {
    const paginaId = z.string().uuid().parse(req.params.id);

    const pagina = await consultarUm(
      `SELECT p.blocos_rascunho, p.rascunho_em, p.rascunho_desatualizado_em, u.nome AS rascunho_por_nome
         FROM "SolarCosta_SitePaginas" p
         LEFT JOIN "SolarCosta_Usuarios" u ON u.id = p.rascunho_por
        WHERE p.id = $1`,
      [paginaId],
    );
    if (!pagina) throw naoEncontrado('Página');

    const p = pagina as Record<string, unknown>;
    const blocos = await consultar(
      `SELECT id, pagina_id, tipo, ordem, visivel, conteudo
         FROM "SolarCosta_SiteBlocos" WHERE pagina_id = $1 ORDER BY ordem, criado_em`,
      [paginaId],
    );

    res.json({
      blocos,
      rascunho: p.blocos_rascunho
        ? {
            blocos: p.blocos_rascunho,
            rascunho_em: p.rascunho_em,
            rascunho_por_nome: p.rascunho_por_nome,
            desatualizado: desatualizado(p as unknown as EstadoRascunho),
          }
        : null,
    });
  }),
);

/**
 * Salva (ou substitui) o rascunho. Nada vai ao ar aqui.
 *
 * Recusa com 409 em dois casos, ambos recuperáveis recarregando: outra pessoa
 * salvou um rascunho no meio (o `rascunho_em` enviado não bate), ou a tela
 * antiga publicou algo nesta página (`rascunho_desatualizado_em` mais novo).
 */
siteRouter.put(
  '/paginas/:id/rascunho',
  escrever,
  asyncHandler(async (req: RequestAutenticado, res) => {
    const paginaId = z.string().uuid().parse(req.params.id);
    const d = rascunhoSchema.parse(req.body);

    const salvo = await emTransacao(async (cliente) => {
      const atual = await travarPagina(cliente, paginaId);

      const enviado = d.rascunho_em ? new Date(d.rascunho_em).getTime() : null;
      const noBanco = atual.rascunho_em ? new Date(atual.rascunho_em).getTime() : null;
      if (enviado !== noBanco) throw conflito(MSG_OUTRO_EDITOR);
      if (desatualizado(atual)) throw conflito(MSG_DESATUALIZADO);

      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_SitePaginas" SET
            blocos_rascunho = $2::jsonb,
            rascunho_em     = now(),
            rascunho_por    = "SolarCosta_fn_usuario_atual"()
          WHERE id = $1
          RETURNING rascunho_em`,
        [paginaId, JSON.stringify(d.blocos)],
      );
      return rows[0]!.rascunho_em as string;
    }, ator(req));

    res.json({ rascunho_em: salvo });
  }),
);

/** Joga o rascunho fora. O que está no ar não é tocado. */
siteRouter.delete(
  '/paginas/:id/rascunho',
  escrever,
  asyncHandler(async (req: RequestAutenticado, res) => {
    const paginaId = z.string().uuid().parse(req.params.id);

    await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_SitePaginas" SET
            blocos_rascunho = NULL, rascunho_em = NULL,
            rascunho_por = NULL, rascunho_desatualizado_em = NULL
          WHERE id = $1 AND blocos_rascunho IS NOT NULL
          RETURNING nome`,
        [paginaId],
      );
      // Sem rascunho é sucesso, não erro: descartar duas vezes tem o mesmo
      // efeito de descartar uma, e a tela não tem o que fazer com um 404 aqui.
      if (rows.length === 0) return;

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('editar', 'Site', $1, NULL, 'Rascunho descartado')`,
        [`Página ${rows[0]!.nome}`],
      );
    }, ator(req));

    res.status(204).end();
  }),
);

/**
 * Publica o rascunho: reconcilia o snapshot contra SiteBlocos.
 *
 * Tudo-ou-nada por página, numa transação só. Três passos, nesta ordem:
 * apaga os blocos vivos que sumiram do snapshot, insere/atualiza o resto, e
 * renumera `ordem` pela posição no array. O UPDATE/INSERT é sempre restrito a
 * `pagina_id` para que um snapshot adulterado não consiga sequestrar um bloco
 * de outra página.
 */
siteRouter.post(
  '/paginas/:id/publicar',
  escrever,
  asyncHandler(async (req: RequestAutenticado, res) => {
    const paginaId = z.string().uuid().parse(req.params.id);

    const blocos = await emTransacao(async (cliente) => {
      const atual = await travarPagina(cliente, paginaId);
      if (desatualizado(atual)) throw conflito(MSG_DESATUALIZADO);

      const { rows: pag } = await cliente.query(
        `SELECT nome, blocos_rascunho FROM "SolarCosta_SitePaginas" WHERE id = $1`,
        [paginaId],
      );
      if (!pag[0]!.blocos_rascunho) throw conflito('Esta página não tem rascunho para publicar.');

      // Revalida o que saiu do banco: o snapshot foi gravado por uma versão
      // possivelmente anterior desta API, e publicar é quando ele vira o site.
      const doRascunho = z.array(blocoRascunhoSchema).max(100).parse(pag[0]!.blocos_rascunho);
      const ids = doRascunho.map((b) => b.id);

      await cliente.query(
        `DELETE FROM "SolarCosta_SiteBlocos"
          WHERE pagina_id = $1 AND NOT (id = ANY($2::uuid[]))`,
        [paginaId, ids],
      );

      for (const [i, b] of doRascunho.entries()) {
        const { rowCount } = await cliente.query(
          `INSERT INTO "SolarCosta_SiteBlocos"
                 (id, pagina_id, tipo, ordem, visivel, conteudo, atualizado_por)
           VALUES ($1, $2, $3, $4::smallint, $5, $6::jsonb, "SolarCosta_fn_usuario_atual"())
           ON CONFLICT (id) DO UPDATE SET
                 tipo           = EXCLUDED.tipo,
                 ordem          = EXCLUDED.ordem,
                 visivel        = EXCLUDED.visivel,
                 conteudo       = EXCLUDED.conteudo,
                 atualizado_em  = now(),
                 atualizado_por = EXCLUDED.atualizado_por
             WHERE "SolarCosta_SiteBlocos".pagina_id = $2`,
          [b.id, paginaId, b.tipo, i + 1, b.visivel, JSON.stringify(b.conteudo)],
        );
        // O WHERE do DO UPDATE é a trava contra sequestro de bloco de outra
        // página; quando ele barra, o INSERT vira um no-op silencioso. Preferir
        // o 409 a perder o bloco sem avisar.
        if (rowCount === 0) {
          throw conflito('O rascunho referencia um bloco que pertence a outra página.');
        }
      }

      await cliente.query(
        `UPDATE "SolarCosta_SitePaginas" SET
            blocos_rascunho = NULL, rascunho_em = NULL,
            rascunho_por = NULL, rascunho_desatualizado_em = NULL
          WHERE id = $1`,
        [paginaId],
      );

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('editar', 'Site', $1, NULL, $2)`,
        [`Página ${pag[0]!.nome}`, `Publicada pelo editor visual (${doRascunho.length} blocos)`],
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
