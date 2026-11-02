// Procurações (V027).
//
// Mesmo desenho do contrato (contratos.routes.ts): o front monta o rascunho a
// partir do contrato e manda o snapshot inteiro, e a procuração assinada não
// muda mais — o PUT recusa. Escrever exige emitir_contratos: quem emite o
// contrato é quem colhe a procuração do mesmo cliente.
//
// Auditoria como entidade 'Contrato', sem ALTER TYPE (ver V018 e V027), com o
// alvo escrito "Procuração <nº> — <outorgante>" para a trilha continuar legível.

import { Router } from 'express';
import { z } from 'zod';
import { consultar, consultarUm, emTransacao } from '../db.js';
import { AppError, asyncHandler } from '../errors.js';
import { ator, exigirLogin, exigirPermissao, type RequestAutenticado } from '../auth/middleware.js';
import {
  MODELO_PROCURACAO_VERSAO, outorgadosProcuracaoSchema, termosProcuracaoSchema,
} from '../schemas/procuracao.js';

export const procuracoesRouter = Router();
procuracoesRouter.use(exigirLogin);

const procuracaoSchema = z.object({
  contrato_id: z.string().uuid().nullish(),
  lead_id: z.string().uuid().nullish(),
  modelo_versao: z.literal(MODELO_PROCURACAO_VERSAO).default(MODELO_PROCURACAO_VERSAO),

  // Outorgante: mesmos nomes e limites do contratante, de onde nasce a cópia.
  cliente_nome: z.string().trim().min(1, 'Informe o outorgante.').max(200),
  cpf_cnpj: z.string().trim().min(1, 'CPF/CNPJ é obrigatório na procuração.').max(20),
  rg_inscricao: z.string().max(40).nullish(),
  endereco: z.string().trim().min(1, 'Informe o endereço do outorgante.').max(300),
  cep: z.string().max(12).nullish(),
  telefone: z.string().max(30).nullish(),

  outorgados: outorgadosProcuracaoSchema,
  termos: termosProcuracaoSchema,
});

// "Procuração não encontrado." é o que naoEncontrado() escreveria.
const procuracaoNaoEncontrada = () => new AppError(404, 'Procuração não encontrada.', 'nao_encontrado');

const alvo = (numero: string, outorgante: string) => `Procuração ${numero} — ${outorgante}`;

async function carregarProcuracao(id: string) {
  const procuracao = await consultarUm(
    `SELECT p.*, ct.numero AS contrato_numero
       FROM "SolarCosta_Procuracoes" p
       LEFT JOIN "SolarCosta_Contratos" ct ON ct.id = p.contrato_id
      WHERE p.id = $1 AND p.excluido_em IS NULL`,
    [id],
  );
  if (!procuracao) throw procuracaoNaoEncontrada();
  return procuracao;
}

// A lista já volta completa (outorgados e termos são pequenos): o front não
// precisa buscar uma a uma, como faz com os contratos.
procuracoesRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const f = z
      .object({
        status: z.enum(['aguardando', 'assinada']).optional(),
        contrato_id: z.string().uuid().optional(),
        lead_id: z.string().uuid().optional(),
      })
      .parse(req.query);

    const cond = ['p.excluido_em IS NULL'];
    const params: unknown[] = [];
    if (f.status) { params.push(f.status); cond.push(`p.status = $${params.length}`); }
    if (f.contrato_id) { params.push(f.contrato_id); cond.push(`p.contrato_id = $${params.length}`); }
    if (f.lead_id) { params.push(f.lead_id); cond.push(`p.lead_id = $${params.length}`); }

    const procuracoes = await consultar(
      `SELECT p.*, ct.numero AS contrato_numero
         FROM "SolarCosta_Procuracoes" p
         LEFT JOIN "SolarCosta_Contratos" ct ON ct.id = p.contrato_id
        WHERE ${cond.join(' AND ')}
        ORDER BY p.data_emissao DESC, p.criado_em DESC`,
      params,
    );
    res.json({ procuracoes });
  }),
);

procuracoesRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    res.json({ procuracao: await carregarProcuracao(id) });
  }),
);

procuracoesRouter.post(
  '/',
  exigirPermissao('emitir_contratos'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const d = procuracaoSchema.parse(req.body);

    const id = await emTransacao(async (cliente) => {
      // Sem lead informado, herda o do contrato de origem.
      const { rows } = await cliente.query(
        `INSERT INTO "SolarCosta_Procuracoes" (
            contrato_id, lead_id, modelo_versao,
            cliente_nome, cpf_cnpj, rg_inscricao, endereco, cep, telefone,
            outorgados, termos, criado_por_id
         ) VALUES (
            $1::uuid,
            COALESCE($2::uuid, (SELECT lead_id FROM "SolarCosta_Contratos" WHERE id = $1::uuid)),
            $3,
            $4, $5, $6, $7, $8, $9,
            $10::jsonb, $11::jsonb, $12
         ) RETURNING id, numero`,
        [
          d.contrato_id ?? null, d.lead_id ?? null, d.modelo_versao,
          d.cliente_nome, d.cpf_cnpj, d.rg_inscricao ?? null, d.endereco, d.cep ?? null, d.telefone ?? null,
          JSON.stringify(d.outorgados), JSON.stringify(d.termos), req.usuario.id,
        ],
      );
      const novoId = rows[0]!.id as string;

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('criar','Contrato',$1,$2,NULL)`,
        [alvo(rows[0]!.numero, d.cliente_nome), novoId],
      );
      return novoId;
    }, ator(req));

    res.status(201).json({ procuracao: await carregarProcuracao(id) });
  }),
);

procuracoesRouter.put(
  '/:id',
  exigirPermissao('emitir_contratos'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const d = procuracaoSchema.parse(req.body);

    await emTransacao(async (cliente) => {
      const { rows: atual } = await cliente.query(
        `SELECT numero, status FROM "SolarCosta_Procuracoes"
          WHERE id = $1 AND excluido_em IS NULL FOR UPDATE`, [id]);
      if (atual.length === 0) throw procuracaoNaoEncontrada();

      if (atual[0]!.status === 'assinada') {
        throw new AppError(
          409,
          'Procuração assinada não pode ser alterada. Emita uma nova.',
          'procuracao_assinada',
        );
      }

      await cliente.query(
        `UPDATE "SolarCosta_Procuracoes" SET
            contrato_id = COALESCE($2::uuid, contrato_id),
            lead_id = COALESCE($3::uuid, lead_id),
            modelo_versao = $4,
            cliente_nome = $5, cpf_cnpj = $6, rg_inscricao = $7, endereco = $8, cep = $9, telefone = $10,
            outorgados = $11::jsonb, termos = $12::jsonb
          WHERE id = $1`,
        [
          id, d.contrato_id ?? null, d.lead_id ?? null, d.modelo_versao,
          d.cliente_nome, d.cpf_cnpj, d.rg_inscricao ?? null, d.endereco, d.cep ?? null, d.telefone ?? null,
          JSON.stringify(d.outorgados), JSON.stringify(d.termos),
        ],
      );

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('editar','Contrato',$1,$2,NULL)`,
        [alvo(atual[0]!.numero, d.cliente_nome), id],
      );
    }, ator(req));

    res.json({ procuracao: await carregarProcuracao(id) });
  }),
);

// Assinar: o CHECK do banco exige data_assinatura quando status = 'assinada'.
procuracoesRouter.post(
  '/:id/assinar',
  exigirPermissao('emitir_contratos'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { data_assinatura } = z
      .object({
        data_assinatura: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use AAAA-MM-DD.').optional(),
      })
      .parse(req.body ?? {});

    await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_Procuracoes" SET
            status = 'assinada',
            data_assinatura = COALESCE($2::date, CURRENT_DATE)
          WHERE id = $1 AND excluido_em IS NULL AND status <> 'assinada'
          RETURNING numero, cliente_nome`,
        [id, data_assinatura ?? null],
      );
      if (rows.length === 0) {
        throw new AppError(409, 'Procuração não encontrada ou já assinada.', 'procuracao_assinada');
      }

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('editar','Contrato',$1,$2,'Procuração assinada.')`,
        [alvo(rows[0]!.numero, rows[0]!.cliente_nome), id],
      );
    }, ator(req));

    res.json({ procuracao: await carregarProcuracao(id) });
  }),
);

procuracoesRouter.delete(
  '/:id',
  exigirPermissao('emitir_contratos'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);

    await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_Procuracoes" SET excluido_em = now()
          WHERE id = $1 AND excluido_em IS NULL
          RETURNING numero, cliente_nome`, [id]);
      if (rows.length === 0) throw procuracaoNaoEncontrada();

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('excluir','Contrato',$1,$2,NULL)`,
        [alvo(rows[0]!.numero, rows[0]!.cliente_nome), id],
      );
    }, ator(req));

    res.status(204).end();
  }),
);
