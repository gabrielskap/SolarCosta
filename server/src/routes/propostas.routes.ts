// Propostas comerciais.
//
// Substitui ProposalCalculatorView + StorageService.saveProposta.
// Os valores calculados (potência, geração, economia, payback) são PERSISTIDOS:
// a proposta impressa não pode mudar porque alguém alterou um parâmetro global
// depois. Quem calcula continua sendo o front — o banco guarda o resultado.

import { Router } from 'express';
import { z } from 'zod';
import { consultar, consultarUm, emTransacao } from '../db.js';
import { asyncHandler, naoEncontrado, AppError } from '../errors.js';
import { ator, exigirLogin, exigirPermissao, type RequestAutenticado } from '../auth/middleware.js';

export const propostasRouter = Router();
propostasRouter.use(exigirLogin);

const itemSchema = z.object({
  produto_id: z.string().uuid().nullish(),
  descricao: z.string().min(1, 'Descreva o item.').max(300),
  qtd: z.coerce.number().positive('Quantidade deve ser maior que zero.'),
  valor_unit: z.coerce.number().min(0),
});

const propostaSchema = z.object({
  lead_id: z.string().uuid().nullish(),
  cliente_nome: z.string().min(1, 'Informe o cliente.').max(200),
  cpf_cnpj: z.string().max(20).nullish(),
  telefone: z.string().max(30).nullish(),
  email: z.string().email('E-mail inválido.').nullish().or(z.literal('')),
  endereco: z.string().max(300).nullish(),
  cidade: z.string().max(120).nullish(),
  concessionaria_id: z.coerce.number().int().nullish(),
  concessionaria: z.string().nullish(),
  tipo_telhado_id: z.coerce.number().int().nullish(),
  telhado: z.string().nullish(),

  // Entradas do dimensionamento
  consumo_kwh: z.coerce.number().positive('Consumo deve ser maior que zero.'),
  tarifa_kwh: z.coerce.number().positive('Tarifa deve ser maior que zero.'),
  hsp: z.coerce.number().positive(),
  perdas_pct: z.coerce.number().min(0).max(99.9),
  modulo_wp: z.coerce.number().int().positive(),

  // Resultados do cálculo
  potencia_kwp: z.coerce.number().min(0),
  modulos_qtd: z.coerce.number().int().min(0),
  area_estimada_m2: z.coerce.number().min(0).nullish(),
  geracao_media_kwh: z.coerce.number().min(0).nullish(),
  cobertura_pct: z.coerce.number().min(0).nullish(),
  economia_mensal: z.coerce.number().min(0).nullish(),
  economia_anual: z.coerce.number().min(0).nullish(),
  economia_25_anos: z.coerce.number().min(0).nullish(),
  payback_anos: z.coerce.number().min(0).nullish(),

  // Condições comerciais
  forma_pagamento: z.enum(['avista', 'cartao', 'financiamento']),
  desconto_avista_pct: z.coerce.number().min(0).max(100).nullish(),
  parcelas_cartao: z.coerce.number().int().min(1).nullish(),
  taxa_cartao_pct: z.coerce.number().min(0).nullish(),
  entrada_financiamento_valor: z.coerce.number().min(0).nullish(),
  entrada_financiamento_pct: z.coerce.number().min(0).max(100).nullish(),
  parcelas_financiamento: z.coerce.number().int().min(1).nullish(),
  juros_financiamento_mes_pct: z.coerce.number().min(0).nullish(),
  banco_financiamento_id: z.coerce.number().int().nullish(),

  observacoes: z.string().nullish(),
  logo_customizada_url: z.string().nullish(),
  validade_dias: z.coerce.number().int().positive().default(10),

  itens: z.array(itemSchema).min(1, 'A proposta precisa de pelo menos um item.'),
});

async function carregarProposta(id: string) {
  const proposta = await consultarUm(
    `SELECT p.*, l.numero AS lead_numero, c.nome AS concessionaria, t.nome AS telhado,
            b.nome AS banco_financiamento, u.nome AS consultor
       FROM "SolarCosta_Propostas" p
       LEFT JOIN "SolarCosta_Leads"               l ON l.id = p.lead_id
       LEFT JOIN "SolarCosta_Concessionarias"     c ON c.id = p.concessionaria_id
       LEFT JOIN "SolarCosta_TiposTelhado"        t ON t.id = p.tipo_telhado_id
       LEFT JOIN "SolarCosta_BancosFinanciamento" b ON b.id = p.banco_financiamento_id
       LEFT JOIN "SolarCosta_Usuarios"            u ON u.id = p.consultor_id
      WHERE p.id = $1 AND p.excluido_em IS NULL`,
    [id],
  );
  if (!proposta) throw naoEncontrado('Proposta');

  const itens = await consultar(
    `SELECT id, produto_id, descricao, qtd, valor_unit, total, ordem
       FROM "SolarCosta_PropostaItens" WHERE proposta_id = $1 ORDER BY ordem`,
    [id],
  );

  return { ...proposta, itens };
}

// -------------------------------------------------------------- LISTAGEM ---
propostasRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const f = z
      .object({
        status: z.enum(['rascunho', 'enviada', 'aceita', 'recusada', 'expirada']).optional(),
        lead_id: z.string().uuid().optional(),
        pagina: z.coerce.number().int().min(1).default(1),
        tamanho: z.coerce.number().int().min(1).max(200).default(100),
      })
      .parse(req.query);

    const cond = ['p.excluido_em IS NULL'];
    const params: unknown[] = [];

    if (f.status) { params.push(f.status); cond.push(`p.status = $${params.length}`); }
    if (f.lead_id) { params.push(f.lead_id); cond.push(`p.lead_id = $${params.length}`); }

    params.push(f.tamanho, (f.pagina - 1) * f.tamanho);
    const propostas = await consultar(
      `SELECT p.id, p.numero, p.lead_id, p.cliente_nome, p.cpf_cnpj, p.cidade,
              p.potencia_kwp, p.modulos_qtd, p.valor_total, p.status::text AS status,
              p.forma_pagamento::text AS forma_pagamento, p.criado_em, p.enviada_em,
              u.nome AS consultor
         FROM "SolarCosta_Propostas" p
         LEFT JOIN "SolarCosta_Usuarios" u ON u.id = p.consultor_id
        WHERE ${cond.join(' AND ')}
        ORDER BY p.criado_em DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    res.json({ propostas });
  }),
);

propostasRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    res.json({ proposta: await carregarProposta(id) });
  }),
);

// ----------------------------------------------------------------- CRIAR ---
propostasRouter.post(
  '/',
  exigirPermissao('emitir_propostas'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const d = propostaSchema.parse(req.body);

    const id = await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `INSERT INTO "SolarCosta_Propostas" (
            lead_id, cliente_nome, cpf_cnpj, telefone, email, endereco, cidade,
            concessionaria_id, tipo_telhado_id,
            consumo_kwh, tarifa_kwh, hsp, perdas_pct, modulo_wp,
            potencia_kwp, modulos_qtd, area_estimada_m2, geracao_media_kwh, cobertura_pct,
            economia_mensal, economia_anual, economia_25_anos, payback_anos,
            forma_pagamento, desconto_avista_pct, parcelas_cartao, taxa_cartao_pct,
            entrada_financiamento_valor, entrada_financiamento_pct,
            parcelas_financiamento, juros_financiamento_mes_pct, banco_financiamento_id,
            observacoes, logo_customizada_url, validade_dias, consultor_id, status
         ) VALUES (
            $1,$2,$3,$4,NULLIF($5,'')::citext,$6,$7,
            COALESCE($8::int, (SELECT id FROM "SolarCosta_Concessionarias" WHERE nome = $9)),
            COALESCE($10::int,(SELECT id FROM "SolarCosta_TiposTelhado"    WHERE nome = $11)),
            $12,$13,$14,$15,$16,
            $17,$18,$19,$20,$21,
            $22,$23,$24,$25,
            $26,$27,$28,$29,
            $30,$31,$32,$33,$34,
            $35,$36,$37,$38,'rascunho'
         ) RETURNING id`,
        [
          d.lead_id ?? null, d.cliente_nome, d.cpf_cnpj ?? null, d.telefone ?? null,
          d.email ?? null, d.endereco ?? null, d.cidade ?? null,
          d.concessionaria_id ?? null, d.concessionaria ?? null,
          d.tipo_telhado_id ?? null, d.telhado ?? null,
          d.consumo_kwh, d.tarifa_kwh, d.hsp, d.perdas_pct, d.modulo_wp,
          d.potencia_kwp, d.modulos_qtd, d.area_estimada_m2 ?? null,
          d.geracao_media_kwh ?? null, d.cobertura_pct ?? null,
          d.economia_mensal ?? null, d.economia_anual ?? null,
          d.economia_25_anos ?? null, d.payback_anos ?? null,
          d.forma_pagamento, d.desconto_avista_pct ?? null,
          d.parcelas_cartao ?? null, d.taxa_cartao_pct ?? null,
          d.entrada_financiamento_valor ?? null, d.entrada_financiamento_pct ?? null,
          d.parcelas_financiamento ?? null, d.juros_financiamento_mes_pct ?? null,
          d.banco_financiamento_id ?? null,
          d.observacoes ?? null, d.logo_customizada_url ?? null, d.validade_dias,
          req.usuario.id,
        ],
      );
      const novoId = rows[0]!.id as string;

      await inserirItens(cliente, novoId, d.itens);

      const { rows: n } = await cliente.query(
        `SELECT numero FROM "SolarCosta_Propostas" WHERE id = $1`, [novoId]);
      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('criar','Proposta',$1,$2,NULL)`,
        [`Proposta ${n[0]!.numero} — ${d.cliente_nome}`, novoId],
      );

      return novoId;
    }, ator(req));

    res.status(201).json({ proposta: await carregarProposta(id) });
  }),
);

// ---------------------------------------------------------------- EDITAR ---
propostasRouter.put(
  '/:id',
  exigirPermissao('emitir_propostas'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const d = propostaSchema.parse(req.body);

    await emTransacao(async (cliente) => {
      const { rows: atual } = await cliente.query(
        `SELECT numero, status::text AS status FROM "SolarCosta_Propostas"
          WHERE id = $1 AND excluido_em IS NULL`, [id]);
      if (atual.length === 0) throw naoEncontrado('Proposta');

      // Proposta aceita virou base de contrato: não se reescreve.
      if (atual[0]!.status === 'aceita') {
        throw new AppError(409, 'Proposta já aceita não pode ser alterada.', 'proposta_fechada');
      }

      await cliente.query(
        `UPDATE "SolarCosta_Propostas" SET
            cliente_nome = $2, cpf_cnpj = $3, telefone = $4, email = NULLIF($5,'')::citext,
            endereco = $6, cidade = $7,
            concessionaria_id = COALESCE($8::int, (SELECT id FROM "SolarCosta_Concessionarias" WHERE nome = $9)),
            tipo_telhado_id   = COALESCE($10::int,(SELECT id FROM "SolarCosta_TiposTelhado"    WHERE nome = $11)),
            consumo_kwh = $12, tarifa_kwh = $13, hsp = $14, perdas_pct = $15, modulo_wp = $16,
            potencia_kwp = $17, modulos_qtd = $18, area_estimada_m2 = $19,
            geracao_media_kwh = $20, cobertura_pct = $21,
            economia_mensal = $22, economia_anual = $23, economia_25_anos = $24, payback_anos = $25,
            forma_pagamento = $26, desconto_avista_pct = $27, parcelas_cartao = $28, taxa_cartao_pct = $29,
            entrada_financiamento_valor = $30, entrada_financiamento_pct = $31,
            parcelas_financiamento = $32, juros_financiamento_mes_pct = $33, banco_financiamento_id = $34,
            observacoes = $35, logo_customizada_url = $36, validade_dias = $37
          WHERE id = $1`,
        [
          id, d.cliente_nome, d.cpf_cnpj ?? null, d.telefone ?? null, d.email ?? null,
          d.endereco ?? null, d.cidade ?? null,
          d.concessionaria_id ?? null, d.concessionaria ?? null,
          d.tipo_telhado_id ?? null, d.telhado ?? null,
          d.consumo_kwh, d.tarifa_kwh, d.hsp, d.perdas_pct, d.modulo_wp,
          d.potencia_kwp, d.modulos_qtd, d.area_estimada_m2 ?? null,
          d.geracao_media_kwh ?? null, d.cobertura_pct ?? null,
          d.economia_mensal ?? null, d.economia_anual ?? null,
          d.economia_25_anos ?? null, d.payback_anos ?? null,
          d.forma_pagamento, d.desconto_avista_pct ?? null,
          d.parcelas_cartao ?? null, d.taxa_cartao_pct ?? null,
          d.entrada_financiamento_valor ?? null, d.entrada_financiamento_pct ?? null,
          d.parcelas_financiamento ?? null, d.juros_financiamento_mes_pct ?? null,
          d.banco_financiamento_id ?? null,
          d.observacoes ?? null, d.logo_customizada_url ?? null, d.validade_dias,
        ],
      );

      // Itens são substituídos por inteiro; o trigger recalcula valor_total.
      await cliente.query(`DELETE FROM "SolarCosta_PropostaItens" WHERE proposta_id = $1`, [id]);
      await inserirItens(cliente, id, d.itens);

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('editar','Proposta',$1,$2,NULL)`,
        [`Proposta ${atual[0]!.numero} — ${d.cliente_nome}`, id],
      );
    }, ator(req));

    res.json({ proposta: await carregarProposta(id) });
  }),
);

// ---------------------------------------------------------------- STATUS ---
propostasRouter.patch(
  '/:id/status',
  exigirPermissao('emitir_propostas'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { status } = z
      .object({ status: z.enum(['rascunho', 'enviada', 'aceita', 'recusada', 'expirada']) })
      .parse(req.body);

    await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_Propostas" SET
            status     = $2,
            enviada_em = CASE WHEN $2 = 'enviada' THEN COALESCE(enviada_em, now()) ELSE enviada_em END,
            aceita_em  = CASE WHEN $2 = 'aceita'  THEN COALESCE(aceita_em,  now()) ELSE aceita_em  END
          WHERE id = $1 AND excluido_em IS NULL
          RETURNING numero, cliente_nome`,
        [id, status],
      );
      if (rows.length === 0) throw naoEncontrado('Proposta');

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('editar','Proposta',$1,$2,$3)`,
        [`Proposta ${rows[0]!.numero} — ${rows[0]!.cliente_nome}`, id, `Status: ${status}`],
      );
    }, ator(req));

    res.json({ proposta: await carregarProposta(id) });
  }),
);

propostasRouter.delete(
  '/:id',
  exigirPermissao('emitir_propostas'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);

    await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_Propostas" SET excluido_em = now()
          WHERE id = $1 AND excluido_em IS NULL
          RETURNING numero, cliente_nome`, [id]);
      if (rows.length === 0) throw naoEncontrado('Proposta');

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('excluir','Proposta',$1,$2,NULL)`,
        [`Proposta ${rows[0]!.numero} — ${rows[0]!.cliente_nome}`, id],
      );
    }, ator(req));

    res.status(204).end();
  }),
);

// -------------------------------------------------------------- INTERNOS ---
type ItemProposta = z.infer<typeof itemSchema>;

async function inserirItens(
  cliente: import('../db.js').Cliente,
  propostaId: string,
  itens: ItemProposta[],
): Promise<void> {
  for (const [i, item] of itens.entries()) {
    await cliente.query(
      `INSERT INTO "SolarCosta_PropostaItens"
          (proposta_id, produto_id, descricao, qtd, valor_unit, ordem)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [propostaId, item.produto_id ?? null, item.descricao, item.qtd, item.valor_unit, i + 1],
    );
  }
}
