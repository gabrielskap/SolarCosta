import { Router } from 'express';
import { z } from 'zod';
import { consultar, emTransacao } from '../db.js';
import { AppError, asyncHandler, naoEncontrado } from '../errors.js';
import { ator, exigirLogin, exigirPermissao } from '../auth/middleware.js';
import { dimensionarSistema } from '../domain/offGrid.js';

export const offGridRouter = Router();
offGridRouter.use(exigirLogin);
const percentual = z.number().finite().positive().max(100);
const positivo = z.number().finite().positive();
const schema = z.object({
  titulo: z.string().trim().min(1).max(200),
  leadId: z.string().uuid().nullable(),
  cliente: z.object({ nome: z.string().trim().min(1).max(200), empresa: z.string().max(200),
    cnpj: z.string().max(20), telefone: z.string().max(30), email: z.string().email().or(z.literal('')) }),
  equipamentos: z.array(z.object({ id: z.string().min(1).max(100), nome: z.string().trim().min(1).max(160),
    potenciaW: z.number().finite().nonnegative(), quantidade: z.number().int().nonnegative(), horasDia: z.number().finite().min(0).max(24) })).min(1).max(500),
  config: z.object({ eficienciaInversor: percentual, profundidadeDescarga: percentual, eficienciaCarga: percentual,
    tensaoBateria: positivo, capacidadeBateriaAh: positivo, irradiacaoSolar: positivo, potenciaModuloWp: positivo,
    perdasSistema: z.number().finite().min(0).lt(100), fatorDias: positivo }),
});
const colunas = 'id, titulo, lead_id AS "leadId", dados, resultados, atualizado_em AS "atualizadoEm"';
offGridRouter.get('/', asyncHandler(async (_req, res) => {
  res.json({ simulacoes: await consultar(`SELECT id,titulo,lead_id AS "leadId",atualizado_em AS "atualizadoEm" FROM "SolarCosta_SimulacoesOffGrid" ORDER BY atualizado_em DESC`) });
}));
offGridRouter.get('/:id', asyncHandler(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const [simulacao] = await consultar(`SELECT ${colunas} FROM "SolarCosta_SimulacoesOffGrid" WHERE id=$1`, [id]);
  if (!simulacao) throw naoEncontrado('Simulação');
  res.json({ simulacao });
}));
for (const metodo of ['post', 'put'] as const) {
  offGridRouter[metodo](metodo === 'post' ? '/' : '/:id', exigirPermissao('emitir_propostas'), asyncHandler(async (req, res) => {
    const dados = schema.parse(req.body);
    const id = metodo === 'put' ? z.string().uuid().parse(req.params.id) : undefined;
    let resultados;
    try { resultados = dimensionarSistema(dados.equipamentos, dados.config); }
    catch (e) { throw new AppError(422, e instanceof Error ? e.message : 'Cálculo inválido.'); }
    const simulacao = await emTransacao(async cliente => {
      if (dados.leadId) {
        const lead = await cliente.query('SELECT id FROM "SolarCosta_Leads" WHERE id=$1 AND excluido_em IS NULL FOR SHARE', [dados.leadId]);
        if (!lead.rowCount) throw naoEncontrado('Lead');
      }
      const valores = [dados.titulo, dados.leadId, JSON.stringify(dados), JSON.stringify(resultados)];
      const { rows } = await cliente.query(metodo === 'post'
        ? `INSERT INTO "SolarCosta_SimulacoesOffGrid" (titulo,lead_id,dados,resultados,criado_por) VALUES ($1,$2,$3,$4,$5) RETURNING ${colunas}`
        : `UPDATE "SolarCosta_SimulacoesOffGrid" SET titulo=$1,lead_id=$2,dados=$3,resultados=$4,atualizado_em=now() WHERE id=$5 RETURNING ${colunas}`,
      [...valores, id ?? ator(req).id]);
      if (!rows[0]) throw naoEncontrado('Simulação');
      return rows[0];
    }, ator(req));
    res.status(metodo === 'post' ? 201 : 200).json({ simulacao });
  }));
}
