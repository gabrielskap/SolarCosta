// Emissão e verificação de tokens.
//
// Dois tokens com papéis distintos:
//   · access  — JWT curto (15 min), viaja em toda requisição, não é persistido.
//   · refresh — string aleatória longa, guardada em SolarCosta_Sessoes apenas
//               como hash SHA-256. Se o banco vazar, os refresh tokens não são
//               utilizáveis.

import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import type { Cliente } from '../db.js';

export interface PayloadAcesso {
  sub: string; // id do usuário
  nome: string;
  cargo: string;
}

export function emitirTokenAcesso(payload: PayloadAcesso): string {
  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.ACCESS_TOKEN_TTL,
    issuer: 'solarcosta-api',
  } as jwt.SignOptions);
}

export function verificarTokenAcesso(token: string): PayloadAcesso {
  return jwt.verify(token, config.JWT_SECRET, { issuer: 'solarcosta-api' }) as PayloadAcesso;
}

/** Refresh token: 64 bytes aleatórios em base64url. */
export function gerarRefreshToken(): string {
  return crypto.randomBytes(64).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function expiracaoRefresh(): Date {
  const d = new Date();
  d.setDate(d.getDate() + config.REFRESH_TOKEN_TTL_DIAS);
  return d;
}

interface DadosSessao {
  usuarioId: string;
  ip?: string | undefined;
  userAgent?: string | undefined;
}

/** Grava a sessão e devolve o refresh token em claro (só o hash fica no banco). */
export async function criarSessao(cliente: Cliente, dados: DadosSessao): Promise<string> {
  const token = gerarRefreshToken();

  await cliente.query(
    `INSERT INTO "SolarCosta_Sessoes" (usuario_id, token_hash, ip, user_agent, expira_em)
     VALUES ($1, $2, $3, $4, $5)`,
    [dados.usuarioId, hashRefreshToken(token), dados.ip ?? null, dados.userAgent ?? null, expiracaoRefresh()],
  );

  return token;
}

/** Revoga a sessão atual e abre outra — rotação a cada refresh. */
export async function rotacionarSessao(
  cliente: Cliente,
  tokenAntigo: string,
  dados: DadosSessao,
): Promise<string> {
  await cliente.query(
    `UPDATE "SolarCosta_Sessoes"
        SET revogado_em = now()
      WHERE token_hash = $1 AND revogado_em IS NULL`,
    [hashRefreshToken(tokenAntigo)],
  );

  return criarSessao(cliente, dados);
}

/** Limpeza periódica: sessões expiradas ou revogadas há mais de 30 dias. */
export async function limparSessoes(cliente: Cliente): Promise<number> {
  const { rowCount } = await cliente.query(
    `DELETE FROM "SolarCosta_Sessoes"
      WHERE expira_em < now()
         OR (revogado_em IS NOT NULL AND revogado_em < now() - interval '30 days')`,
  );
  return rowCount ?? 0;
}
