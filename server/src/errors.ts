// Erros da aplicação e a tradução dos códigos do PostgreSQL para HTTP.
//
// O schema do banco carrega muita regra de negócio (CHECKs, FKs, triggers que
// levantam exceção). Em vez de duplicar essas validações aqui, a API deixa o
// banco recusar e traduz o erro numa mensagem que o front consegue exibir.

import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly codigo?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const naoAutorizado = (msg = 'Credenciais inválidas.') => new AppError(401, msg, 'nao_autorizado');
export const semPermissao = (msg = 'Você não tem permissão para esta ação.') => new AppError(403, msg, 'sem_permissao');
export const naoEncontrado = (recurso = 'Registro') => new AppError(404, `${recurso} não encontrado.`, 'nao_encontrado');
export const conflito = (msg: string) => new AppError(409, msg, 'conflito');

interface ErroPostgres {
  code?: string;
  detail?: string;
  message?: string;
  constraint?: string;
  column?: string;
  table?: string;
}

function ehErroPostgres(e: unknown): e is ErroPostgres {
  return typeof e === 'object' && e !== null && 'code' in e;
}

/** Traduz o código SQLSTATE em status HTTP + mensagem em português. */
function traduzirPostgres(e: ErroPostgres): AppError | null {
  switch (e.code) {
    case '23505': // unique_violation
      return new AppError(409, mensagemUnica(e), 'duplicado');

    case '23503': // foreign_key_violation
      return new AppError(
        409,
        'Registro vinculado a outro cadastro. Remova ou troque o vínculo antes de continuar.',
        'vinculo_existente',
      );

    case '23502': // not_null_violation
      return new AppError(422, `O campo "${e.column ?? 'obrigatório'}" não pode ficar vazio.`, 'campo_obrigatorio');

    case '23514': // check_violation — inclui "Estoque insuficiente" do trigger
      return new AppError(422, e.message ?? 'Valor recusado por uma regra do sistema.', 'regra_violada');

    case '22P02': // invalid_text_representation
      return new AppError(400, 'Formato de dado inválido na requisição.', 'formato_invalido');

    case '22001': // string_data_right_truncation
      return new AppError(422, 'Um dos campos excedeu o tamanho permitido.', 'campo_longo');

    case 'P0001': // RAISE EXCEPTION dos nossos triggers e funções
      return new AppError(422, e.message ?? 'Operação recusada pelo banco.', 'regra_negocio');

    case '25P02': // transação abortada
      return new AppError(500, 'A transação foi abortada por um erro anterior.', 'transacao_abortada');

    default:
      return null;
  }
}

/** Mensagens específicas para as constraints únicas que o usuário encontra. */
function mensagemUnica(e: ErroPostgres): string {
  const c = e.constraint ?? '';
  if (c.includes('Usuarios_email')) return 'Já existe um usuário com esse e-mail.';
  if (c.includes('Leads_numero')) return 'Já existe um lead com esse número.';
  if (c.includes('Produtos_codigo')) return 'Já existe um produto com esse código.';
  if (c.includes('Fornecedores_cnpj')) return 'Já existe um fornecedor com esse CNPJ.';
  if (c.includes('Propostas_numero')) return 'Já existe uma proposta com esse número.';
  if (c.includes('Contratos_numero')) return 'Já existe um contrato com esse número.';
  if (c.includes('Obras_numero')) return 'Já existe uma obra com esse número.';
  return 'Esse registro já existe.';
}

/** Middleware final: nada sai daqui sem virar JSON. */
export function tratarErros(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ erro: err.message, codigo: err.codigo });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({
      erro: 'Dados inválidos.',
      codigo: 'validacao',
      campos: err.issues.map((i) => ({ campo: i.path.join('.'), mensagem: i.message })),
    });
    return;
  }

  if (ehErroPostgres(err)) {
    const traduzido = traduzirPostgres(err);
    if (traduzido) {
      res.status(traduzido.status).json({ erro: traduzido.message, codigo: traduzido.codigo });
      return;
    }
  }

  // Erro não previsto: loga inteiro no servidor, devolve genérico ao cliente.
  console.error('[erro nao tratado]', err);
  res.status(500).json({ erro: 'Erro interno no servidor.', codigo: 'interno' });
}

/** Envolve handlers async para que rejeições cheguem no middleware de erro. */
export function asyncHandler<T extends Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req as T, res, next).catch(next);
  };
}
