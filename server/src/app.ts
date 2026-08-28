// Montagem do Express.

import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.js';
import { consultarUm } from './db.js';
import { asyncHandler, tratarErros } from './errors.js';
import { agendaRouter } from './routes/agenda.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { catalogoRouter } from './routes/catalogo.routes.js';
import { contratosRouter } from './routes/contratos.routes.js';
import { financeiroRouter } from './routes/financeiro.routes.js';
import { leadsRouter } from './routes/leads.routes.js';
import { obrasRouter } from './routes/obras.routes.js';
import {
  auditoriaRouter,
  configRouter,
  dashboardRouter,
  notificacoesRouter,
} from './routes/painel.routes.js';
import { propostasRouter } from './routes/propostas.routes.js';
import { usuariosRouter } from './routes/usuarios.routes.js';

export function criarApp(): express.Express {
  const app = express();

  // Atrás do Nginx: confia no X-Forwarded-For para o rate limit e o log de IP.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '2mb' }));

  // Sonda para o Docker/Nginx: confirma que o banco responde.
  app.get(
    '/health',
    asyncHandler(async (_req, res) => {
      const linha = await consultarUm<{ ok: number }>('SELECT 1 AS ok');
      res.json({ status: linha ? 'ok' : 'degradado', versao: '1.0.0' });
    }),
  );

  app.use('/api/auth', authRouter);
  app.use('/api/leads', leadsRouter);
  app.use('/api/propostas', propostasRouter);
  app.use('/api/contratos', contratosRouter);
  app.use('/api/obras', obrasRouter);
  app.use('/api/financeiro', financeiroRouter);
  app.use('/api/catalogo', catalogoRouter);
  app.use('/api/agenda', agendaRouter);
  app.use('/api/usuarios', usuariosRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/notificacoes', notificacoesRouter);
  app.use('/api/config', configRouter);
  app.use('/api/auditoria', auditoriaRouter);

  app.use((_req, res) => {
    res.status(404).json({ erro: 'Rota não encontrada.', codigo: 'rota_inexistente' });
  });

  app.use(tratarErros);

  return app;
}
