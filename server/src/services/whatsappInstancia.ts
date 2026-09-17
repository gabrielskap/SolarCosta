// A linha única de SolarCosta_WhatsAppInstancia.
//
// Saiu de dentro do whatsapp.routes.ts porque três lugares precisam dela agora:
// as rotas de conexão, as rotas da caixa de entrada (para responder é preciso o
// token) e o webhook. Duplicar o SELECT em cada um deixaria a lista de colunas
// divergir com o tempo.
//
// REGRA QUE VALE PARA TODO O MÓDULO: o token da instância não sai daqui em
// direção ao navegador. Quem o tiver envia mensagem no nome da empresa sem
// passar por login nenhum.

import { consultar, consultarUm } from '../db.js';
import { AppError } from '../errors.js';
import { decifrar } from './segredos.js';
import type { StatusInstancia } from './uazapi.js';

export interface LinhaInstancia {
  id: string;
  nome_instancia: string;
  instancia_id: string | null;
  token_cifrado: string | null;
  status: StatusInstancia;
  numero_conectado: string | null;
  profile_name: string | null;
  webhook_segredo: string;
  ultimo_erro: string | null;
  conectado_em: string | null;
}

/**
 * A instância da empresa.
 *
 * O V009 insere essa linha na migration, então ela existe desde o primeiro
 * deploy. Faltar aqui significa banco desatualizado — e dizer isso é mais útil
 * do que um 500 genérico.
 */
export async function carregarInstancia(): Promise<LinhaInstancia> {
  const linha = await consultarUm<LinhaInstancia>(
    `SELECT id, nome_instancia, instancia_id, token_cifrado, status::text AS status,
            numero_conectado, profile_name, webhook_segredo, ultimo_erro, conectado_em
       FROM "SolarCosta_WhatsAppInstancia" WHERE registro_unico`,
  );
  if (!linha) {
    throw new AppError(
      503,
      'Cadastro da instância de WhatsApp não encontrado. Aplique a migration V009.',
      'whatsapp_sem_instancia',
    );
  }
  return linha;
}

/** Token em texto claro, ou 409 quando ninguém conectou ainda. */
export function exigirToken(linha: LinhaInstancia): string {
  if (!linha.token_cifrado) {
    throw new AppError(
      409,
      'Nenhum número conectado. Conecte o WhatsApp pelo QR code antes.',
      'whatsapp_nao_conectado',
    );
  }
  return decifrar(linha.token_cifrado);
}

/** Recusa o envio quando o número não está de pé. */
export function exigirConectada(linha: LinhaInstancia): void {
  if (linha.status !== 'conectada') {
    throw new AppError(
      409,
      'O WhatsApp está desconectado. Reconecte o número antes de enviar.',
      'whatsapp_nao_conectado',
    );
  }
}

/**
 * Guarda a última recusa da uazapi ou do WhatsApp.
 *
 * FORA DE TRANSAÇÃO de propósito. Os pontos que chamam isto são justamente os
 * caminhos em que a transação do envio vai ser revertida — gravar o erro lá
 * dentro seria desfeito junto com o resto, e a tela continuaria sem explicação
 * para um envio que parou de funcionar.
 *
 * É esta coluna que faz o erro 463, o limite de conversas novas e a restrição
 * do WhatsApp chegarem como texto na tela de conexão, em vez de como um toast
 * que ninguém guardou.
 */
export async function registrarErroInstancia(mensagem: string): Promise<void> {
  await consultar(
    `UPDATE "SolarCosta_WhatsAppInstancia"
        SET ultimo_erro = left($1, 500), ultimo_status_em = now()
      WHERE registro_unico`,
    [mensagem],
  ).catch((erro) =>
    console.error(
      '[whatsapp] não gravou ultimo_erro:',
      erro instanceof Error ? erro.message : erro,
    ),
  );
}

/**
 * Limpa o erro depois de um envio que deu certo.
 *
 * O `WHERE ultimo_erro IS NOT NULL` evita uma escrita a cada mensagem enviada.
 * Sem esta função, uma falha passageira ficaria na tela para sempre: o
 * `salvarEstado` das rotas de conexão só limpa quando a instância RECONECTA, o
 * que não cobre o caso "conectada, mas recusando envio".
 */
export async function limparErroInstancia(): Promise<void> {
  await consultar(
    `UPDATE "SolarCosta_WhatsAppInstancia"
        SET ultimo_erro = NULL
      WHERE registro_unico AND ultimo_erro IS NOT NULL`,
  ).catch(() => {});
}

/**
 * Envolve um envio, guardando a recusa em `ultimo_erro`.
 *
 * Mora aqui, e não no arquivo de rotas, porque há dois caminhos de envio — o
 * `/enviar` a partir de um documento e o `/responder` da caixa de entrada — e
 * eles vivem em arquivos diferentes. Duplicar faria os dois divergirem na
 * primeira mudança.
 *
 * SÓ erros `whatsapp_*` viram texto na tela de conexão: um 422 de telefone
 * inválido é problema daquele cadastro, não do canal, e poluiria o aviso que
 * existe para mostrar erro 463, limite de conversas novas e banimento.
 *
 * Sucesso limpa o erro anterior — sem isso, uma falha passageira ficaria na
 * tela para sempre.
 */
export async function comRegistroDeErro<T>(fn: () => Promise<T>): Promise<T> {
  try {
    const resultado = await fn();
    await limparErroInstancia();
    return resultado;
  } catch (erro) {
    if (erro instanceof AppError && erro.codigo?.startsWith('whatsapp_')) {
      await registrarErroInstancia(erro.message);
    }
    throw erro;
  }
}
