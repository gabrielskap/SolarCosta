// Rotas de autenticação.
//
// Substitui o LoginView.tsx atual, que aceita qualquer senha desde que o
// e-mail exista (src/components/LoginView.tsx:40).

import bcrypt from 'bcryptjs';
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { consultarUm, emTransacao } from '../db.js';
import { asyncHandler, naoAutorizado } from '../errors.js';
import { ator, carregarUsuario, exigirLogin, type RequestAutenticado } from '../auth/middleware.js';
import {
  criarSessao,
  emitirTokenAcesso,
  hashRefreshToken,
  rotacionarSessao,
} from '../auth/tokens.js';

export const authRouter = Router();

// Freio contra força bruta: 10 tentativas por IP a cada 15 minutos.
const limiteLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas de login. Tente de novo em alguns minutos.', codigo: 'excesso_tentativas' },
});

const loginSchema = z.object({
  email: z.string().email('E-mail inválido.'),
  senha: z.string().min(1, 'Informe a senha.'),
});

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

interface LinhaLogin {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  status: string;
  senha_hash: string;
}

authRouter.post(
  '/login',
  limiteLogin,
  asyncHandler(async (req, res) => {
    const { email, senha } = loginSchema.parse(req.body);

    const usuario = await consultarUm<LinhaLogin>(
      `SELECT id, nome, email::text AS email, cargo::text AS cargo,
              status::text AS status, senha_hash
         FROM "SolarCosta_Usuarios"
        WHERE email = $1 AND excluido_em IS NULL`,
      [email],
    );

    // Mesma mensagem para e-mail inexistente e senha errada: não entregamos
    // ao atacante a informação de quais e-mails existem.
    if (!usuario) {
      // Compara mesmo assim, para o tempo de resposta não denunciar o caso.
      await bcrypt.compare(senha, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
      throw naoAutorizado();
    }

    const confere = await bcrypt.compare(senha, usuario.senha_hash);
    if (!confere) throw naoAutorizado();

    if (usuario.status !== 'ativo') {
      throw naoAutorizado('Usuário inativo. Procure o administrador.');
    }

    const refreshToken = await emTransacao(
      async (cliente) => {
        await cliente.query(
          `UPDATE "SolarCosta_Usuarios" SET ultimo_acesso = now() WHERE id = $1`,
          [usuario.id],
        );

        await cliente.query(
          `SELECT "SolarCosta_fn_auditar"('login', 'Sessão', 'Entrou no sistema', NULL, NULL)`,
        );

        return criarSessao(cliente, {
          usuarioId: usuario.id,
          ip: req.ip,
          userAgent: req.get('user-agent'),
        });
      },
      { id: usuario.id, nome: usuario.nome },
    );

    const completo = await carregarUsuario(usuario.id);

    res.json({
      accessToken: emitirTokenAcesso({ sub: usuario.id, nome: usuario.nome, cargo: usuario.cargo }),
      refreshToken,
      usuario: completo,
    });
  }),
);

authRouter.post(
  '/refresh',
  asyncHandler(async (req, res) => {
    const { refreshToken } = refreshSchema.parse(req.body);

    const sessao = await consultarUm<{ usuario_id: string; nome: string; cargo: string }>(
      `SELECT s.usuario_id, u.nome, u.cargo::text AS cargo
         FROM "SolarCosta_Sessoes" s
         JOIN "SolarCosta_Usuarios" u ON u.id = s.usuario_id
        WHERE s.token_hash = $1
          AND s.revogado_em IS NULL
          AND s.expira_em > now()
          AND u.status = 'ativo'
          AND u.excluido_em IS NULL`,
      [hashRefreshToken(refreshToken)],
    );

    if (!sessao) throw naoAutorizado('Sessão inválida ou expirada. Entre novamente.');

    const novoRefresh = await emTransacao(
      (cliente) =>
        rotacionarSessao(cliente, refreshToken, {
          usuarioId: sessao.usuario_id,
          ip: req.ip,
          userAgent: req.get('user-agent'),
        }),
      { id: sessao.usuario_id, nome: sessao.nome },
    );

    res.json({
      accessToken: emitirTokenAcesso({ sub: sessao.usuario_id, nome: sessao.nome, cargo: sessao.cargo }),
      refreshToken: novoRefresh,
    });
  }),
);

authRouter.post(
  '/logout',
  exigirLogin,
  asyncHandler(async (req: RequestAutenticado, res) => {
    const parsed = refreshSchema.safeParse(req.body);

    await emTransacao(async (cliente) => {
      if (parsed.success) {
        await cliente.query(
          `UPDATE "SolarCosta_Sessoes"
              SET revogado_em = now()
            WHERE token_hash = $1 AND revogado_em IS NULL`,
          [hashRefreshToken(parsed.data.refreshToken)],
        );
      }
      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('logout', 'Sessão', 'Saiu do sistema', NULL, NULL)`,
      );
    }, ator(req));

    res.status(204).end();
  }),
);

authRouter.get(
  '/me',
  exigirLogin,
  asyncHandler(async (req: RequestAutenticado, res) => {
    res.json({ usuario: req.usuario });
  }),
);
