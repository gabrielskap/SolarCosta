// Fornecedores, produtos e movimentação de estoque.
//
// Substitui SuppliersProductsView + StorageService.baixarEstoqueKit.
// O saldo NUNCA é escrito direto: só entra movimento, e o trigger
// SolarCosta_tg_movimentacao_estoque atualiza o produto e recusa negativo.

import { Router } from 'express';
import { z } from 'zod';
import { consultar, consultarUm, emTransacao } from '../db.js';
import { asyncHandler, naoEncontrado } from '../errors.js';
import { ator, exigirLogin, type RequestAutenticado } from '../auth/middleware.js';

export const catalogoRouter = Router();
catalogoRouter.use(exigirLogin);

/* ========================================================== FORNECEDORES == */

const fornecedorSchema = z.object({
  nome: z.string().min(1, 'Informe o nome.').max(200),
  cnpj: z.string().max(20).nullish(),
  cidade: z.string().max(120).nullish(),
  uf: z.string().length(2).nullish(),
  contato: z.string().max(200).nullish(),
  telefone: z.string().max(30).nullish(),
  email: z.string().email('E-mail inválido.').nullish().or(z.literal('')),
  site: z.string().max(200).nullish(),
  prazo_entrega: z.string().max(120).nullish(),
  observacoes: z.string().nullish(),
  ativo: z.boolean().default(true),
});

catalogoRouter.get(
  '/fornecedores',
  asyncHandler(async (_req, res) => {
    const fornecedores = await consultar(
      `SELECT * FROM "SolarCosta_vw_Fornecedores" ORDER BY nome`,
    );
    res.json({ fornecedores });
  }),
);

catalogoRouter.post(
  '/fornecedores',
  asyncHandler(async (req: RequestAutenticado, res) => {
    const d = fornecedorSchema.parse(req.body);

    const fornecedor = await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `INSERT INTO "SolarCosta_Fornecedores"
            (nome, cnpj, cidade, uf, contato, telefone, email, site, prazo_entrega, observacoes, ativo)
         VALUES ($1,$2,$3,$4,$5,$6,NULLIF($7,'')::citext,$8,$9,$10,$11)
         RETURNING id`,
        [d.nome, d.cnpj ?? null, d.cidade ?? null, d.uf ?? null, d.contato ?? null,
         d.telefone ?? null, d.email ?? null, d.site ?? null, d.prazo_entrega ?? null,
         d.observacoes ?? null, d.ativo],
      );
      const id = rows[0]!.id as string;
      await cliente.query(`SELECT "SolarCosta_fn_auditar"('criar','Fornecedor',$1,$2,NULL)`, [d.nome, id]);

      const { rows: view } = await cliente.query(
        `SELECT * FROM "SolarCosta_vw_Fornecedores" WHERE id = $1`, [id]);
      return view[0];
    }, ator(req));

    res.status(201).json({ fornecedor });
  }),
);

catalogoRouter.patch(
  '/fornecedores/:id',
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const d = fornecedorSchema.partial().parse(req.body);

    const fornecedor = await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_Fornecedores" SET
            nome          = COALESCE($2, nome),
            cnpj          = COALESCE($3, cnpj),
            cidade        = COALESCE($4, cidade),
            uf            = COALESCE($5, uf),
            contato       = COALESCE($6, contato),
            telefone      = COALESCE($7, telefone),
            email         = COALESCE(NULLIF($8,'')::citext, email),
            site          = COALESCE($9, site),
            prazo_entrega = COALESCE($10, prazo_entrega),
            observacoes   = COALESCE($11, observacoes),
            ativo         = COALESCE($12, ativo)
          WHERE id = $1
          RETURNING nome`,
        [id, d.nome ?? null, d.cnpj ?? null, d.cidade ?? null, d.uf ?? null, d.contato ?? null,
         d.telefone ?? null, d.email ?? null, d.site ?? null, d.prazo_entrega ?? null,
         d.observacoes ?? null, d.ativo ?? null],
      );
      if (rows.length === 0) throw naoEncontrado('Fornecedor');
      await cliente.query(`SELECT "SolarCosta_fn_auditar"('editar','Fornecedor',$1,$2,NULL)`, [rows[0]!.nome, id]);

      const { rows: view } = await cliente.query(
        `SELECT * FROM "SolarCosta_vw_Fornecedores" WHERE id = $1`, [id]);
      return view[0];
    }, ator(req));

    res.json({ fornecedor });
  }),
);

catalogoRouter.delete(
  '/fornecedores/:id',
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);

    await emTransacao(async (cliente) => {
      // Soft delete: produtos vinculados manteriam a referência órfã.
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_Fornecedores" SET ativo = false WHERE id = $1 RETURNING nome`, [id]);
      if (rows.length === 0) throw naoEncontrado('Fornecedor');
      await cliente.query(`SELECT "SolarCosta_fn_auditar"('excluir','Fornecedor',$1,$2,NULL)`, [rows[0]!.nome, id]);
    }, ator(req));

    res.status(204).end();
  }),
);

/* ============================================================== PRODUTOS == */

const produtoSchema = z.object({
  codigo: z.string().min(1, 'Informe o código.').max(40),
  nome: z.string().min(1, 'Informe o nome.').max(200),
  tipo_codigo: z.enum(['modulo', 'inversor', 'estrutura', 'cabo', 'protecao', 'acessorio', 'outro']),
  fornecedor_id: z.string().uuid().nullish(),
  preco: z.coerce.number().min(0).default(0),
  estoque_minimo: z.coerce.number().min(0).default(0),
  unidade: z.string().max(20).default('un'),
  potencia_wp: z.coerce.number().int().positive().nullish(),
  ncm: z.string().max(20).nullish(),
  ativo: z.boolean().default(true),
});

catalogoRouter.get(
  '/produtos',
  asyncHandler(async (req, res) => {
    const f = z
      .object({
        tipo: z.string().optional(),
        fornecedor_id: z.string().uuid().optional(),
        busca: z.string().trim().min(1).optional(),
        apenas_criticos: z.coerce.boolean().optional(),
      })
      .parse(req.query);

    const cond: string[] = ['ativo'];
    const params: unknown[] = [];

    if (f.tipo) { params.push(f.tipo); cond.push(`tipo_codigo = $${params.length}`); }
    if (f.fornecedor_id) { params.push(f.fornecedor_id); cond.push(`fornecedor_id = $${params.length}`); }
    if (f.apenas_criticos) cond.push(`situacao_estoque IN ('critico','baixo')`);
    if (f.busca) {
      params.push(f.busca);
      cond.push(`("SolarCosta_fn_sem_acento"(nome) LIKE '%' || "SolarCosta_fn_sem_acento"($${params.length}) || '%'
                  OR codigo ILIKE '%' || $${params.length} || '%')`);
    }

    const produtos = await consultar(
      `SELECT * FROM "SolarCosta_vw_Produtos" WHERE ${cond.join(' AND ')} ORDER BY nome`,
      params,
    );
    res.json({ produtos });
  }),
);

catalogoRouter.post(
  '/produtos',
  asyncHandler(async (req: RequestAutenticado, res) => {
    const d = produtoSchema.parse(req.body);
    const estoqueInicial = z.coerce.number().min(0).default(0).parse(req.body?.estoque ?? 0);

    const produto = await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `INSERT INTO "SolarCosta_Produtos"
            (codigo, nome, tipo_codigo, fornecedor_id, preco, estoque, estoque_minimo, unidade, potencia_wp, ncm, ativo)
         VALUES ($1,$2,$3,$4,$5,0,$6,$7,$8,$9,$10)
         RETURNING id`,
        [d.codigo, d.nome, d.tipo_codigo, d.fornecedor_id ?? null, d.preco,
         d.estoque_minimo, d.unidade, d.potencia_wp ?? null, d.ncm ?? null, d.ativo],
      );
      const id = rows[0]!.id as string;

      // Saldo inicial entra como movimento, para o razão fechar desde o começo.
      if (estoqueInicial > 0) {
        await cliente.query(
          `INSERT INTO "SolarCosta_MovimentacoesEstoque"
              (produto_id, tipo, quantidade, saldo_anterior, saldo_novo, custo_unitario, origem_tipo, usuario_id, observacao)
           VALUES ($1,'entrada',$2,0,0,$3,'ajuste_manual',"SolarCosta_fn_usuario_atual"(),'Saldo inicial do cadastro')`,
          [id, estoqueInicial, d.preco],
        );
      }

      await cliente.query(`SELECT "SolarCosta_fn_auditar"('criar','Produto',$1,$2,NULL)`, [d.nome, id]);

      const { rows: view } = await cliente.query(
        `SELECT * FROM "SolarCosta_vw_Produtos" WHERE id = $1`, [id]);
      return view[0];
    }, ator(req));

    res.status(201).json({ produto });
  }),
);

catalogoRouter.patch(
  '/produtos/:id',
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const d = produtoSchema.partial().parse(req.body);

    const produto = await emTransacao(async (cliente) => {
      // `estoque` de propósito fora do UPDATE: só muda por movimentação.
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_Produtos" SET
            codigo         = COALESCE($2, codigo),
            nome           = COALESCE($3, nome),
            tipo_codigo    = COALESCE($4, tipo_codigo),
            fornecedor_id  = COALESCE($5::uuid, fornecedor_id),
            preco          = COALESCE($6, preco),
            estoque_minimo = COALESCE($7, estoque_minimo),
            unidade        = COALESCE($8, unidade),
            potencia_wp    = COALESCE($9::int, potencia_wp),
            ncm            = COALESCE($10, ncm),
            ativo          = COALESCE($11, ativo)
          WHERE id = $1
          RETURNING nome`,
        [id, d.codigo ?? null, d.nome ?? null, d.tipo_codigo ?? null, d.fornecedor_id ?? null,
         d.preco ?? null, d.estoque_minimo ?? null, d.unidade ?? null, d.potencia_wp ?? null,
         d.ncm ?? null, d.ativo ?? null],
      );
      if (rows.length === 0) throw naoEncontrado('Produto');
      await cliente.query(`SELECT "SolarCosta_fn_auditar"('editar','Produto',$1,$2,NULL)`, [rows[0]!.nome, id]);

      const { rows: view } = await cliente.query(
        `SELECT * FROM "SolarCosta_vw_Produtos" WHERE id = $1`, [id]);
      return view[0];
    }, ator(req));

    res.json({ produto });
  }),
);

catalogoRouter.delete(
  '/produtos/:id',
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);

    await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_Produtos" SET ativo = false WHERE id = $1 RETURNING nome`, [id]);
      if (rows.length === 0) throw naoEncontrado('Produto');
      await cliente.query(`SELECT "SolarCosta_fn_auditar"('excluir','Produto',$1,$2,NULL)`, [rows[0]!.nome, id]);
    }, ator(req));

    res.status(204).end();
  }),
);

/* ============================================================== ESTOQUE == */

catalogoRouter.get(
  '/produtos/:id/movimentacoes',
  asyncHandler(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const movimentacoes = await consultar(
      `SELECT m.id, m.tipo::text AS tipo, m.quantidade, m.saldo_anterior, m.saldo_novo,
              m.custo_unitario, m.origem_tipo, m.origem_id, m.observacao, m.criado_em,
              u.nome AS usuario_nome
         FROM "SolarCosta_MovimentacoesEstoque" m
         LEFT JOIN "SolarCosta_Usuarios" u ON u.id = m.usuario_id
        WHERE m.produto_id = $1
        ORDER BY m.criado_em DESC
        LIMIT 200`,
      [id],
    );
    res.json({ movimentacoes });
  }),
);

catalogoRouter.post(
  '/movimentacoes',
  asyncHandler(async (req: RequestAutenticado, res) => {
    const d = z
      .object({
        produto_id: z.string().uuid(),
        tipo: z.enum(['entrada', 'saida', 'ajuste', 'devolucao']),
        // Em 'ajuste', a quantidade é o saldo desejado (pode ser 0).
        quantidade: z.coerce.number().min(0),
        custo_unitario: z.coerce.number().min(0).nullish(),
        observacao: z.string().max(500).nullish(),
      })
      .parse(req.body);

    const resultado = await emTransacao(async (cliente) => {
      // Se o estoque ficar negativo, o trigger levanta check_violation e o
      // middleware traduz a mensagem para a tela.
      await cliente.query(
        `INSERT INTO "SolarCosta_MovimentacoesEstoque"
            (produto_id, tipo, quantidade, saldo_anterior, saldo_novo, custo_unitario,
             origem_tipo, usuario_id, observacao)
         VALUES ($1,$2,$3,0,0,$4,'ajuste_manual',"SolarCosta_fn_usuario_atual"(),$5)`,
        [d.produto_id, d.tipo, d.quantidade, d.custo_unitario ?? null, d.observacao ?? null],
      );

      const { rows } = await cliente.query(
        `SELECT * FROM "SolarCosta_vw_Produtos" WHERE id = $1`, [d.produto_id]);
      if (rows.length === 0) throw naoEncontrado('Produto');
      return rows[0];
    }, ator(req));

    res.status(201).json({ produto: resultado });
  }),
);

catalogoRouter.get(
  '/estoque/critico',
  asyncHandler(async (_req, res) => {
    const produtos = await consultar(`SELECT * FROM "SolarCosta_vw_EstoqueCritico"`);
    res.json({ produtos });
  }),
);

/* ================================================== TABELAS DE APOIO ===== */

catalogoRouter.get(
  '/tipos-produto',
  asyncHandler(async (_req, res) => {
    const tipos = await consultar(
      `SELECT codigo, label FROM "SolarCosta_TiposProduto" WHERE ativo ORDER BY ordem`);
    res.json({ tipos });
  }),
);
