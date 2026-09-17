// Conversas e mensagens: a escrita que o webhook e a caixa de entrada dividem.
//
// Toca o banco recebendo um `Cliente`, como o linksPublicos.ts — o arquivo que
// NÃO pode tocar banco é o uazapi.ts, e o que não pode fazer HTTP é o
// eventosWhatsapp.ts. Este fica no meio: é a tradução de "chegou uma mensagem"
// para linhas.
//
// A ORDEM DAS ESCRITAS É O DESENHO, não detalhe de implementação. O webhook
// pode reentregar o mesmo evento (a uazapi não documenta retry), então tudo
// aqui precisa sobreviver a ser executado duas vezes com o mesmo payload:
//   1. a conversa é garantida SEM tocar em nao_lidas nem na prévia;
//   2. a mensagem entra com ON CONFLICT (mensagem_id) DO NOTHING e diz, pelo
//      RETURNING, se era nova;
//   3. só sendo nova é que o contador sobe e a prévia muda.
// Contar no passo 1 inflaria o badge a cada reentrega.

import { type Cliente } from '../db.js';
import { chaveTelefone, telefoneDoChatid } from '../utils/telefone.js';
import type { AtualizacaoStatus, MensagemRecebida, TipoMensagem } from './eventosWhatsapp.js';

/* ============================================================= PRÉVIA == */

/** Rótulo da conversa na lista quando a mensagem não tem texto. */
const PREVIA_POR_TIPO: Record<TipoMensagem, string> = {
  texto: 'Mensagem',
  imagem: '[Foto]',
  video: '[Vídeo]',
  audio: '[Áudio]',
  documento: '[Documento]',
  contato: '[Contato]',
  local: '[Localização]',
  outro: '[Mensagem]',
};

/**
 * O texto que aparece na lista de conversas.
 *
 * Rótulo entre colchetes em vez de emoji: esta coluna também vai para log e
 * para busca, e emoji em `LIKE` e em terminal é fonte de surpresa. O corte em
 * 200 é o mesmo do envio.
 */
export function previaDe(tipo: TipoMensagem, texto: string | null): string {
  const limpo = texto?.trim();
  if (limpo) return limpo.slice(0, 200);
  return PREVIA_POR_TIPO[tipo] ?? '[Mensagem]';
}

/* ====================================================== CHAT IGNORADO == */

/**
 * O que não é conversa de cliente.
 *
 * `@broadcast` é a lista de transmissão e o "Status" do WhatsApp; `@newsletter`
 * é canal. Os dois chegam pelo mesmo evento `messages` e encheriam a caixa de
 * entrada com coisa que ninguém vai responder.
 */
export function ehChatIgnorado(chatid: string): boolean {
  const c = chatid.toLowerCase();
  return c.endsWith('@broadcast') || c.endsWith('@newsletter') || c === 'status@broadcast';
}

/* ========================================================== RECEBIDAS == */

export interface ResultadoRegistro {
  conversaId: string;
  /** Id da nossa linha. Null quando a mensagem já estava gravada (reentrega). */
  linhaId: string | null;
  nova: boolean;
  leadId: string | null;
}

/**
 * Grava uma mensagem que chegou pelo webhook.
 *
 * Aceita tanto a mensagem do cliente quanto a que o vendedor digitou NO
 * APARELHO da empresa (`deMim`). O `excludeMessages: ['wasSentByApi']` que
 * configuramos na uazapi filtra só o que sai pela NOSSA API — o que é digitado
 * no celular chega aqui com fromMe verdadeiro. Registrar as duas é o que evita
 * uma thread com buracos, em que a pergunta do cliente aparece e a resposta do
 * vendedor não.
 */
export async function registrarRecebida(
  cliente: Cliente,
  m: MensagemRecebida,
): Promise<ResultadoRegistro> {
  const telefone = telefoneDoChatid(m.chatid);

  // 1. A conversa existe? Sem mexer em contador nem em prévia — ver o
  //    cabeçalho do arquivo.
  const { rows: conversas } = await cliente.query<{ id: string; lead_id: string | null }>(
    `INSERT INTO "SolarCosta_WhatsAppConversas" (chatid, telefone, nome_exibicao, e_grupo)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (chatid) DO UPDATE SET
        telefone = COALESCE("SolarCosta_WhatsAppConversas".telefone, EXCLUDED.telefone),
        -- O nome do WhatsApp muda quando a pessoa troca o push name, então
        -- este campo é atualizado. O nome do LEAD nunca é tocado por aqui.
        nome_exibicao = COALESCE(EXCLUDED.nome_exibicao, "SolarCosta_WhatsAppConversas".nome_exibicao)
     RETURNING id, lead_id`,
    [m.chatid, telefone, m.nomeExibicao, m.eGrupo],
  );
  const conversa = conversas[0]!;

  // 2. A mensagem. O UNIQUE de mensagem_id é o que torna o webhook idempotente.
  //
  //    `status` fica no default ('enviada'): a coluna descreve a ENTREGA DO
  //    NOSSO ENVIO e não quer dizer nada numa mensagem que chegou. A tela só
  //    mostra o indicador quando de_mim é verdadeiro, e o UPDATE de
  //    messages_update tem `AND de_mim` justamente para nunca tocar nestas.
  const { rows: gravadas } = await cliente.query<{ id: string }>(
    `INSERT INTO "SolarCosta_WhatsAppMensagens"
        (conversa_id, mensagem_id, de_mim, tipo, texto, nome_arquivo, mime_type, ocorrido_em)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (mensagem_id) DO NOTHING
     RETURNING id`,
    [
      conversa.id,
      m.mensagemId,
      m.deMim,
      m.tipo,
      m.texto,
      m.midia?.nomeArquivo ?? null,
      m.midia?.mimeType ?? null,
      m.ocorridoEm,
    ],
  );

  if (gravadas.length === 0) {
    return { conversaId: conversa.id, linhaId: null, nova: false, leadId: conversa.lead_id };
  }

  // 3. Prévia, contador e desarquivamento.
  //
  //    A prévia só muda se esta for a mensagem mais recente: evento reentregue
  //    fora de ordem não deve fazer a lista voltar a mostrar um texto antigo.
  //    O contador, ao contrário, sobe sempre — a mensagem não foi lida,
  //    independentemente da ordem em que chegou.
  //
  //    Mensagem `de_mim` ZERA o contador: o vendedor respondeu pelo aparelho, a
  //    conversa não está mais pendente, e continuar mostrando badge faria o
  //    sistema pedir uma resposta que já foi dada.
  //
  //    `arquivada = false` porque mensagem nova reabre a conversa — deixá-la
  //    arquivada esconderia um cliente que acabou de responder.
  await cliente.query(
    `UPDATE "SolarCosta_WhatsAppConversas" SET
        nao_lidas = CASE WHEN $4 THEN 0 ELSE nao_lidas + 1 END,
        arquivada = false,
        ultima_mensagem_texto = CASE
            WHEN ultima_mensagem_em IS NULL OR $3 >= ultima_mensagem_em THEN $2
            ELSE ultima_mensagem_texto END,
        ultima_mensagem_em = GREATEST($3, COALESCE(ultima_mensagem_em, $3))
      WHERE id = $1`,
    [conversa.id, previaDe(m.tipo, m.texto), m.ocorridoEm, m.deMim],
  );

  // 4. Casamento com o lead, só quando ainda não há vínculo e só para pessoa.
  const leadId =
    conversa.lead_id ?? (m.eGrupo ? null : await casarLead(cliente, conversa.id, telefone));

  return { conversaId: conversa.id, linhaId: gravadas[0]!.id, nova: true, leadId };
}

/**
 * Tenta achar o lead pelo telefone.
 *
 * `SolarCosta_Leads.telefone` é texto livre e gravado mascarado —
 * "(31) 98658-8456" —, então os dois lados precisam ser normalizados na
 * consulta. A chave é DDD + 8 últimos dígitos, pelo motivo explicado em
 * `chaveTelefone` (utils/telefone.ts): cadastro sem o nono dígito é comum.
 *
 * Isto é uma varredura de tabela: não existe coluna normalizada nem índice de
 * expressão. No volume de leads de uma empresa custa alguns milissegundos, e
 * criar coluna gerada + índice seria migration nova para resolver um problema
 * que ainda não existe.
 *
 * DOIS LEADS COM O MESMO TELEFONE: vence o mais recente. É quase sempre o
 * mesmo cliente voltando para um segundo orçamento, e o mais novo é o que está
 * em negociação. O log registra a ambiguidade, e a tela permite corrigir — que
 * é o que o comentário da coluna `lead_id` no V009 promete.
 */
async function casarLead(
  cliente: Cliente,
  conversaId: string,
  telefone: string | null,
): Promise<string | null> {
  const chave = chaveTelefone(telefone);
  if (!chave) return null;

  const { rows: candidatos } = await cliente.query<{ id: string; nome: string }>(
    `SELECT id, nome FROM (
        SELECT id, nome, criado_em,
               CASE WHEN length(digitos) IN (12, 13) AND left(digitos, 2) = '55'
                    THEN substr(digitos, 3) ELSE digitos END AS nacional
          FROM (
            SELECT id, nome, criado_em, regexp_replace(telefone, '\\D', '', 'g') AS digitos
              FROM "SolarCosta_Leads"
             WHERE excluido_em IS NULL AND telefone IS NOT NULL
          ) AS bruto
     ) AS normalizado
      WHERE length(nacional) IN (10, 11)
        AND left(nacional, 2) || right(nacional, 8) = $1
      ORDER BY criado_em DESC
      LIMIT 2`,
    [chave],
  );

  if (candidatos.length === 0) return null;
  if (candidatos.length > 1) {
    console.warn(
      `[whatsapp] telefone ${chave} casa com mais de um lead; vinculei o mais recente (${candidatos[0]!.nome})`,
    );
  }

  // O `lead_id IS NULL` está no WHERE, e não só no teste em memória: entre ler
  // a conversa e escrever aqui, alguém pode ter corrigido o vínculo à mão na
  // tela, e um palpite do sistema não pode desfazer uma correção humana.
  const { rows } = await cliente.query<{ lead_id: string }>(
    `UPDATE "SolarCosta_WhatsAppConversas"
        SET lead_id = $2
      WHERE id = $1 AND lead_id IS NULL
      RETURNING lead_id`,
    [conversaId, candidatos[0]!.id],
  );

  return rows[0]?.lead_id ?? null;
}

/* ============================================================ TIMELINE == */

/**
 * Uma linha na timeline do lead, no máximo a cada 12 horas.
 *
 * POR QUE NÃO UMA LINHA POR MENSAGEM: uma negociação normal tem de 30 a 60
 * mensagens. A timeline é o que o vendedor lê antes de ligar, e 60 linhas de
 * "oi", "bom dia" e "e aí?" enterrariam a visita técnica e a mudança de etapa —
 * ou seja, destruiriam exatamente o que o CRM veio resolver.
 *
 * POR QUE NÃO SÓ NA PRIMEIRA: uma conversa que fica três meses quieta e
 * recomeça não deixaria rastro nenhum, e é justamente esse retorno que o
 * vendedor precisa ver.
 *
 * A janela de 12 h resolve os dois: marca que houve conversa naquele dia, uma
 * vez pela manhã e uma pela tarde no máximo. Quem quiser o detalhe abre a
 * thread — que é o que a caixa de entrada entrega.
 *
 * O `WHERE NOT EXISTS` faz o controle no banco, e não em JS, porque duas
 * mensagens chegando juntas passariam as duas por um teste feito antes.
 */
export async function registrarNaTimeline(
  cliente: Cliente,
  leadId: string,
  descricao: string,
  autor: { id: string; nome: string } | null,
): Promise<void> {
  await cliente.query(
    `INSERT INTO "SolarCosta_LeadHistorico" (lead_id, descricao, tipo, usuario_id, usuario_nome)
     SELECT $1, $2, 'whatsapp', $3, $4
      WHERE NOT EXISTS (
        SELECT 1 FROM "SolarCosta_LeadHistorico"
         WHERE lead_id = $1 AND tipo = 'whatsapp'
           AND ocorrido_em > now() - interval '12 hours'
      )`,
    // `usuario_nome` é NOT NULL e guarda um retrato de quem agiu. 'WhatsApp'
    // para mensagem que chegou, no mesmo espírito do 'Site' que o
    // publico.routes.ts grava no lead vindo do formulário.
    [leadId, descricao, autor?.id ?? null, autor?.nome ?? 'WhatsApp'],
  );
}

/* ============================================================== STATUS == */

/**
 * Confirmação de entrega e de leitura.
 *
 * O STATUS SÓ AVANÇA. Eventos podem chegar fora de ordem, e um `entregue` que
 * chegasse depois do `lida` faria o indicador voltar na tela do vendedor — pior
 * do que não atualizar, porque parece que a mensagem desentregou.
 *
 * `array_position` faz a escada dentro do próprio WHERE, e não em JS, para não
 * existir janela entre ler o status e escrever o novo.
 *
 * `falhou` e `cancelada` só entram a partir de `fila` ou `enviada`: uma falha
 * atrasada não pode apagar um `lida` real, e um `entregue` atrasado não pode
 * ressuscitar uma mensagem que falhou.
 *
 * `AND de_mim` protege as mensagens recebidas, cujo `status` não significa nada.
 */
export async function atualizarStatus(
  cliente: Cliente,
  a: AtualizacaoStatus,
): Promise<{ afetadas: number; falhou: boolean }> {
  const { rowCount } = await cliente.query(
    `UPDATE "SolarCosta_WhatsAppMensagens" SET
        status = $2,
        erro   = COALESCE($3, erro)
      WHERE mensagem_id = $1
        AND de_mim
        AND CASE
              WHEN $2 IN ('falhou', 'cancelada') THEN status IN ('fila', 'enviada')
              ELSE array_position(ARRAY['fila','enviada','entregue','lida'], status)
                 < array_position(ARRAY['fila','enviada','entregue','lida'], $2)
            END`,
    [a.mensagemId, a.status, a.erro],
  );

  return {
    afetadas: rowCount ?? 0,
    falhou: (rowCount ?? 0) > 0 && (a.status === 'falhou' || a.status === 'cancelada'),
  };
}
