import { Router } from 'express';
import { z } from 'zod';
import { consultar, emTransacao } from '../db.js';
import { AppError, asyncHandler, naoEncontrado } from '../errors.js';
import { ator, exigirLogin, type RequestAutenticado } from '../auth/middleware.js';

export const placasRouter = Router();
placasRouter.use(exigirLogin);
const schema = z.object({
 produtoId: z.string().uuid('Selecione um produto.'),
 fabricante: z.string().trim().min(1).max(120), modelo: z.string().trim().min(1).max(160),
 potenciaWp: z.number().int().min(1).max(3000), larguraM: z.number().min(0.2).max(10),
 alturaM: z.number().min(0.2).max(10), pesoKg: z.number().positive().max(200),
 observacoes: z.string().max(5000).default(''), ativo: z.boolean().default(true),
});
const colunas = `id, produto_id AS "produtoId", fabricante, modelo, potencia_wp AS "potenciaWp", largura_m AS "larguraM", altura_m AS "alturaM", peso_kg AS "pesoKg", observacoes, ativo`;
placasRouter.get('/', asyncHandler(async (_req, res) => {
 res.json({ placas: await consultar(`SELECT p.id, p.produto_id AS "produtoId", pr.nome AS "produtoNome", pr.codigo AS "produtoCodigo",
 p.fabricante, p.modelo, COALESCE(pr.potencia_wp,p.potencia_wp) AS "potenciaWp",
 p.largura_m AS "larguraM", p.altura_m AS "alturaM", p.peso_kg AS "pesoKg", p.observacoes, p.ativo,
 (p.ativo AND COALESCE(pr.ativo AND pr.tipo_codigo='modulo',false)) AS disponivel
 FROM "SolarCosta_Placas" p LEFT JOIN "SolarCosta_Produtos" pr ON pr.id=p.produto_id ORDER BY p.fabricante,p.modelo`) });
}));
for (const metodo of ['post', 'put'] as const) {
 placasRouter[metodo](metodo === 'post' ? '/' : '/:id', asyncHandler(async (req: RequestAutenticado, res) => {
  const d = schema.parse(req.body);
  const id = metodo === 'put' ? z.string().uuid().parse(req.params.id) : undefined;
  const placa = await emTransacao(async cliente => {
   const { rows: produtos } = await cliente.query(`SELECT potencia_wp FROM "SolarCosta_Produtos" WHERE id=$1 AND ativo AND tipo_codigo='modulo' FOR SHARE`, [d.produtoId]);
   if (!produtos[0]) throw new AppError(422, 'Selecione um produto ativo do tipo Módulo.', 'produto_invalido');
   if (produtos[0].potencia_wp && produtos[0].potencia_wp !== d.potenciaWp) throw new AppError(422, 'A potência deve corresponder à potência cadastrada no produto.', 'potencia_divergente');
   const valores = [d.fabricante, d.modelo, d.potenciaWp, d.larguraM, d.alturaM, d.pesoKg, d.observacoes, d.ativo];
   const { rows } = await cliente.query(metodo === 'post'
    ? `INSERT INTO "SolarCosta_Placas" (fabricante,modelo,potencia_wp,largura_m,altura_m,peso_kg,observacoes,ativo,produto_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${colunas}`
    : `UPDATE "SolarCosta_Placas" SET fabricante=$1,modelo=$2,potencia_wp=$3,largura_m=$4,altura_m=$5,peso_kg=$6,observacoes=$7,ativo=$8,produto_id=$9 WHERE id=$10 RETURNING ${colunas}`,
    id ? [...valores,d.produtoId,id] : [...valores,d.produtoId]);
   if (!rows[0]) throw naoEncontrado('Placa');
   await cliente.query(`SELECT "SolarCosta_fn_auditar"($1,'Produto',$2,$3,NULL)`, [metodo === 'post' ? 'criar' : 'editar', `Placa: ${d.fabricante} ${d.modelo}`, d.produtoId]);
   return rows[0];
  }, ator(req));
  res.status(metodo === 'post' ? 201 : 200).json({ placa });
 }));
}
