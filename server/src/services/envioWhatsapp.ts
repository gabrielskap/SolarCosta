// O caminho de saída: manda a mensagem e grava o que aconteceu.
//
// Extraído de whatsapp.routes.ts quando a caixa de entrada ganhou o seu próprio
// "responder". Os dois caminhos precisam gravar EXATAMENTE a mesma coisa — a
// mesma linha de conversa, a mesma linha de mensagem, a mesma auditoria. Duas
// cópias divergiriam na primeira correção que alguém fizesse só num lado, e o
// sintoma seria histórico incompleto: o pior tipo de bug num CRM, porque não
// dá erro, só falta.
//
// O ENVIO FICA DENTRO DA TRANSAÇÃO, de propósito e como já era. Enviar antes e
// gravar depois perde o registro se o INSERT falhar — e mensagem enviada sem
// registro é pior que uma transação um pouco mais longa: o cliente recebeu, o
// sistema não sabe, e o vendedor manda de novo. O caminho inverso mentiria na
// tela se a uazapi recusasse.

import { type Cliente } from '../db.js';
import { AppError } from '../errors.js';
import { chatidDeTelefone } from '../utils/telefone.js';
import * as uazapi from './uazapi.js';
import { previaDe } from './whatsappConversas.js';

export interface DadosEnvio {
  token: string;
  /** Só dígitos, com DDI. */
  telefone: string;
  texto: string;
  /** Vínculo a aplicar na conversa quando ela ainda não tiver um. */
  leadId: string | null;
  autor: { id: string; nome: string };
  /**
   * Documento que esta mensagem entregou, achatado em dois campos em vez de um
   * objeto aninhado. Espelha as colunas `referencia_tipo`/`referencia_id` e
   * evita um objeto opcional dentro de outro — que o tsconfig da raiz, sem
   * `strict`, infere como `{tipo?, id?}` e recusa.
   */
  referenciaTipo: 'proposta' | 'contrato' | null;
  referenciaId: string | null;
  /** Texto do registro de auditoria, quando há documento. */
  descricaoAuditoria: string | null;
}

export interface MensagemGravada {
  conversaId: string;
  linhaId: string;
  mensagemId: string | null;
  status: string;
  ocorridoEm: string;
}

/**
 * Envia e persiste. Tem de rodar dentro de `emTransacao`.
 *
 * Devolve o que a tela precisa para mostrar a mensagem na thread sem uma nova
 * ida ao banco.
 */
export async function enviarERegistrar(
  cliente: Cliente,
  d: DadosEnvio,
): Promise<MensagemGravada> {
  const texto = d.texto.trim();
  if (!texto) throw new AppError(422, 'A mensagem ficou vazia.', 'mensagem_vazia');

  const enviada = await uazapi.enviarTexto(d.token, d.telefone, texto);
  const status = uazapi.traduzirStatusMensagem(enviada.status);

  const { rows: conversas } = await cliente.query<{ id: string }>(
    `INSERT INTO "SolarCosta_WhatsAppConversas"
        (chatid, telefone, lead_id, ultima_mensagem_texto, ultima_mensagem_em)
     VALUES ($1, $2, $3, $4, now())
     ON CONFLICT (chatid) DO UPDATE SET
        ultima_mensagem_texto = EXCLUDED.ultima_mensagem_texto,
        ultima_mensagem_em    = EXCLUDED.ultima_mensagem_em,
        -- Respondemos, então a conversa não está mais pendente.
        nao_lidas             = 0,
        arquivada             = false,
        -- Não desvincula um lead já apontado: o vínculo pode ter sido
        -- corrigido à mão, e um envio avulso não pode desfazer isso.
        lead_id               = COALESCE("SolarCosta_WhatsAppConversas".lead_id, EXCLUDED.lead_id)
     RETURNING id`,
    [chatidDeTelefone(d.telefone), d.telefone, d.leadId, previaDe('texto', texto)],
  );
  const conversaId = conversas[0]!.id;

  // ON CONFLICT DO NOTHING no mensagem_id: a uazapi pode, em teoria, devolver
  // um id que já vimos. Sem o RETURNING vazio tratado, um retry duplicaria a
  // linha na thread.
  const { rows: gravadas } = await cliente.query<{ id: string; ocorrido_em: string }>(
    `INSERT INTO "SolarCosta_WhatsAppMensagens"
        (conversa_id, mensagem_id, de_mim, tipo, texto, status,
         enviada_por_id, referencia_tipo, referencia_id)
     VALUES ($1, $2, true, 'texto', $3, $4, $5, $6, $7)
     ON CONFLICT (mensagem_id) DO NOTHING
     RETURNING id, ocorrido_em`,
    [
      conversaId,
      enviada.messageid,
      texto,
      status,
      d.autor.id,
      d.referenciaTipo,
      d.referenciaId,
    ],
  );

  // RETURNING vazio só acontece com conflito, e conflito só com mensagem_id
  // não nulo — `ON CONFLICT` não casa NULL com NULL. Ainda assim a busca é
  // condicionada: um `!` apoiado nesse raciocínio viraria crash silencioso no
  // dia em que a uazapi mudasse de comportamento.
  //
  // Já existia significa que a mensagem saiu e está registrada, só não por esta
  // chamada — devolver a linha existente é melhor do que erro: o cliente
  // recebeu.
  let linha = gravadas[0];
  if (!linha && enviada.messageid) {
    const { rows } = await cliente.query<{ id: string; ocorrido_em: string }>(
      `SELECT id, ocorrido_em FROM "SolarCosta_WhatsAppMensagens" WHERE mensagem_id = $1`,
      [enviada.messageid],
    );
    linha = rows[0];
  }
  if (!linha) {
    throw new AppError(
      500,
      'A mensagem foi enviada, mas não foi possível registrá-la. Confira a conversa antes de reenviar.',
      'whatsapp_sem_registro',
    );
  }

  await cliente.query(
    `SELECT "SolarCosta_fn_auditar"('criar','WhatsApp',$1,$2,$3)`,
    [
      `Mensagem para ${d.telefone}`,
      d.referenciaId,
      d.descricaoAuditoria,
    ],
  );

  return {
    conversaId,
    linhaId: linha.id,
    mensagemId: enviada.messageid,
    status,
    ocorridoEm: linha.ocorrido_em,
  };
}
