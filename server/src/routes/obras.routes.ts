// Obras — pós-venda, instalação e homologação.
//
// Substitui ObrasView. Três coisas ficaram no banco de propósito:
//   · progresso da etapa e flag de atraso   -> SolarCosta_vw_ObrasPainel
//   · histórico ao mudar de etapa           -> SolarCosta_tg_obra_mudanca_etapa
//   · baixa de estoque idempotente          -> SolarCosta_fn_baixar_estoque_obra

import { Router } from 'express';
import { z } from 'zod';
import { consultar, consultarUm, emTransacao } from '../db.js';
import { asyncHandler, naoEncontrado } from '../errors.js';
import { ator, exigirLogin, exigirPermissao, type RequestAutenticado } from '../auth/middleware.js';

export const obrasRouter = Router();
obrasRouter.use(exigirLogin);

const ETAPAS = [
  'Aguardando compra',
  'Projeto / ART',
  'Homologação',
  'Instalação',
  'Vistoria / troca',
  'Concluída',
] as const;

const obraSchema = z.object({
  contrato_id: z.string().uuid().nullish(),
  lead_id: z.string().uuid().nullish(),
  proposta_id: z.string().uuid().nullish(),

  cliente_nome: z.string().min(1, 'Informe o cliente.').max(200),
  cidade: z.string().max(120).nullish(),
  endereco: z.string().max(300).nullish(),
  concessionaria_id: z.coerce.number().int().nullish(),
  concessionaria: z.string().nullish(),

  potencia_kwp: z.coerce.number().min(0).default(0),
  modulos_qtd: z.coerce.number().int().min(0).default(0),
  modulo_modelo: z.string().max(200).nullish(),
  inversor_modelo: z.string().max(200).nullish(),

  responsavel_tecnico_id: z.string().uuid().nullish(),
  responsavel_tecnico: z.string().nullish(),
  equipe_instalacao: z.string().max(200).nullish(),

  etapa: z.enum(ETAPAS).default('Aguardando compra'),
  valor_obra: z.coerce.number().min(0).default(0),
  data_inicio: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  previsao_conclusao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
  observacoes: z.string().nullish(),

  kit: z
    .array(
      z.object({
        produto_id: z.string().uuid().nullish(),
        descricao: z.string().min(1).max(300),
        qtd: z.coerce.number().positive(),
        valor_unit: z.coerce.number().min(0).default(0),
      }),
    )
    .default([]),

  // Baixa o kit no estoque já na criação, dentro da MESMA transação. Se o
  // saldo não bastar, a obra inteira é revertida — nunca fica obra criada com
  // estoque por baixar, nem estoque consumido sem obra.
  baixar_estoque: z.boolean().default(false),
});

async function carregarObra(id: string) {
  const obra = await consultarUm(
    `SELECT * FROM "SolarCosta_vw_ObrasPainel" WHERE id = $1`, [id]);
  if (!obra) throw naoEncontrado('Obra');

  const [homologacao, kit, historico] = await Promise.all([
    consultarUm(`SELECT * FROM "SolarCosta_ObraHomologacao" WHERE obra_id = $1`, [id]),
    consultar(
      `SELECT k.id, k.produto_id, k.descricao, k.qtd, k.valor_unit, k.total, k.ordem,
              p.codigo AS produto_codigo, p.estoque AS estoque_atual
         FROM "SolarCosta_ObraKitItens" k
         LEFT JOIN "SolarCosta_Produtos" p ON p.id = k.produto_id
        WHERE k.obra_id = $1 ORDER BY k.ordem`,
      [id],
    ),
    consultar(
      `SELECT id, descricao, etapa::text AS etapa, usuario_nome, ocorrido_em
         FROM "SolarCosta_ObraHistorico" WHERE obra_id = $1 ORDER BY ocorrido_em DESC`,
      [id],
    ),
  ]);

  return { ...obra, homologacao, kit, historico };
}

// -------------------------------------------------------------- LISTAGEM ---
obrasRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const f = z
      .object({
        etapa: z.enum(ETAPAS).optional(),
        status: z.enum(['em_andamento', 'concluida', 'atrasada', 'pausada']).optional(),
        responsavel_tecnico_id: z.string().uuid().optional(),
        apenas_atrasadas: z.coerce.boolean().optional(),
      })
      .parse(req.query);

    const cond: string[] = [];
    const params: unknown[] = [];
    if (f.etapa) { params.push(f.etapa); cond.push(`etapa = $${params.length}`); }
    if (f.status) { params.push(f.status); cond.push(`status = $${params.length}`); }
    if (f.responsavel_tecnico_id) {
      params.push(f.responsavel_tecnico_id);
      cond.push(`responsavel_tecnico_id = $${params.length}`);
    }
    if (f.apenas_atrasadas) cond.push('atrasada');

    const obras = await consultar(
      `SELECT * FROM "SolarCosta_vw_ObrasPainel"
       ${cond.length ? `WHERE ${cond.join(' AND ')}` : ''}
       ORDER BY previsao_conclusao NULLS LAST, numero`,
      params,
    );
    res.json({ obras });
  }),
);

obrasRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    res.json({ obra: await carregarObra(id) });
  }),
);

// ----------------------------------------------------------------- CRIAR ---
obrasRouter.post(
  '/',
  exigirPermissao('gerenciar_obras'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const d = obraSchema.parse(req.body);

    const id = await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `INSERT INTO "SolarCosta_Obras" (
            contrato_id, lead_id, proposta_id, cliente_nome, cidade, endereco,
            concessionaria_id, potencia_kwp, modulos_qtd, modulo_modelo, inversor_modelo,
            responsavel_tecnico_id, equipe_instalacao, etapa, valor_obra,
            data_inicio, previsao_conclusao, observacoes
         ) VALUES (
            $1,$2,$3,$4,$5,$6,
            COALESCE($7::int, (SELECT id FROM "SolarCosta_Concessionarias" WHERE nome = $8)),
            $9,$10,$11,$12,
            COALESCE($13::uuid, (SELECT id FROM "SolarCosta_Usuarios" WHERE nome = $14 AND excluido_em IS NULL)),
            $15,$16,$17,$18::date,$19::date,$20
         ) RETURNING id, numero`,
        [
          d.contrato_id ?? null, d.lead_id ?? null, d.proposta_id ?? null,
          d.cliente_nome, d.cidade ?? null, d.endereco ?? null,
          d.concessionaria_id ?? null, d.concessionaria ?? null,
          d.potencia_kwp, d.modulos_qtd, d.modulo_modelo ?? null, d.inversor_modelo ?? null,
          d.responsavel_tecnico_id ?? null, d.responsavel_tecnico ?? null,
          d.equipe_instalacao ?? null, d.etapa, d.valor_obra,
          d.data_inicio ?? null, d.previsao_conclusao ?? null, d.observacoes ?? null,
        ],
      );
      const novoId = rows[0]!.id as string;

      for (const [i, item] of d.kit.entries()) {
        await cliente.query(
          `INSERT INTO "SolarCosta_ObraKitItens" (obra_id, produto_id, descricao, qtd, valor_unit, ordem)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [novoId, item.produto_id ?? null, item.descricao, item.qtd, item.valor_unit, i + 1],
        );
      }

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('criar','Obra',$1,$2,NULL)`,
        [`${rows[0]!.numero} — ${d.cliente_nome}`, novoId],
      );

      if (d.baixar_estoque && d.kit.length > 0) {
        // Estoque insuficiente levanta check_violation aqui e reverte a obra.
        await cliente.query(`SELECT "SolarCosta_fn_baixar_estoque_obra"($1)`, [novoId]);
      }

      return novoId;
    }, ator(req));

    res.status(201).json({ obra: await carregarObra(id) });
  }),
);

// ---------------------------------------------------------------- EDITAR ---
obrasRouter.patch(
  '/:id',
  exigirPermissao('gerenciar_obras'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const d = obraSchema.partial().parse(req.body);

    await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_Obras" SET
            cliente_nome      = COALESCE($2, cliente_nome),
            cidade            = COALESCE($3, cidade),
            endereco          = COALESCE($4, endereco),
            concessionaria_id = COALESCE($5::int, concessionaria_id),
            potencia_kwp      = COALESCE($6, potencia_kwp),
            modulos_qtd       = COALESCE($7, modulos_qtd),
            modulo_modelo     = COALESCE($8, modulo_modelo),
            inversor_modelo   = COALESCE($9, inversor_modelo),
            responsavel_tecnico_id = COALESCE($10::uuid, responsavel_tecnico_id),
            equipe_instalacao = COALESCE($11, equipe_instalacao),
            valor_obra        = COALESCE($12, valor_obra),
            data_inicio       = COALESCE($13::date, data_inicio),
            previsao_conclusao= COALESCE($14::date, previsao_conclusao),
            observacoes       = COALESCE($15, observacoes)
          WHERE id = $1 AND excluido_em IS NULL
          RETURNING numero, cliente_nome`,
        [
          id, d.cliente_nome ?? null, d.cidade ?? null, d.endereco ?? null,
          d.concessionaria_id ?? null, d.potencia_kwp ?? null, d.modulos_qtd ?? null,
          d.modulo_modelo ?? null, d.inversor_modelo ?? null,
          d.responsavel_tecnico_id ?? null, d.equipe_instalacao ?? null,
          d.valor_obra ?? null, d.data_inicio ?? null, d.previsao_conclusao ?? null,
          d.observacoes ?? null,
        ],
      );
      if (rows.length === 0) throw naoEncontrado('Obra');

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('editar','Obra',$1,$2,NULL)`,
        [`${rows[0]!.numero} — ${rows[0]!.cliente_nome}`, id],
      );
    }, ator(req));

    res.json({ obra: await carregarObra(id) });
  }),
);

// ----------------------------------------------------------------- ETAPA ---
// Histórico e auditoria saem do trigger; concluir ajusta status e data sozinho.
obrasRouter.patch(
  '/:id/etapa',
  exigirPermissao('gerenciar_obras'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { etapa } = z.object({ etapa: z.enum(ETAPAS) }).parse(req.body);

    await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_Obras" SET etapa = $2
          WHERE id = $1 AND excluido_em IS NULL RETURNING id`,
        [id, etapa],
      );
      if (rows.length === 0) throw naoEncontrado('Obra');
    }, ator(req));

    res.json({ obra: await carregarObra(id) });
  }),
);

// ----------------------------------------------------------- HOMOLOGAÇÃO ---
obrasRouter.patch(
  '/:id/homologacao',
  exigirPermissao('gerenciar_obras'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const d = z
      .object({
        solicitacao_acesso: z.boolean().optional(),
        parecer_acesso: z.boolean().optional(),
        vistoria_agendada: z.boolean().optional(),
        vistoria_aprovada: z.boolean().optional(),
        troca_medidor: z.boolean().optional(),
        relatorio_conexao: z.boolean().optional(),
        protocolo_distribuidora: z.string().max(120).nullish(),
      })
      .parse(req.body);

    await emTransacao(async (cliente) => {
      // Marcar um item registra a data; desmarcar limpa.
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_ObraHomologacao" SET
            solicitacao_acesso    = COALESCE($2, solicitacao_acesso),
            solicitacao_acesso_em = CASE WHEN $2 IS NULL THEN solicitacao_acesso_em
                                         WHEN $2 THEN COALESCE(solicitacao_acesso_em, CURRENT_DATE) END,
            parecer_acesso        = COALESCE($3, parecer_acesso),
            parecer_acesso_em     = CASE WHEN $3 IS NULL THEN parecer_acesso_em
                                         WHEN $3 THEN COALESCE(parecer_acesso_em, CURRENT_DATE) END,
            vistoria_agendada     = COALESCE($4, vistoria_agendada),
            vistoria_agendada_em  = CASE WHEN $4 IS NULL THEN vistoria_agendada_em
                                         WHEN $4 THEN COALESCE(vistoria_agendada_em, CURRENT_DATE) END,
            vistoria_aprovada     = COALESCE($5, vistoria_aprovada),
            vistoria_aprovada_em  = CASE WHEN $5 IS NULL THEN vistoria_aprovada_em
                                         WHEN $5 THEN COALESCE(vistoria_aprovada_em, CURRENT_DATE) END,
            troca_medidor         = COALESCE($6, troca_medidor),
            troca_medidor_em      = CASE WHEN $6 IS NULL THEN troca_medidor_em
                                         WHEN $6 THEN COALESCE(troca_medidor_em, CURRENT_DATE) END,
            relatorio_conexao     = COALESCE($7, relatorio_conexao),
            relatorio_conexao_em  = CASE WHEN $7 IS NULL THEN relatorio_conexao_em
                                         WHEN $7 THEN COALESCE(relatorio_conexao_em, CURRENT_DATE) END,
            protocolo_distribuidora = COALESCE($8, protocolo_distribuidora)
          WHERE obra_id = $1
          RETURNING obra_id`,
        [
          id, d.solicitacao_acesso ?? null, d.parecer_acesso ?? null,
          d.vistoria_agendada ?? null, d.vistoria_aprovada ?? null,
          d.troca_medidor ?? null, d.relatorio_conexao ?? null,
          d.protocolo_distribuidora ?? null,
        ],
      );
      if (rows.length === 0) throw naoEncontrado('Checklist da obra');

      await cliente.query(
        `INSERT INTO "SolarCosta_ObraHistorico" (obra_id, descricao, usuario_id, usuario_nome)
         VALUES ($1, 'Checklist de homologação atualizado.',
                 "SolarCosta_fn_usuario_atual"(), "SolarCosta_fn_usuario_atual_nome"())`,
        [id],
      );
    }, ator(req));

    res.json({ obra: await carregarObra(id) });
  }),
);

// ------------------------------------------------------- BAIXA DE ESTOQUE ---
obrasRouter.post(
  '/:id/baixar-estoque',
  exigirPermissao('gerenciar_obras'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);

    // A função é idempotente: chamar duas vezes devolve 0 e não baixa de novo.
    // Estoque insuficiente vira check_violation -> 422 com a mensagem do banco.
    const itens = await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `SELECT "SolarCosta_fn_baixar_estoque_obra"($1) AS itens`, [id]);
      return rows[0]!.itens as number;
    }, ator(req));

    res.json({
      itens_baixados: itens,
      ja_baixado: itens === 0,
      obra: await carregarObra(id),
    });
  }),
);

// -------------------------------------------------------------- HISTÓRICO ---
obrasRouter.post(
  '/:id/historico',
  exigirPermissao('gerenciar_obras'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { descricao } = z.object({ descricao: z.string().min(1) }).parse(req.body);

    const registro = await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `INSERT INTO "SolarCosta_ObraHistorico" (obra_id, descricao, etapa, usuario_id, usuario_nome)
         SELECT $1, $2, o.etapa, "SolarCosta_fn_usuario_atual"(), "SolarCosta_fn_usuario_atual_nome"()
           FROM "SolarCosta_Obras" o WHERE o.id = $1 AND o.excluido_em IS NULL
         RETURNING id, descricao, usuario_nome, ocorrido_em`,
        [id, descricao],
      );
      if (rows.length === 0) throw naoEncontrado('Obra');
      return rows[0];
    }, ator(req));

    res.status(201).json({ registro });
  }),
);

obrasRouter.delete(
  '/:id',
  exigirPermissao('gerenciar_obras'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);

    await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_Obras" SET excluido_em = now()
          WHERE id = $1 AND excluido_em IS NULL RETURNING numero, cliente_nome`, [id]);
      if (rows.length === 0) throw naoEncontrado('Obra');

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('excluir','Obra',$1,$2,NULL)`,
        [`${rows[0]!.numero} — ${rows[0]!.cliente_nome}`, id],
      );
    }, ator(req));

    res.status(204).end();
  }),
);
