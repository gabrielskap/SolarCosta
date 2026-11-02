import { Router } from 'express';
import { z } from 'zod';
import { consultar, emTransacao } from '../db.js';
import { asyncHandler, naoEncontrado } from '../errors.js';
import { ator, exigirLogin } from '../auth/middleware.js';

export const aparelhosRouter = Router();
aparelhosRouter.use(exigirLogin);
const schema = z.object({
  ambiente: z.string().trim().min(1).max(80),
  nome: z.string().trim().min(1).max(160),
  potenciaW: z.number().finite().positive().max(9999999999.99).multipleOf(0.01),
});
const colunas = 'id, ambiente, nome, potencia_w AS "potenciaW"';
aparelhosRouter.get('/', asyncHandler(async (_req, res) => {
  res.json({ aparelhos: await consultar(`SELECT ${colunas} FROM "SolarCosta_Aparelhos" ORDER BY ambiente, nome`) });
}));
for (const metodo of ['post', 'put'] as const) {
  aparelhosRouter[metodo](metodo === 'post' ? '/' : '/:id', asyncHandler(async (req, res) => {
    const d = schema.parse(req.body);
    const id = metodo === 'put' ? z.string().uuid().parse(req.params.id) : undefined;
    const aparelho = await emTransacao(async cliente => {
      const { rows } = await cliente.query(metodo === 'post'
        ? `INSERT INTO "SolarCosta_Aparelhos" (ambiente,nome,potencia_w) VALUES ($1,$2,$3) RETURNING ${colunas}`
        : `UPDATE "SolarCosta_Aparelhos" SET ambiente=$1,nome=$2,potencia_w=$3 WHERE id=$4 RETURNING ${colunas}`,
      id ? [d.ambiente,d.nome,d.potenciaW,id] : [d.ambiente,d.nome,d.potenciaW]);
      if (!rows[0]) throw naoEncontrado('Aparelho');
      return rows[0];
    }, ator(req));
    res.status(metodo === 'post' ? 201 : 200).json({ aparelho });
  }));
}
aparelhosRouter.delete('/:id', asyncHandler(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  await emTransacao(async cliente => {
    const resultado = await cliente.query('DELETE FROM "SolarCosta_Aparelhos" WHERE id=$1 RETURNING id', [id]);
    if (!resultado.rowCount) throw naoEncontrado('Aparelho');
  }, ator(req));
  res.status(204).end();
}));
