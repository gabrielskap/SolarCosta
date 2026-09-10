// Montagem do Express.

import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
import { publicoRouter } from './routes/publico.routes.js';
import { solarRouter } from './routes/solar.routes.js';
import { usuariosRouter } from './routes/usuarios.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// dist/app.js -> ../public, onde o Dockerfile copia o build do frontend.
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const INDEX_HTML = path.join(PUBLIC_DIR, 'index.html');

export function criarApp(): express.Express {
  const app = express();

  // Atrás do Nginx: confia no X-Forwarded-For para o rate limit e o log de IP.
  app.set('trust proxy', 1);

  // CSP: 'self' por padrão, mais as exceções abaixo.
  //
  // Qualquer mudança aqui precisa ser espelhada em deploy/nginx/solarcosta.conf,
  // que manda o MESMO header. Dois CSP na mesma resposta se INTERSECTAM — o
  // navegador exige que a origem passe nos dois —, então liberar só de um lado
  // não libera nada, e o sintoma é um recurso que some sem erro de servidor.
  //
  // Exceções além do 'self' padrão do helmet:
  // - ViaCEP (connect-src): a busca de endereço por CEP (src/services/cep.ts)
  //   chama https://viacep.com.br direto do navegador.
  // - Beacon da Cloudflare (script-src/connect-src): injetado pelo proxy da
  //   Cloudflare (Web Analytics), não faz parte do nosso build.
  // - blob: (img-src): a imagem de satélite (GET /api/solar/imagem) chega pela
  //   nossa origem, mas o front busca como blob e exibe via createObjectURL.
  // - Google Maps: o editor de telhado em tela cheia (EditorTelhado.tsx) usa a
  //   Maps JavaScript API. É a única parte do sistema que fala com o Google
  //   direto do navegador — o resto passa pelo nosso proxy.
  //
  // Sobre o Maps e o XSS: o loader é um <script src> criado por nós
  // (useGoogleMaps.ts), então NÃO precisa de 'unsafe-inline' em script-src, e
  // ele segue sem. O Maps escreve style= nos elementos, o que exigiria
  // 'unsafe-inline' em style-src — mas o default do helmet já traz
  // ("'self'", 'https:', "'unsafe-inline'"), então nada foi afrouxado ali.
  // Os hosts são fixos onde dá; os tiles de satélite vêm de subdomínios
  // rotativos (khms0/khms1…, *.ggpht.com) e aí o curinga é inevitável.
  const hostsGoogleMaps = ['https://maps.googleapis.com', 'https://maps.gstatic.com'];
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          ...helmet.contentSecurityPolicy.getDefaultDirectives(),
          'script-src': ["'self'", 'https://static.cloudflareinsights.com', ...hostsGoogleMaps],
          'connect-src': [
            "'self'",
            'https://viacep.com.br',
            'https://cloudflareinsights.com',
            ...hostsGoogleMaps,
          ],
          'img-src': [
            "'self'",
            'data:',
            'blob:',
            ...hostsGoogleMaps,
            // Tiles de satélite: khms0/khms1/… .googleapis.com e *.ggpht.com.
            'https://*.googleapis.com',
            'https://*.gstatic.com',
            'https://*.ggpht.com',
          ],
          'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
          // O Maps no modo vetorial roda worker a partir de blob:. Sem esta
          // linha o worker-src cai no default-src ('self') e o mapa trava.
          'worker-src': ["'self'", 'blob:'],
        },
      },
    }),
  );
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

  // Site institucional: único router sem exigirLogin. Ver publico.routes.ts.
  app.use('/api/publico', publicoRouter);

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
  app.use('/api/solar', solarRouter);
  app.use('/api/config', configRouter);
  app.use('/api/auditoria', auditoriaRouter);

  // Estático do front (build do Vite) — não existe em dev, quando o front
  // sobe separado pelo `vite` na porta 3000.
  if (existsSync(PUBLIC_DIR)) {
    app.use(express.static(PUBLIC_DIR, { index: false, maxAge: '1y', immutable: true }));
  }

  app.use((req, res) => {
    // /api/* e /health inexistentes continuam JSON. Todo o resto é rota do
    // React Router: devolve o index.html e deixa o front decidir (SPA fallback).
    const eRotaApi = req.path.startsWith('/api/') || req.path === '/health';
    if (eRotaApi || req.method !== 'GET' || !existsSync(INDEX_HTML)) {
      res.status(404).json({ erro: 'Rota não encontrada.', codigo: 'rota_inexistente' });
      return;
    }
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(INDEX_HTML);
  });

  app.use(tratarErros);

  return app;
}
