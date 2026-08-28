// Contratos.
//
// Substitui ContractsView + StorageService.saveContrato.
// O contrato guarda um SNAPSHOT do cliente e das condições: depois de assinado
// ele precisa refletir o que foi acordado, mesmo que o cadastro do lead mude.
// Por isso o PATCH recusa contrato já assinado.

import { Router } from 'express';
import { z } from 'zod';
import { consultar, consultarUm, emTransacao } from '../db.js';
import { AppError, asyncHandler, naoEncontrado } from '../errors.js';
import { ator, exigirLogin, exigirPermissao, type RequestAutenticado } from '../auth/middleware.js';

export const contratosRouter = Router();
contratosRouter.use(exigirLogin);

const contratoSchema = z.object({
  lead_id: z.string().uuid().nullish(),
  proposta_id: z.string().uuid().nullish(),

  cliente_nome: z.string().min(1, 'Informe o contratante.').max(200),
  cpf_cnpj: z.string().min(1, 'CPF/CNPJ é obrigatório no contrato.').max(20),
  rg_inscricao: z.string().max(40).nullish(),
  endereco: z.string().min(1, 'Informe o endereço.').max(300),
  cep: z.string().max(12).nullish(),
  telefone: z.string().max(30).nullish(),

  potencia_kwp: z.coerce.number().min(0),
  modulos_qtd: z.coerce.number().int().min(0),
  modulo_modelo: z.string().max(200).nullish(),
  inversor_modelo: z.string().max(200).nullish(),
  estrutura: z.string().max(120).nullish(),
  prazo_execucao: z.string().max(120).nullish(),
  local_instalacao: z.string().max(300).nullish(),

  valor_total: z.coerce.number().min(0),
  forma_pagamento: z.string().max(120).nullish(),
  entrada: z.string().max(120).nullish(),
  parcelas_info: z.string().max(200).nullish(),
  banco_agente: z.string().max(200).nullish(),
  primeiro_vencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use AAAA-MM-DD.').nullish(),
  multa_atraso: z.string().max(120).nullish(),
  foro_eleito: z.string().max(120).nullish(),

  garantia_modulos: z.string().max(120).nullish(),
  garantia_inversores: z.string().max(120).nullish(),
  garantia_instalacao: z.string().max(120).nullish(),
  garantia_homologacao: z.string().max(120).nullish(),

  responsavel_tecnico_id: z.string().uuid().nullish(),
  responsavel_tecnico: z.string().max(200).nullish(),
  crea: z.string().max(40).nullish(),
  observacoes: z.string().nullish(),

  // Títulos vindos de SolarCosta_ClausulasPadrao, na ordem escolhida.
  clausulas: z.array(z.string().min(1)).default([]),
});

async function carregarContrato(id: string) {
  const contrato = await consultarUm(
    `SELECT c.*, l.numero AS lead_numero, p.numero AS proposta_numero, o.numero AS obra_numero
       FROM "SolarCosta_Contratos" c
       LEFT JOIN "SolarCosta_Leads"     l ON l.id = c.lead_id
       LEFT JOIN "SolarCosta_Propostas" p ON p.id = c.proposta_id
       LEFT JOIN "SolarCosta_Obras"     o ON o.contrato_id = c.id
      WHERE c.id = $1 AND c.excluido_em IS NULL`,
    [id],
  );
  if (!contrato) throw naoEncontrado('Contrato');

  const clausulas = await consultar(
    `SELECT id, ordem, titulo, texto FROM "SolarCosta_ContratoClausulas"
      WHERE contrato_id = $1 ORDER BY ordem`,
    [id],
  );

  return { ...contrato, clausulas };
}

contratosRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const f = z
      .object({
        status: z.enum(['aguardando', 'assinado', 'cancelado']).optional(),
        lead_id: z.string().uuid().optional(),
      })
      .parse(req.query);

    const cond = ['c.excluido_em IS NULL'];
    const params: unknown[] = [];
    if (f.status) { params.push(f.status); cond.push(`c.status = $${params.length}`); }
    if (f.lead_id) { params.push(f.lead_id); cond.push(`c.lead_id = $${params.length}`); }

    const contratos = await consultar(
      `SELECT c.id, c.numero, c.lead_id, c.proposta_id, c.cliente_nome, c.cpf_cnpj,
              c.potencia_kwp, c.modulos_qtd, c.valor_total, c.status::text AS status,
              c.data_emissao, c.data_assinatura, c.responsavel_tecnico
         FROM "SolarCosta_Contratos" c
        WHERE ${cond.join(' AND ')}
        ORDER BY c.data_emissao DESC, c.criado_em DESC`,
      params,
    );
    res.json({ contratos });
  }),
);

contratosRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    res.json({ contrato: await carregarContrato(id) });
  }),
);

// Monta um rascunho de contrato a partir de uma proposta aceita — evita
// redigitar o que já foi dimensionado.
contratosRouter.get(
  '/rascunho/proposta/:propostaId',
  exigirPermissao('emitir_contratos'),
  asyncHandler(async (req, res) => {
    const propostaId = z.string().uuid().parse(req.params.propostaId);

    const base = await consultarUm(
      `SELECT p.id AS proposta_id, p.lead_id, p.cliente_nome, p.cpf_cnpj, p.telefone,
              p.endereco, p.potencia_kwp, p.modulos_qtd, p.valor_total,
              p.forma_pagamento::text AS forma_pagamento,
              p.entrada_financiamento_valor, p.parcelas_financiamento,
              b.nome AS banco_agente,
              l.rg_inscricao, l.cep,
              e.responsavel_tecnico, e.crea, e.foro_padrao AS foro_eleito
         FROM "SolarCosta_Propostas" p
         LEFT JOIN "SolarCosta_Leads" l ON l.id = p.lead_id
         LEFT JOIN "SolarCosta_BancosFinanciamento" b ON b.id = p.banco_financiamento_id
         CROSS JOIN LATERAL (SELECT * FROM "SolarCosta_Empresa" LIMIT 1) e
        WHERE p.id = $1 AND p.excluido_em IS NULL`,
      [propostaId],
    );
    if (!base) throw naoEncontrado('Proposta');

    const [padroes, clausulas] = await Promise.all([
      consultar(
        `SELECT chave, valor FROM "SolarCosta_Parametros" WHERE grupo = 'contrato'`),
      consultar(
        `SELECT titulo, ordem FROM "SolarCosta_ClausulasPadrao" WHERE ativo AND padrao ORDER BY ordem`),
    ]);

    res.json({ rascunho: base, padroes, clausulas });
  }),
);

contratosRouter.post(
  '/',
  exigirPermissao('emitir_contratos'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const d = contratoSchema.parse(req.body);

    const id = await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `INSERT INTO "SolarCosta_Contratos" (
            lead_id, proposta_id, cliente_nome, cpf_cnpj, rg_inscricao, endereco, cep, telefone,
            potencia_kwp, modulos_qtd, modulo_modelo, inversor_modelo, estrutura,
            prazo_execucao, local_instalacao,
            valor_total, forma_pagamento, entrada, parcelas_info, banco_agente,
            primeiro_vencimento, multa_atraso, foro_eleito,
            garantia_modulos, garantia_inversores, garantia_instalacao, garantia_homologacao,
            responsavel_tecnico_id, responsavel_tecnico, crea, observacoes, criado_por_id, status
         ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,
            $9,$10,$11,$12,$13,
            $14,$15,
            $16,$17,$18,$19,$20,
            $21::date,$22,$23,
            $24,$25,$26,$27,
            COALESCE($28::uuid, (SELECT id FROM "SolarCosta_Usuarios" WHERE nome = $29 AND excluido_em IS NULL)),
            $29,$30,$31,$32,'aguardando'
         ) RETURNING id, numero`,
        [
          d.lead_id ?? null, d.proposta_id ?? null, d.cliente_nome, d.cpf_cnpj,
          d.rg_inscricao ?? null, d.endereco, d.cep ?? null, d.telefone ?? null,
          d.potencia_kwp, d.modulos_qtd, d.modulo_modelo ?? null, d.inversor_modelo ?? null,
          d.estrutura ?? null, d.prazo_execucao ?? null, d.local_instalacao ?? null,
          d.valor_total, d.forma_pagamento ?? null, d.entrada ?? null,
          d.parcelas_info ?? null, d.banco_agente ?? null,
          d.primeiro_vencimento ?? null, d.multa_atraso ?? null, d.foro_eleito ?? null,
          d.garantia_modulos ?? null, d.garantia_inversores ?? null,
          d.garantia_instalacao ?? null, d.garantia_homologacao ?? null,
          d.responsavel_tecnico_id ?? null, d.responsavel_tecnico ?? null,
          d.crea ?? null, d.observacoes ?? null, req.usuario.id,
        ],
      );
      const novoId = rows[0]!.id as string;

      await gravarClausulas(cliente, novoId, d.clausulas);

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('criar','Contrato',$1,$2,NULL)`,
        [`Contrato ${rows[0]!.numero} — ${d.cliente_nome}`, novoId],
      );
      return novoId;
    }, ator(req));

    res.status(201).json({ contrato: await carregarContrato(id) });
  }),
);

contratosRouter.put(
  '/:id',
  exigirPermissao('emitir_contratos'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const d = contratoSchema.parse(req.body);

    await emTransacao(async (cliente) => {
      const { rows: atual } = await cliente.query(
        `SELECT numero, status::text AS status FROM "SolarCosta_Contratos"
          WHERE id = $1 AND excluido_em IS NULL`, [id]);
      if (atual.length === 0) throw naoEncontrado('Contrato');

      if (atual[0]!.status === 'assinado') {
        throw new AppError(
          409,
          'Contrato assinado não pode ser alterado. Cancele e emita um aditivo.',
          'contrato_assinado',
        );
      }

      await cliente.query(
        `UPDATE "SolarCosta_Contratos" SET
            cliente_nome = $2, cpf_cnpj = $3, rg_inscricao = $4, endereco = $5, cep = $6, telefone = $7,
            potencia_kwp = $8, modulos_qtd = $9, modulo_modelo = $10, inversor_modelo = $11,
            estrutura = $12, prazo_execucao = $13, local_instalacao = $14,
            valor_total = $15, forma_pagamento = $16, entrada = $17, parcelas_info = $18,
            banco_agente = $19, primeiro_vencimento = $20::date, multa_atraso = $21, foro_eleito = $22,
            garantia_modulos = $23, garantia_inversores = $24,
            garantia_instalacao = $25, garantia_homologacao = $26,
            responsavel_tecnico_id = COALESCE($27::uuid, responsavel_tecnico_id),
            responsavel_tecnico = $28, crea = $29, observacoes = $30
          WHERE id = $1`,
        [
          id, d.cliente_nome, d.cpf_cnpj, d.rg_inscricao ?? null, d.endereco,
          d.cep ?? null, d.telefone ?? null,
          d.potencia_kwp, d.modulos_qtd, d.modulo_modelo ?? null, d.inversor_modelo ?? null,
          d.estrutura ?? null, d.prazo_execucao ?? null, d.local_instalacao ?? null,
          d.valor_total, d.forma_pagamento ?? null, d.entrada ?? null, d.parcelas_info ?? null,
          d.banco_agente ?? null, d.primeiro_vencimento ?? null,
          d.multa_atraso ?? null, d.foro_eleito ?? null,
          d.garantia_modulos ?? null, d.garantia_inversores ?? null,
          d.garantia_instalacao ?? null, d.garantia_homologacao ?? null,
          d.responsavel_tecnico_id ?? null, d.responsavel_tecnico ?? null,
          d.crea ?? null, d.observacoes ?? null,
        ],
      );

      await cliente.query(`DELETE FROM "SolarCosta_ContratoClausulas" WHERE contrato_id = $1`, [id]);
      await gravarClausulas(cliente, id, d.clausulas);

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('editar','Contrato',$1,$2,NULL)`,
        [`Contrato ${atual[0]!.numero} — ${d.cliente_nome}`, id],
      );
    }, ator(req));

    res.json({ contrato: await carregarContrato(id) });
  }),
);

// Assinar: o CHECK do banco exige data_assinatura quando status = 'assinado'.
contratosRouter.post(
  '/:id/assinar',
  exigirPermissao('emitir_contratos'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { data_assinatura, arquivo_assinado_url } = z
      .object({
        data_assinatura: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use AAAA-MM-DD.').optional(),
        arquivo_assinado_url: z.string().nullish(),
      })
      .parse(req.body ?? {});

    await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_Contratos" SET
            status = 'assinado',
            data_assinatura = COALESCE($2::date, CURRENT_DATE),
            arquivo_assinado_url = COALESCE($3, arquivo_assinado_url)
          WHERE id = $1 AND excluido_em IS NULL AND status <> 'assinado'
          RETURNING numero, cliente_nome, lead_id`,
        [id, data_assinatura ?? null, arquivo_assinado_url ?? null],
      );
      if (rows.length === 0) {
        throw new AppError(409, 'Contrato não encontrado ou já assinado.', 'contrato_assinado');
      }

      // Contrato assinado fecha o lead.
      if (rows[0]!.lead_id) {
        await cliente.query(
          `UPDATE "SolarCosta_Leads" SET etapa = 'Fechado'
            WHERE id = $1 AND etapa <> 'Fechado'`,
          [rows[0]!.lead_id],
        );
      }

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('editar','Contrato',$1,$2,'Contrato assinado.')`,
        [`Contrato ${rows[0]!.numero} — ${rows[0]!.cliente_nome}`, id],
      );
    }, ator(req));

    res.json({ contrato: await carregarContrato(id) });
  }),
);

contratosRouter.delete(
  '/:id',
  exigirPermissao('emitir_contratos'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);

    await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_Contratos" SET excluido_em = now()
          WHERE id = $1 AND excluido_em IS NULL
          RETURNING numero, cliente_nome`, [id]);
      if (rows.length === 0) throw naoEncontrado('Contrato');

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('excluir','Contrato',$1,$2,NULL)`,
        [`Contrato ${rows[0]!.numero} — ${rows[0]!.cliente_nome}`, id],
      );
    }, ator(req));

    res.status(204).end();
  }),
);

// Biblioteca de cláusulas padrão, para montar o formulário.
contratosRouter.get(
  '/apoio/clausulas',
  asyncHandler(async (_req, res) => {
    const clausulas = await consultar(
      `SELECT id, titulo, texto, padrao, ordem FROM "SolarCosta_ClausulasPadrao"
        WHERE ativo ORDER BY ordem`);
    res.json({ clausulas });
  }),
);

async function gravarClausulas(
  cliente: import('../db.js').Cliente,
  contratoId: string,
  titulos: string[],
): Promise<void> {
  for (const [i, titulo] of titulos.entries()) {
    await cliente.query(
      `INSERT INTO "SolarCosta_ContratoClausulas" (contrato_id, ordem, titulo, texto)
       VALUES ($1, $2, $3, (SELECT texto FROM "SolarCosta_ClausulasPadrao" WHERE titulo = $3))`,
      [contratoId, i + 1, titulo],
    );
  }
}
