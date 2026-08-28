// Usuários e permissões.
//
// Substitui UsersView. `senha_hash` nunca sai daqui num SELECT — nem para o
// Administrador. Trocar senha é operação própria, não um PATCH de campo.

import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { consultar, consultarUm, emTransacao } from '../db.js';
import { AppError, asyncHandler, naoAutorizado, naoEncontrado } from '../errors.js';
import { ator, exigirLogin, exigirPermissao, type RequestAutenticado } from '../auth/middleware.js';

export const usuariosRouter = Router();
usuariosRouter.use(exigirLogin);

const CARGOS = ['Administrador', 'Vendedor', 'Financeiro', 'Engenheiro', 'Instalador'] as const;
const CUSTO_BCRYPT = 12;

const permissoesSchema = z.object({
  criar_editar_leads: z.boolean().optional(),
  emitir_propostas: z.boolean().optional(),
  anexar_documentos: z.boolean().optional(),
  emitir_contratos: z.boolean().optional(),
  ver_lancamentos_financeiro: z.boolean().optional(),
  gerenciar_usuarios: z.boolean().optional(),
  gerenciar_obras: z.boolean().optional(),
  ver_auditoria: z.boolean().optional(),
});

const usuarioSchema = z.object({
  nome: z.string().min(1, 'Informe o nome.').max(200),
  email: z.string().email('E-mail inválido.'),
  telefone: z.string().max(30).nullish(),
  cargo: z.enum(CARGOS),
  status: z.enum(['ativo', 'inativo']).default('ativo'),
  crea: z.string().max(40).nullish(),
  permissoes: permissoesSchema.optional(),
});

const SELECT_USUARIO = `
  SELECT u.id, u.nome, u.email::text AS email, u.telefone, u.cargo::text AS cargo,
         u.status::text AS status, u.crea, u.avatar_url, u.ultimo_acesso, u.criado_em,
         COALESCE(p.criar_editar_leads, false)         AS criar_editar_leads,
         COALESCE(p.emitir_propostas, false)           AS emitir_propostas,
         COALESCE(p.anexar_documentos, false)          AS anexar_documentos,
         COALESCE(p.emitir_contratos, false)           AS emitir_contratos,
         COALESCE(p.ver_lancamentos_financeiro, false) AS ver_lancamentos_financeiro,
         COALESCE(p.gerenciar_usuarios, false)         AS gerenciar_usuarios,
         COALESCE(p.gerenciar_obras, false)            AS gerenciar_obras,
         COALESCE(p.ver_auditoria, false)              AS ver_auditoria
    FROM "SolarCosta_Usuarios" u
    LEFT JOIN "SolarCosta_UsuarioPermissoes" p ON p.usuario_id = u.id
   WHERE u.excluido_em IS NULL`;

// Lista visível a todos: o Kanban e a agenda precisam dos nomes para atribuir
// responsável. Dados sensíveis não estão no SELECT.
usuariosRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const usuarios = await consultar(`${SELECT_USUARIO} ORDER BY u.nome`);
    res.json({ usuarios });
  }),
);

usuariosRouter.get(
  '/:id',
  exigirPermissao('gerenciar_usuarios'),
  asyncHandler(async (req, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const usuario = await consultarUm(`${SELECT_USUARIO} AND u.id = $1`, [id]);
    if (!usuario) throw naoEncontrado('Usuário');
    res.json({ usuario });
  }),
);

usuariosRouter.post(
  '/',
  exigirPermissao('gerenciar_usuarios'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const d = usuarioSchema
      .extend({ senha: z.string().min(8, 'A senha precisa de pelo menos 8 caracteres.') })
      .parse(req.body);

    const hash = await bcrypt.hash(d.senha, CUSTO_BCRYPT);

    const id = await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `INSERT INTO "SolarCosta_Usuarios" (nome, email, senha_hash, telefone, cargo, status, crea)
         VALUES ($1,$2::citext,$3,$4,$5,$6,$7) RETURNING id`,
        [d.nome, d.email, hash, d.telefone ?? null, d.cargo, d.status, d.crea ?? null],
      );
      const novoId = rows[0]!.id as string;

      await gravarPermissoes(cliente, novoId, d.permissoes ?? padraoPorCargo(d.cargo));

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('criar','Usuário',$1,$2,NULL)`,
        [`${d.nome} (${d.cargo})`, novoId],
      );
      return novoId;
    }, ator(req));

    const usuario = await consultarUm(`${SELECT_USUARIO} AND u.id = $1`, [id]);
    res.status(201).json({ usuario });
  }),
);

usuariosRouter.patch(
  '/:id',
  exigirPermissao('gerenciar_usuarios'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const d = usuarioSchema.partial().parse(req.body);

    // Não deixa o último administrador ativo se desligar ou trocar de cargo.
    if (d.status === 'inativo' || (d.cargo && d.cargo !== 'Administrador')) {
      await garantirOutroAdmin(id);
    }

    await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_Usuarios" SET
            nome     = COALESCE($2, nome),
            email    = COALESCE($3::citext, email),
            telefone = COALESCE($4, telefone),
            cargo    = COALESCE($5::"SolarCosta_PerfilUsuario", cargo),
            status   = COALESCE($6::"SolarCosta_StatusUsuario", status),
            crea     = COALESCE($7, crea)
          WHERE id = $1 AND excluido_em IS NULL
          RETURNING nome, cargo::text AS cargo`,
        [id, d.nome ?? null, d.email ?? null, d.telefone ?? null,
         d.cargo ?? null, d.status ?? null, d.crea ?? null],
      );
      if (rows.length === 0) throw naoEncontrado('Usuário');

      if (d.permissoes) await gravarPermissoes(cliente, id, d.permissoes);

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('editar','Usuário',$1,$2,NULL)`,
        [`${rows[0]!.nome} (${rows[0]!.cargo})`, id],
      );
    }, ator(req));

    const usuario = await consultarUm(`${SELECT_USUARIO} AND u.id = $1`, [id]);
    res.json({ usuario });
  }),
);

// Troca de senha pelo próprio usuário: exige a senha atual.
usuariosRouter.patch(
  '/me/senha',
  asyncHandler(async (req: RequestAutenticado, res) => {
    const { senha_atual, senha_nova } = z
      .object({
        senha_atual: z.string().min(1, 'Informe a senha atual.'),
        senha_nova: z.string().min(8, 'A nova senha precisa de pelo menos 8 caracteres.'),
      })
      .parse(req.body);

    const atual = await consultarUm<{ senha_hash: string }>(
      `SELECT senha_hash FROM "SolarCosta_Usuarios" WHERE id = $1`, [req.usuario.id]);
    if (!atual || !(await bcrypt.compare(senha_atual, atual.senha_hash))) {
      throw naoAutorizado('Senha atual incorreta.');
    }

    const hash = await bcrypt.hash(senha_nova, CUSTO_BCRYPT);

    await emTransacao(async (cliente) => {
      await cliente.query(
        `UPDATE "SolarCosta_Usuarios" SET senha_hash = $2 WHERE id = $1`,
        [req.usuario.id, hash],
      );
      // Trocar a senha derruba as outras sessões.
      await cliente.query(
        `UPDATE "SolarCosta_Sessoes" SET revogado_em = now()
          WHERE usuario_id = $1 AND revogado_em IS NULL`,
        [req.usuario.id],
      );
      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('editar','Usuário',$1,$2,'Senha alterada pelo próprio usuário.')`,
        [req.usuario.nome, req.usuario.id],
      );
    }, ator(req));

    res.status(204).end();
  }),
);

// Reset pelo administrador: não pede a senha antiga.
usuariosRouter.patch(
  '/:id/senha',
  exigirPermissao('gerenciar_usuarios'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);
    const { senha_nova } = z
      .object({ senha_nova: z.string().min(8, 'A senha precisa de pelo menos 8 caracteres.') })
      .parse(req.body);

    const hash = await bcrypt.hash(senha_nova, CUSTO_BCRYPT);

    await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_Usuarios" SET senha_hash = $2
          WHERE id = $1 AND excluido_em IS NULL RETURNING nome`,
        [id, hash],
      );
      if (rows.length === 0) throw naoEncontrado('Usuário');

      await cliente.query(
        `UPDATE "SolarCosta_Sessoes" SET revogado_em = now()
          WHERE usuario_id = $1 AND revogado_em IS NULL`, [id]);

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('editar','Usuário',$1,$2,'Senha redefinida pelo administrador.')`,
        [rows[0]!.nome, id],
      );
    }, ator(req));

    res.status(204).end();
  }),
);

usuariosRouter.delete(
  '/:id',
  exigirPermissao('gerenciar_usuarios'),
  asyncHandler(async (req: RequestAutenticado, res) => {
    const id = z.string().uuid().parse(req.params.id);

    if (id === req.usuario.id) {
      throw new AppError(409, 'Você não pode excluir a própria conta.', 'autoexclusao');
    }
    await garantirOutroAdmin(id);

    await emTransacao(async (cliente) => {
      const { rows } = await cliente.query(
        `UPDATE "SolarCosta_Usuarios" SET excluido_em = now(), status = 'inativo'
          WHERE id = $1 AND excluido_em IS NULL RETURNING nome`, [id]);
      if (rows.length === 0) throw naoEncontrado('Usuário');

      await cliente.query(
        `UPDATE "SolarCosta_Sessoes" SET revogado_em = now()
          WHERE usuario_id = $1 AND revogado_em IS NULL`, [id]);

      await cliente.query(
        `SELECT "SolarCosta_fn_auditar"('excluir','Usuário',$1,$2,NULL)`, [rows[0]!.nome, id]);
    }, ator(req));

    res.status(204).end();
  }),
);

/* ------------------------------------------------------------- internos -- */

/** Impede que a instalação fique sem nenhum administrador ativo. */
async function garantirOutroAdmin(idExcluido: string): Promise<void> {
  const linha = await consultarUm<{ restantes: number }>(
    `SELECT count(*)::int AS restantes
       FROM "SolarCosta_Usuarios"
      WHERE cargo = 'Administrador' AND status = 'ativo'
        AND excluido_em IS NULL AND id <> $1`,
    [idExcluido],
  );

  if ((linha?.restantes ?? 0) === 0) {
    throw new AppError(
      409,
      'Este é o único administrador ativo. Promova outro usuário antes de continuar.',
      'ultimo_admin',
    );
  }
}

type Permissoes = z.infer<typeof permissoesSchema>;

/** Sugestão inicial de permissões por cargo — o admin pode ajustar depois. */
function padraoPorCargo(cargo: (typeof CARGOS)[number]): Permissoes {
  const vendas = cargo === 'Administrador' || cargo === 'Vendedor';
  const financeiro = cargo === 'Administrador' || cargo === 'Financeiro';
  const campo = cargo === 'Administrador' || cargo === 'Engenheiro' || cargo === 'Instalador';
  const admin = cargo === 'Administrador';

  return {
    criar_editar_leads: vendas,
    emitir_propostas: vendas,
    anexar_documentos: vendas || campo,
    emitir_contratos: financeiro,
    ver_lancamentos_financeiro: financeiro,
    gerenciar_usuarios: admin,
    gerenciar_obras: campo,
    ver_auditoria: admin,
  };
}

async function gravarPermissoes(
  cliente: import('../db.js').Cliente,
  usuarioId: string,
  p: Permissoes,
): Promise<void> {
  await cliente.query(
    `INSERT INTO "SolarCosta_UsuarioPermissoes" (
        usuario_id, criar_editar_leads, emitir_propostas, anexar_documentos, emitir_contratos,
        ver_lancamentos_financeiro, gerenciar_usuarios, gerenciar_obras, ver_auditoria
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (usuario_id) DO UPDATE SET
        criar_editar_leads         = COALESCE(EXCLUDED.criar_editar_leads, "SolarCosta_UsuarioPermissoes".criar_editar_leads),
        emitir_propostas           = COALESCE(EXCLUDED.emitir_propostas, "SolarCosta_UsuarioPermissoes".emitir_propostas),
        anexar_documentos          = COALESCE(EXCLUDED.anexar_documentos, "SolarCosta_UsuarioPermissoes".anexar_documentos),
        emitir_contratos           = COALESCE(EXCLUDED.emitir_contratos, "SolarCosta_UsuarioPermissoes".emitir_contratos),
        ver_lancamentos_financeiro = COALESCE(EXCLUDED.ver_lancamentos_financeiro, "SolarCosta_UsuarioPermissoes".ver_lancamentos_financeiro),
        gerenciar_usuarios         = COALESCE(EXCLUDED.gerenciar_usuarios, "SolarCosta_UsuarioPermissoes".gerenciar_usuarios),
        gerenciar_obras            = COALESCE(EXCLUDED.gerenciar_obras, "SolarCosta_UsuarioPermissoes".gerenciar_obras),
        ver_auditoria              = COALESCE(EXCLUDED.ver_auditoria, "SolarCosta_UsuarioPermissoes".ver_auditoria),
        atualizado_em              = now()`,
    [
      usuarioId,
      p.criar_editar_leads ?? false, p.emitir_propostas ?? false,
      p.anexar_documentos ?? false, p.emitir_contratos ?? false,
      p.ver_lancamentos_financeiro ?? false, p.gerenciar_usuarios ?? false,
      p.gerenciar_obras ?? false, p.ver_auditoria ?? false,
    ],
  );
}
