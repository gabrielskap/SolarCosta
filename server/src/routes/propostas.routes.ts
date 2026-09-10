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
  cep: z.string().max(12).nullish(),
  // Número do imóvel, não o da proposta (`numero`, gerado pelo trigger).
  // Guardado porque é ele que faz o geocoding cair em ROOFTOP: sem ele,
  // reabrir a proposta recomeçaria pela localização aproximada.
  numero_endereco: z.string().max(20).nullish(),
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

  // Localização e layout do telhado (V005). Opcionais: proposta sem busca por
  // satélite continua válida, só não imprime a página do telhado.
  latitude: z.coerce.number().min(-90).max(90).nullish(),
  longitude: z.coerce.number().min(-180).max(180).nullish(),
  place_id: z.string().max(300).nullish(),
  endereco_formatado: z.string().max(300).nullish(),
  edificacao_id: z.string().max(200).nullish(),
  mapa_zoom: z.coerce.number().int().min(1).max(22).nullish(),
  telhado_imagem_data: z.string().date('Data da imagem inválida.').nullish(),
  telhado_area_m2: z.coerce.number().min(0).nullish(),
  // O layout é gerado pelo front (src/utils/layoutModulos.ts) e guardado como
  // veio. Validamos a forma, não o conteúdo: o desenho é fruto do cálculo dele.
  layout_modulos: z
    .array(
      z.object({
        cantos: z
          .array(z.object({ latitude: z.number(), longitude: z.number() }))
          .length(4, 'Cada módulo precisa de exatamente 4 cantos.'),
        centro: z.object({ latitude: z.number(), longitude: z.number() }),
        segmento: z.number().int().min(0),
        azimuteGraus: z.number(),
      }),
    )
    .nullish(),
  layout_segmentos: z
    .array(
      z.object({
        indice: z.number().int().min(0),
        azimuteGraus: z.number(),
        inclinacaoGraus: z.number(),
        areaM2: z.number(),
      }),
    )
    .nullish(),
  // Layout ajustado à mão no editor de telhado (V007), em vez de gerado pelo
  // empacotamento automático. Muda como o front trata um recálculo por
  // mudança de kit: preserva as posições em vez de refazê-las.
  layout_ajuste_manual: z.coerce.boolean().nullish(),
  // Medida da placa usada no layout, quando difere dos parâmetros do sistema.
  // Limites frouxos de propósito: o que é um módulo "razoável" muda a cada
  // geração de painel, e barrar aqui só criaria um teto para envelhecer mal.
  layout_modulo: z
    .object({
      larguraM: z.number().positive().max(10),
      alturaM: z.number().positive().max(10),
      espacamentoM: z.number().min(0).max(5),
    })
    .nullish(),

  itens: z.array(itemSchema).min(1, 'A proposta precisa de pelo menos um item.'),
});

/** jsonb via node-postgres: sem stringify o driver manda array literal do PG. */
const paraJsonb = (v: unknown): string | null => (v == null ? null : JSON.stringify(v));

/**
 * Guarda no lead a coordenada que esta proposta acabou de resolver.
 *
 * As colunas de geolocalização de "SolarCosta_Leads" (V005) nasceram sem
 * ninguém para escrevê-las. Preencher aqui, dentro da transação da proposta,
 * evita um PATCH /api/leads disparado pelo front — que exige a permissão
 * `criar_editar_leads` e daria 403 no meio da proposta para um consultor que
 * só tem `emitir_propostas`.
 *
 * O `AND (latitude IS NULL ...)` é deliberado: vale a primeira busca que
 * acertou o telhado, e uma coordenada corrigida à mão no cadastro do lead não
 * é desfeita pela próxima proposta emitida para ele.
 */
async function propagarCoordenadaAoLead(
  cliente: import('../db.js').Cliente,
  leadId: string | null | undefined,
  d: { latitude?: number | null; longitude?: number | null; place_id?: string | null },
) {
  if (!leadId || d.latitude == null || d.longitude == null) return;
  await cliente.query(
    `UPDATE "SolarCosta_Leads"
        SET latitude = $2, longitude = $3, place_id = COALESCE($4, place_id)
      WHERE id = $1 AND excluido_em IS NULL
        AND (latitude IS NULL OR longitude IS NULL)`,
    [leadId, d.latitude, d.longitude, d.place_id ?? null],
  );
}

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
            observacoes, logo_customizada_url, validade_dias, consultor_id, status,
            latitude, longitude, place_id, endereco_formatado, edificacao_id,
            mapa_zoom, telhado_imagem_data, telhado_area_m2,
            layout_modulos, layout_segmentos,
            cep, numero_endereco,
            layout_ajuste_manual, layout_modulo
         ) VALUES (
            $1,$2,$3,$4,NULLIF($5,'')::citext,$6,$7,
            COALESCE($8::int, (SELECT id FROM "SolarCosta_Concessionarias" WHERE nome = $9)),
            COALESCE($10::int,(SELECT id FROM "SolarCosta_TiposTelhado"    WHERE nome = $11)),
            $12,$13,$14,$15,$16,
            $17,$18,$19,$20,$21,
            $22,$23,$24,$25,
            $26,$27,$28,$29,
            $30,$31,$32,$33,$34,
            $35,$36,$37,$38,'rascunho',
            $39,$40,$41,$42,$43,
            $44,$45::date,$46,
            $47::jsonb,$48::jsonb,
            $49,$50,
            COALESCE($51, false),$52::jsonb
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
          d.latitude ?? null, d.longitude ?? null, d.place_id ?? null,
          d.endereco_formatado ?? null, d.edificacao_id ?? null,
          d.mapa_zoom ?? null, d.telhado_imagem_data ?? null, d.telhado_area_m2 ?? null,
          paraJsonb(d.layout_modulos), paraJsonb(d.layout_segmentos),
          d.cep ?? null, d.numero_endereco ?? null,
          d.layout_ajuste_manual ?? false, paraJsonb(d.layout_modulo),
        ],
      );
      const novoId = rows[0]!.id as string;

      await inserirItens(cliente, novoId, d.itens);
      await propagarCoordenadaAoLead(cliente, d.lead_id, d);

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
            observacoes = $35, logo_customizada_url = $36, validade_dias = $37,
            latitude = $38, longitude = $39, place_id = $40,
            endereco_formatado = $41, edificacao_id = $42, mapa_zoom = $43,
            telhado_imagem_data = $44::date, telhado_area_m2 = $45,
            layout_modulos = $46::jsonb, layout_segmentos = $47::jsonb,
            cep = $48, numero_endereco = $49,
            layout_ajuste_manual = COALESCE($50, false), layout_modulo = $51::jsonb
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
          d.latitude ?? null, d.longitude ?? null, d.place_id ?? null,
          d.endereco_formatado ?? null, d.edificacao_id ?? null, d.mapa_zoom ?? null,
          d.telhado_imagem_data ?? null, d.telhado_area_m2 ?? null,
          paraJsonb(d.layout_modulos), paraJsonb(d.layout_segmentos),
          d.cep ?? null, d.numero_endereco ?? null,
          d.layout_ajuste_manual ?? false, paraJsonb(d.layout_modulo),
        ],
      );

      // Itens são substituídos por inteiro; o trigger recalcula valor_total.
      await cliente.query(`DELETE FROM "SolarCosta_PropostaItens" WHERE proposta_id = $1`, [id]);
      await inserirItens(cliente, id, d.itens);
      await propagarCoordenadaAoLead(cliente, d.lead_id, d);

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
