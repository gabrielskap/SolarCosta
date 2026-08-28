// Agenda — visitas técnicas, reuniões e vistorias.
//
// Substitui InteractiveCalendar. `lead_nome` é snapshot: o mock tinha
// agendamentos apontando para leads inexistentes, e o nome precisa sobreviver
// mesmo sem o vínculo.

import { Router } from 'express';
import { z } from 'zod';
import { consultar, emTransacao } from '../db.js';
import { asyncHandler, naoEncontrado } from '../errors.js';
import { ator, exigirLogin, type RequestAutenticado } from '../auth/middleware.js';

export const agendaRouter = Router();
agendaRouter.use(exigirLogin);

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}$/;

const agendamentoSchema = z
  .object({
    lead_id: z.string().uuid().nullish(),
    lead_nome: z.string().min(1, 'Informe o cliente.').max(200),
    obra_id: z.string().uuid().nullish(),
    tipo: z.enum(['visita_tecnica', 'reuniao', 'vistoria']),
    titulo: z.string().min(1, 'Informe o título.').max(300),
    data: z.string().regex(DATA, 'Use AAAA-MM-DD.'),
    horario_inicio: z.string().regex(HORA, 'Use HH:MM.'),
    horario_fim: z.string().regex(HORA, 'Use HH:MM.'),
    endereco: z.string().max(300).nullish(),
    cidade: z.string().max(120).nullish(),
    responsavel_id: z.string().uuid().nullish(),
    responsavel: z.string().nullish(),
    status: z.enum(['agendado', 'realizado', 'cancelado']).default('agendado'),
    observacoes: z.string().nullish(),
  })
  .refine((d) => d.horario_fim > d.horario_inicio, {
    message: 'O horário final precisa ser depois do inicial.',
    path: ['horario_fim'],
  });

agendaRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const f = z
      .object({
        de: z.string().regex(DATA).optional(),
        ate: z.string().regex(DATA).optional(),
        tipo: z.enum(['visita_tecnica', 'reuniao', 'vistoria']).optional(),
        responsavel_id: z.string().uuid().optional(),
        status: z.enum(['agendado', 'realizado', 'cancelado']).optional(),
        lead_id: z.string().uuid().optional(),
      })
      .parse(req.query);

    const cond: string[] = [];
    const params: unknown[] = [];
    if (f.de) { params.push(f.de); cond.push(`data >= $${params.length}::date`); }
    if (f.ate) { params.push(f.ate); cond.push(`data <= $${params.length}::date`); }
    if (f.tipo) { params.push(f.tipo); cond.push(`tipo = $${params.length}`); }
    if (f.status) { params.push(f.status); cond.push(`status = $${params.length}`); }
    if (f.lead_id) { params.push(f.lead_id); cond.push(`lead_id = $${params.length}`); }
    if (f.responsavel_id) {
      params.push(f.responsavel_id);
      cond.push(`responsavel_id = $${params.length}`);
    }

    const agendamentos = await consultar(
      `SELECT * FROM "SolarCosta_vw_Agendamentos"
       ${cond.length ? `WHERE ${cond.join(' AND ')}` : ''}
       ORDER BY data, horario_inicio`,
      params,
    );
    res.json({ agendamentos });
  }),
);

agendaRouter.post(
  '/',
  asyncHandler(async (req: RequestAutenticado, res) => {
    const d = agendamentoSchema.parse(req.body);

    const agendamento = await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `INSERT INTO "SolarCosta_Agendamentos" (
            lead_id, lead_nome, obra_id, tipo, titulo, data, horario_inicio, horario_fim,
            endereco, cidade, responsavel_id, status, observacoes, criado_por_id
         ) VALUES (
            $1,$2,$3,$4,$5,$6::date,$7::time,$8::time,$9,$10,
            COALESCE($11::uuid, (SELECT id FROM "SolarCosta_Usuarios" WHERE nome = $12 AND excluido_em IS NULL)),
            $13,$14,$15
         ) RETURNING id`,
        [
          d.lead_id ?? null, d.lead_nome, d.obra_id ?? null, d.tipo, d.titulo,
          d.data, d.horario_inicio, d.horario_fim, d.endereco ?? null, d.cidade ?? null,
          d.responsavel_id ?? null, d.responsavel ?? null,
          d.status, d.observacoes ?? null, req.usuario.id,
        ],
      );
      const id = rows[0]!.id as string;

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('criar','Agendamento',$1,$2,$3)`,
        [`${d.titulo} — ${d.lead_nome}`, id, `${d.data} ${d.horario_inicio}–${d.horario_fim}`],
      );

      const { rows: view } = await cliente.query(
        `SELECT * FROM "SolarCosta_vw_Agendamentos" WHERE id = $1`, [id]);
      return view[0];
    }, ator(req));

    res.status(201).json({ agendamento });
  }),
);

agendaRouter.put(
  '/:id',
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const d = agendamentoSchema.parse(req.body);

    const agendamento = await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_Agendamentos" SET
            lead_id = $2, lead_nome = $3, obra_id = $4, tipo = $5, titulo = $6,
            data = $7::date, horario_inicio = $8::time, horario_fim = $9::time,
            endereco = $10, cidade = $11,
            responsavel_id = COALESCE($12::uuid, (SELECT id FROM "SolarCosta_Usuarios" WHERE nome = $13 AND excluido_em IS NULL)),
            status = $14, observacoes = $15
          WHERE id = $1 AND excluido_em IS NULL
          RETURNING id`,
        [
          id, d.lead_id ?? null, d.lead_nome, d.obra_id ?? null, d.tipo, d.titulo,
          d.data, d.horario_inicio, d.horario_fim, d.endereco ?? null, d.cidade ?? null,
          d.responsavel_id ?? null, d.responsavel ?? null, d.status, d.observacoes ?? null,
        ],
      );
      if (rows.length === 0) throw naoEncontrado('Agendamento');

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('editar','Agendamento',$1,$2,$3)`,
        [`${d.titulo} — ${d.lead_nome}`, id, `${d.data} ${d.horario_inicio}–${d.horario_fim}`],
      );

      const { rows: view } = await cliente.query(
        `SELECT * FROM "SolarCosta_vw_Agendamentos" WHERE id = $1`, [id]);
      return view[0];
    }, ator(req));

    res.json({ agendamento });
  }),
);

agendaRouter.patch(
  '/:id/status',
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { status } = z
      .object({ status: z.enum(['agendado', 'realizado', 'cancelado']) })
      .parse(req.body);

    const agendamento = await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_Agendamentos" SET status = $2
          WHERE id = $1 AND excluido_em IS NULL
          RETURNING titulo, lead_nome`,
        [id, status],
      );
      if (rows.length === 0) throw naoEncontrado('Agendamento');

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('editar','Agendamento',$1,$2,$3)`,
        [`${rows[0]!.titulo} — ${rows[0]!.lead_nome}`, id, `Status: ${status}`],
      );

      const { rows: view } = await cliente.query(
        `SELECT * FROM "SolarCosta_vw_Agendamentos" WHERE id = $1`, [id]);
      return view[0];
    }, ator(req));

    res.json({ agendamento });
  }),
);

agendaRouter.delete(
  '/:id',
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);

    await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_Agendamentos" SET excluido_em = now()
          WHERE id = $1 AND excluido_em IS NULL
          RETURNING titulo, lead_nome`, [id]);
      if (rows.length === 0) throw naoEncontrado('Agendamento');

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('excluir','Agendamento',$1,$2,NULL)`,
        [`${rows[0]!.titulo} — ${rows[0]!.lead_nome}`, id],
      );
    }, ator(req));

    res.status(204).end();
  }),
);
