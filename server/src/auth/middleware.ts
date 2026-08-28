// Autenticação e autorização.
//
// `exigirLogin` valida o JWT e carrega as permissões do usuário a cada
// requisição — permissão revogada pelo administrador vale na hora seguinte,
// sem esperar o token expirar.

import type { NextFunction, Request, Response } from 'express';
import { consultarUm } from '../db.js';
import { naoAutorizado, semPermissao } from '../errors.js';
import { verificarTokenAcesso } from './tokens.js';

export type Permissao =
  | 'criar_editar_leads'
  | 'emitir_propostas'
  | 'anexar_documentos'
  | 'emitir_contratos'
  | 'ver_lancamentos_financeiro'
  | 'gerenciar_usuarios'
  | 'gerenciar_obras'
  | 'ver_auditoria';

export interface UsuarioAutenticado {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  permissoes: Record<Permissao, boolean>;
}

export interface RequestAutenticado extends Request {
  usuario: UsuarioAutenticado;
}

interface LinhaUsuario {
  id: string;
  nome: string;
  email: string;
  cargo: string;
  status: string;
  criar_editar_leads: boolean | null;
  emitir_propostas: boolean | null;
  anexar_documentos: boolean | null;
  emitir_contratos: boolean | null;
  ver_lancamentos_financeiro: boolean | null;
  gerenciar_usuarios: boolean | null;
  gerenciar_obras: boolean | null;
  ver_auditoria: boolean | null;
}

function extrairToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

export async function carregarUsuario(id: string): Promise<UsuarioAutenticado | null> {
  const linha = await consultarUm<LinhaUsuario>(
    `SELECT u.id, u.nome, u.email::text AS email, u.cargo::text AS cargo, u.status::text AS status,
            p.criar_editar_leads, p.emitir_propostas, p.anexar_documentos, p.emitir_contratos,
            p.ver_lancamentos_financeiro, p.gerenciar_usuarios, p.gerenciar_obras, p.ver_auditoria
       FROM "SolarCosta_Usuarios" u
       LEFT JOIN "SolarCosta_UsuarioPermissoes" p ON p.usuario_id = u.id
      WHERE u.id = $1 AND u.excluido_em IS NULL`,
    [id],
  );

  if (!linha || linha.status !== 'ativo') return null;

  // O Administrador tem tudo por definição de cargo, independente da tabela.
  const admin = linha.cargo === 'Administrador';
  const ou = (v: boolean | null) => admin || v === true;

  return {
    id: linha.id,
    nome: linha.nome,
    email: linha.email,
    cargo: linha.cargo,
    permissoes: {
      criar_editar_leads: ou(linha.criar_editar_leads),
      emitir_propostas: ou(linha.emitir_propostas),
      anexar_documentos: ou(linha.anexar_documentos),
      emitir_contratos: ou(linha.emitir_contratos),
      ver_lancamentos_financeiro: ou(linha.ver_lancamentos_financeiro),
      gerenciar_usuarios: ou(linha.gerenciar_usuarios),
      gerenciar_obras: ou(linha.gerenciar_obras),
      ver_auditoria: ou(linha.ver_auditoria),
    },
  };
}

export function exigirLogin(req: Request, _res: Response, next: NextFunction): void {
  const token = extrairToken(req);
  if (!token) {
    next(naoAutorizado('Faça login para continuar.'));
    return;
  }

  let payload;
  try {
    payload = verificarTokenAcesso(token);
  } catch {
    next(naoAutorizado('Sessão expirada. Entre novamente.'));
    return;
  }

  carregarUsuario(payload.sub)
    .then((usuario) => {
      if (!usuario) {
        next(naoAutorizado('Usuário inativo ou removido.'));
        return;
      }
      (req as RequestAutenticado).usuario = usuario;
      next();
    })
    .catch(next);
}

export function exigirPermissao(...permissoes: Permissao[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const usuario = (req as RequestAutenticado).usuario;
    if (!usuario) {
      next(naoAutorizado());
      return;
    }

    const faltando = permissoes.filter((p) => !usuario.permissoes[p]);
    if (faltando.length > 0) {
      next(semPermissao());
      return;
    }
    next();
  };
}

/** Converte o usuário autenticado no formato que `emTransacao` espera. */
export function ator(req: Request): { id: string; nome: string } {
  const u = (req as RequestAutenticado).usuario;
  return { id: u.id, nome: u.nome };
}
