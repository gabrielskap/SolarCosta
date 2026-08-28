// Financeiro — boletos e lançamentos de caixa.
//
// Substitui FinancialView. Duas diferenças em relação ao mock:
//   · despesa NÃO é valor negativo: `valor` é sempre positivo e o sinal vem
//     de `tipo`. A view devolve `valor_com_sinal` pronto para gráfico.
//   · dar baixa num boleto gera o lançamento de caixa automaticamente
//     (trigger SolarCosta_tg_boleto_gera_lancamento) — antes eram dois
//     cadastros manuais que divergiam.

import { Router } from 'express';
import { z } from 'zod';
import { consultar, consultarUm, emTransacao } from '../db.js';
import { asyncHandler, naoEncontrado } from '../errors.js';
import { ator, exigirLogin, exigirPermissao, type RequestAutenticado } from '../auth/middleware.js';

export const financeiroRouter = Router();
financeiroRouter.use(exigirLogin, exigirPermissao('ver_lancamentos_financeiro'));

const periodoSchema = z.object({
  de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

/* =============================================================== BOLETOS == */

const boletoSchema = z.object({
  numero_documento: z.string().max(120).nullish(),
  linha_digitavel: z.string().max(120).nullish(),
  nosso_numero: z.string().max(40).nullish(),

  lead_id: z.string().uuid().nullish(),
  contrato_id: z.string().uuid().nullish(),
  obra_id: z.string().uuid().nullish(),
  fornecedor_id: z.string().uuid().nullish(),

  cliente_nome: z.string().min(1, 'Informe o sacado.').max(200),
  cpf_cnpj: z.string().max(20).nullish(),

  valor: z.coerce.number().positive('O valor precisa ser maior que zero.'),
  parcela_numero: z.coerce.number().int().min(1).nullish(),
  parcela_total: z.coerce.number().int().min(1).nullish(),
  parcela_label: z.string().max(40).nullish(),
  vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use AAAA-MM-DD.'),
  tipo: z.enum(['a_receber', 'a_pagar']),
  categoria_id: z.coerce.number().int().nullish(),
  categoria: z.string().nullish(),
  observacoes: z.string().nullish(),
});

financeiroRouter.get(
  '/boletos',
  asyncHandler(async (req, res) => {
    const f = periodoSchema
      .extend({
        situacao: z.enum(['em_aberto', 'pago', 'vencido', 'cancelado']).optional(),
        tipo: z.enum(['a_receber', 'a_pagar']).optional(),
        obra_id: z.string().uuid().optional(),
        lead_id: z.string().uuid().optional(),
      })
      .parse(req.query);

    const cond: string[] = [];
    const params: unknown[] = [];
    if (f.situacao) { params.push(f.situacao); cond.push(`situacao = $${params.length}`); }
    if (f.tipo) { params.push(f.tipo); cond.push(`tipo = $${params.length}`); }
    if (f.obra_id) { params.push(f.obra_id); cond.push(`obra_id = $${params.length}`); }
    if (f.lead_id) { params.push(f.lead_id); cond.push(`lead_id = $${params.length}`); }
    if (f.de) { params.push(f.de); cond.push(`vencimento >= $${params.length}::date`); }
    if (f.ate) { params.push(f.ate); cond.push(`vencimento <= $${params.length}::date`); }

    const boletos = await consultar(
      `SELECT * FROM "SolarCosta_vw_Boletos"
       ${cond.length ? `WHERE ${cond.join(' AND ')}` : ''}
       ORDER BY vencimento`,
      params,
    );

    const resumo = await consultarUm(
      `SELECT
         COALESCE(SUM(valor) FILTER (WHERE tipo='a_receber' AND situacao <> 'pago'), 0) AS a_receber,
         COALESCE(SUM(valor) FILTER (WHERE tipo='a_pagar'   AND situacao <> 'pago'), 0) AS a_pagar,
         COALESCE(SUM(valor) FILTER (WHERE situacao = 'vencido'), 0)                    AS vencido,
         COALESCE(SUM(valor) FILTER (WHERE situacao = 'pago'), 0)                       AS pago
       FROM "SolarCosta_vw_Boletos"`,
    );

    res.json({ boletos, resumo });
  }),
);

financeiroRouter.post(
  '/boletos',
  asyncHandler(async (req: RequestAutenticado, res) => {
    const d = boletoSchema.parse(req.body);

    const boleto = await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `INSERT INTO "SolarCosta_Boletos" (
            numero_documento, linha_digitavel, nosso_numero,
            lead_id, contrato_id, obra_id, fornecedor_id,
            cliente_nome, cpf_cnpj, valor,
            parcela_numero, parcela_total, parcela_label, vencimento,
            tipo, categoria_id, observacoes, criado_por_id
         ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::date,$15,
            COALESCE($16::int, (SELECT id FROM "SolarCosta_CategoriasFinanceiras" WHERE nome = $17)),
            $18,$19
         ) RETURNING id`,
        [
          d.numero_documento ?? null, d.linha_digitavel ?? null, d.nosso_numero ?? null,
          d.lead_id ?? null, d.contrato_id ?? null, d.obra_id ?? null, d.fornecedor_id ?? null,
          d.cliente_nome, d.cpf_cnpj ?? null, d.valor,
          d.parcela_numero ?? null, d.parcela_total ?? null, d.parcela_label ?? null,
          d.vencimento, d.tipo,
          d.categoria_id ?? null, d.categoria ?? null,
          d.observacoes ?? null, req.usuario.id,
        ],
      );
      const id = rows[0]!.id as string;

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('criar','Boleto',$1,$2,NULL)`,
        [`Boleto ${d.parcela_label ?? ''} — ${d.cliente_nome}`, id],
      );

      const { rows: view } = await cliente.query(
        `SELECT * FROM "SolarCosta_vw_Boletos" WHERE id = $1`, [id]);
      return view[0];
    }, ator(req));

    res.status(201).json({ boleto });
  }),
);

// Dar baixa: o trigger cria o lançamento de caixa e audita a operação.
financeiroRouter.patch(
  '/boletos/:id/baixa',
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const d = z
      .object({
        data_pagamento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        valor_pago: z.coerce.number().positive().optional(),
        juros_multa: z.coerce.number().min(0).optional(),
      })
      .parse(req.body ?? {});

    const boleto = await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_Boletos" SET
            situacao       = 'pago',
            data_pagamento = COALESCE($2::date, CURRENT_DATE),
            valor_pago     = COALESCE($3, valor),
            juros_multa    = COALESCE($4, juros_multa)
          WHERE id = $1 AND excluido_em IS NULL AND situacao <> 'pago'
          RETURNING id`,
        [id, d.data_pagamento ?? null, d.valor_pago ?? null, d.juros_multa ?? null],
      );
      if (rows.length === 0) throw naoEncontrado('Boleto em aberto');

      const { rows: view } = await cliente.query(
        `SELECT * FROM "SolarCosta_vw_Boletos" WHERE id = $1`, [id]);
      return view[0];
    }, ator(req));

    res.json({ boleto });
  }),
);

financeiroRouter.patch(
  '/boletos/:id',
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const d = boletoSchema.partial().parse(req.body);

    const boleto = await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_Boletos" SET
            numero_documento = COALESCE($2, numero_documento),
            linha_digitavel  = COALESCE($3, linha_digitavel),
            cliente_nome     = COALESCE($4, cliente_nome),
            cpf_cnpj         = COALESCE($5, cpf_cnpj),
            valor            = COALESCE($6, valor),
            parcela_label    = COALESCE($7, parcela_label),
            vencimento       = COALESCE($8::date, vencimento),
            categoria_id     = COALESCE($9::int, categoria_id),
            obra_id          = COALESCE($10::uuid, obra_id),
            observacoes      = COALESCE($11, observacoes)
          WHERE id = $1 AND excluido_em IS NULL
          RETURNING cliente_nome, parcela_label`,
        [
          id, d.numero_documento ?? null, d.linha_digitavel ?? null, d.cliente_nome ?? null,
          d.cpf_cnpj ?? null, d.valor ?? null, d.parcela_label ?? null, d.vencimento ?? null,
          d.categoria_id ?? null, d.obra_id ?? null, d.observacoes ?? null,
        ],
      );
      if (rows.length === 0) throw naoEncontrado('Boleto');

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('editar','Boleto',$1,$2,NULL)`,
        [`Boleto ${rows[0]!.parcela_label ?? ''} — ${rows[0]!.cliente_nome}`, id],
      );

      const { rows: view } = await cliente.query(
        `SELECT * FROM "SolarCosta_vw_Boletos" WHERE id = $1`, [id]);
      return view[0];
    }, ator(req));

    res.json({ boleto });
  }),
);

financeiroRouter.delete(
  '/boletos/:id',
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);

    await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_Boletos" SET excluido_em = now()
          WHERE id = $1 AND excluido_em IS NULL
          RETURNING cliente_nome, parcela_label`, [id]);
      if (rows.length === 0) throw naoEncontrado('Boleto');

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('excluir','Boleto',$1,$2,NULL)`,
        [`Boleto ${rows[0]!.parcela_label ?? ''} — ${rows[0]!.cliente_nome}`, id],
      );
    }, ator(req));

    res.status(204).end();
  }),
);

/* =========================================================== LANÇAMENTOS == */

financeiroRouter.get(
  '/lancamentos',
  asyncHandler(async (req, res) => {
    const f = periodoSchema
      .extend({
        tipo: z.enum(['receita', 'despesa']).optional(),
        categoria_id: z.coerce.number().int().optional(),
        obra_id: z.string().uuid().optional(),
      })
      .parse(req.query);

    const cond: string[] = [];
    const params: unknown[] = [];
    if (f.tipo) { params.push(f.tipo); cond.push(`tipo = $${params.length}`); }
    if (f.categoria_id) { params.push(f.categoria_id); cond.push(`categoria_id = $${params.length}`); }
    if (f.obra_id) { params.push(f.obra_id); cond.push(`obra_id = $${params.length}`); }
    if (f.de) { params.push(f.de); cond.push(`data >= $${params.length}::date`); }
    if (f.ate) { params.push(f.ate); cond.push(`data <= $${params.length}::date`); }

    const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';

    const [lancamentos, resumo] = await Promise.all([
      consultar(
        `SELECT * FROM "SolarCosta_vw_Lancamentos" ${where} ORDER BY data DESC, criado_em DESC`,
        params,
      ),
      consultarUm(
        `SELECT
           COALESCE(SUM(valor) FILTER (WHERE tipo='receita'), 0) AS receitas,
           COALESCE(SUM(valor) FILTER (WHERE tipo='despesa'), 0) AS despesas,
           COALESCE(SUM(valor) FILTER (WHERE tipo='receita'), 0)
         - COALESCE(SUM(valor) FILTER (WHERE tipo='despesa'), 0) AS saldo
         FROM "SolarCosta_vw_Lancamentos" ${where}`,
        params,
      ),
    ]);

    res.json({ lancamentos, resumo });
  }),
);

financeiroRouter.post(
  '/lancamentos',
  asyncHandler(async (req: RequestAutenticado, res) => {
    const d = z
      .object({
        data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use AAAA-MM-DD.'),
        descricao: z.string().min(1, 'Descreva o lançamento.').max(300),
        // Sempre positivo — o sinal vem de `tipo`.
        valor: z.coerce.number().positive('O valor precisa ser maior que zero.'),
        tipo: z.enum(['receita', 'despesa']),
        categoria_id: z.coerce.number().int().nullish(),
        categoria: z.string().nullish(),
        obra_id: z.string().uuid().nullish(),
        lead_id: z.string().uuid().nullish(),
        forma: z.enum(['pix', 'boleto', 'cartao', 'transferencia', 'dinheiro']).nullish(),
        observacoes: z.string().nullish(),
      })
      .parse(req.body);

    const lancamento = await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `INSERT INTO "SolarCosta_LancamentosFinanceiros"
            (data, descricao, categoria_id, obra_id, lead_id, tipo, valor, forma, observacoes, usuario_id)
         VALUES (
            $1::date, $2,
            COALESCE($3::int, (SELECT id FROM "SolarCosta_CategoriasFinanceiras" WHERE nome = $4)),
            $5, $6, $7, $8, $9, $10, $11
         ) RETURNING id`,
        [
          d.data, d.descricao, d.categoria_id ?? null, d.categoria ?? null,
          d.obra_id ?? null, d.lead_id ?? null, d.tipo, d.valor,
          d.forma ?? null, d.observacoes ?? null, req.usuario.id,
        ],
      );
      const id = rows[0]!.id as string;

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('criar','Lançamento',$1,$2,$3)`,
        [
          d.descricao, id,
          `${d.tipo === 'receita' ? 'Entrada' : 'Saída'} · R$ ${d.valor.toFixed(2)}`,
        ],
      );

      const { rows: view } = await cliente.query(
        `SELECT * FROM "SolarCosta_vw_Lancamentos" WHERE id = $1`, [id]);
      return view[0];
    }, ator(req));

    res.status(201).json({ lancamento });
  }),
);

financeiroRouter.delete(
  '/lancamentos/:id',
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);

    await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_LancamentosFinanceiros" SET excluido_em = now()
          WHERE id = $1 AND excluido_em IS NULL RETURNING descricao`, [id]);
      if (rows.length === 0) throw naoEncontrado('Lançamento');

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('excluir','Lançamento',$1,$2,NULL)`,
        [rows[0]!.descricao, id],
      );
    }, ator(req));

    res.status(204).end();
  }),
);

/* ================================================================ APOIO == */

financeiroRouter.get(
  '/categorias',
  asyncHandler(async (_req, res) => {
    const categorias = await consultar(
      `SELECT id, nome, escopo, cor FROM "SolarCosta_CategoriasFinanceiras"
        WHERE ativo ORDER BY ordem`);
    res.json({ categorias });
  }),
);

financeiroRouter.get(
  '/despesas-por-categoria',
  asyncHandler(async (_req, res) => {
    const despesas = await consultar(`SELECT * FROM "SolarCosta_vw_DespesasPorCategoria"`);
    res.json({ despesas });
  }),
);
