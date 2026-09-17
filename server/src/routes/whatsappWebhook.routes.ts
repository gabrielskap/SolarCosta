// Webhook da uazapi — entrada de eventos do WhatsApp.
//
// PRIMEIRA rota do projeto que aceita POST de terceiro. O único outro router
// sem login é o publicoRouter, que serve o site institucional; este não tem
// nada a ver com o site, daí o arquivo separado.
//
// ================================ AUTENTICAÇÃO ================================
// A uazapi NÃO assina o corpo. Não há HMAC, não há header de assinatura — isso
// foi verificado no contrato deles, não presumido. O único sinal de origem que
// ela oferece é o token da instância, que vem DENTRO do JSON.
//
// Daí três camadas, nenhuma suficiente sozinha:
//   1. a URL carrega um segredo de 32 bytes sorteado por instalação. Quem não
//      o conhece não acha o endereço;
//   2. o `token` do corpo é conferido contra o token da instância, em tempo
//      constante;
//   3. rate limit, que mora no app.ts e roda ANTES do parse do corpo — ver o
//      comentário lá. Limitador depois do parse deixaria um anônimo forçar a
//      leitura de megabytes de JSON sem nunca passar pelo contador.
//
// O segredo viaja na URL e portanto aparece no access.log do Nginx. É risco
// aceito — quem lê o log da VPS já tem acesso ao banco —, mas quem for mexer em
// retenção ou em envio de log para fora precisa saber disto.
//
// ============================== SEMPRE 200 ==============================
// Evento desconhecido, corpo estranho, erro nosso: a resposta é 200. Webhook
// que devolve 4xx/5xx vira fila de retry do outro lado, e a uazapi não
// documenta a política de backoff dela. O que erra a gente loga e segue.
// A exceção é a falha de autenticação, que é 404 — e 404, não 401, para não
// confirmar a quem sondar que existe endpoint naquele caminho.
//
// ========================= O QUE ACONTECE DEPOIS DO 200 =========================
// Baixar anexo não cabe antes da resposta: são megabytes vindos de um CDN, e o
// webhook precisa devolver rápido para não acumular reentrega. Então a mensagem
// é gravada primeiro sem os bytes (a thread já mostra "[Foto]"), o 200 sai, e o
// arquivo entra na fila de services/whatsappMidia.ts.

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { consultarUm, emTransacao } from '../db.js';
import { conferirSegredo, decifrar } from '../services/segredos.js';
import { traduzirStatus } from '../services/uazapi.js';
import { lerAtualizacoesStatus, lerMensagensRecebidas } from '../services/eventosWhatsapp.js';
import {
  atualizarStatus,
  ehChatIgnorado,
  previaDe,
  registrarNaTimeline,
  registrarRecebida,
} from '../services/whatsappConversas.js';
import { enfileirarMidia, type TarefaMidia } from '../services/whatsappMidia.js';
import { registrarErroInstancia } from '../services/whatsappInstancia.js';

export const whatsappWebhookRouter = Router();

/**
 * 3.000 por 15 min = 200 por minuto.
 *
 * Bem mais folgado do que parece necessário, e de propósito: cada mensagem
 * enviada gera um `messages` e até três `messages_update` (enviada, entregue,
 * lida). Com três vendedores num dia movimentado, um pico de 40 eventos por
 * minuto é perfeitamente normal — e **evento recusado por 429 é mensagem
 * perdida**, porque não sabemos se a uazapi reenvia.
 *
 * O custo por requisição é um SELECT e dois INSERTs, então o teto alto não é
 * arriscado. O que ele ainda impede é a exaustão por rajada.
 *
 * Exportado porque é montado no app.ts, antes do parse do corpo.
 */
export const limiteWebhookWhatsapp = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3000,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`[webhook whatsapp] rate limit atingido por ${req.ip}`);
    res.status(429).json({ erro: 'Muitas requisições.', codigo: 'limite_excedido' });
  },
});

interface LinhaInstancia {
  id: string;
  token_cifrado: string | null;
  webhook_segredo: string;
}

/**
 * Corpo do evento.
 *
 * `EventType` e `event`: o contrato da uazapi usa as duas grafias em lugares
 * diferentes e o exemplo real traz `EventType`. Aceitar as duas custa uma
 * linha e evita silêncio total no dia em que eles padronizarem.
 */
interface CorpoWebhook {
  EventType?: string;
  event?: string;
  token?: string;
  instance?: { status?: string; profileName?: string };
  data?: Record<string, unknown>;
  status?: string;
}

whatsappWebhookRouter.post(
  '/:segredo',
  async (req, res) => {
    let pendentes: TarefaMidia[] = [];

    try {
      const instancia = await consultarUm<LinhaInstancia>(
        `SELECT id, token_cifrado, webhook_segredo
           FROM "SolarCosta_WhatsAppInstancia" WHERE registro_unico`,
      );

      // Camada 1: a URL.
      if (!instancia || !conferirSegredo(req.params.segredo ?? '', instancia.webhook_segredo)) {
        res.status(404).json({ erro: 'Rota não encontrada.', codigo: 'rota_inexistente' });
        return;
      }

      // Camada 2: o token no corpo. Sem token gravado ainda (instância nunca
      // conectada) não há com o que comparar — e aí nada legítimo deveria
      // estar chegando.
      const corpo = (req.body ?? {}) as CorpoWebhook;
      if (!instancia.token_cifrado) {
        console.warn('[webhook whatsapp] instância sem token: evento descartado');
        res.status(404).json({ erro: 'Rota não encontrada.', codigo: 'rota_inexistente' });
        return;
      }

      const token = decifrar(instancia.token_cifrado);
      if (!conferirSegredo(corpo.token ?? '', token)) {
        console.warn('[webhook whatsapp] token do corpo não confere');
        res.status(404).json({ erro: 'Rota não encontrada.', codigo: 'rota_inexistente' });
        return;
      }

      const evento = corpo.EventType ?? corpo.event ?? '';

      if (evento === 'connection') {
        await tratarConexao(instancia.id, corpo);
      } else if (evento === 'messages' || evento === 'messages_upsert') {
        // `messages_upsert` é a grafia do Baileys. Aceitar as duas é uma
        // condição a mais e evita perder toda a entrada se eles mudarem.
        pendentes = await tratarMensagens(corpo, token);
      } else if (evento === 'messages_update') {
        await tratarAtualizacoes(corpo);
      } else {
        // Evento que não pedimos em configurarWebhook, ou um novo que eles
        // passaram a mandar. Uma linha de log — não um 404, que faria a uazapi
        // ficar reenviando.
        console.log(`[webhook whatsapp] evento "${evento}" ignorado nesta versão`);
      }
    } catch (erro) {
      // Ver o cabeçalho: erro nosso não vira retry do outro lado.
      console.error('[webhook whatsapp] falha ao processar', erro instanceof Error ? erro.message : erro);
    }

    res.status(200).json({ ok: true });

    // Daqui para baixo a resposta JÁ FOI. `enfileirarMidia` é síncrono e não
    // lança de propósito — qualquer throw aqui seria rejeição não tratada.
    for (const pendente of pendentes) enfileirarMidia(pendente);
  },
);

/* ============================================================ CONEXÃO == */

/**
 * Mantém o status da instância em dia sem ninguém precisar abrir a tela.
 *
 * É o que faz a diferença entre "o WhatsApp caiu às 3h e o vendedor descobriu
 * às 10h, quando o cliente reclamou" e "a tela já abre avisando".
 */
async function tratarConexao(instanciaId: string, corpo: CorpoWebhook): Promise<void> {
  const bruto =
    corpo.instance?.status ??
    corpo.status ??
    (corpo.data?.status as string | undefined);

  const status = traduzirStatus(bruto);

  await emTransacao(async (cliente) => {
    await cliente.query(
      `UPDATE "SolarCosta_WhatsAppInstancia" SET
          status           = $2,
          ultimo_status_em = now(),
          conectado_em     = CASE WHEN $2 = 'conectada' THEN COALESCE(conectado_em, now()) ELSE NULL END,
          numero_conectado = CASE WHEN $2 = 'conectada' THEN numero_conectado ELSE NULL END
        WHERE id = $1`,
      [instanciaId, status],
    );
  });

  console.log(`[webhook whatsapp] conexão: ${bruto ?? '?'} -> ${status}`);
}

/* ========================================================== MENSAGENS == */

/**
 * Grava as mensagens do evento e devolve os anexos a buscar depois do 200.
 *
 * Cada mensagem tem a sua própria transação, de propósito: num lote em que a
 * terceira viola uma constraint, as duas primeiras — que estavam boas — não
 * devem ser desfeitas. O webhook não tem segunda chance: a uazapi não
 * documenta retry, então o que se perder aqui se perdeu.
 */
async function tratarMensagens(corpo: CorpoWebhook, token: string): Promise<TarefaMidia[]> {
  const pendentes: TarefaMidia[] = [];

  for (const m of lerMensagensRecebidas(corpo)) {
    if (ehChatIgnorado(m.chatid)) continue;

    try {
      const resultado = await emTransacao(async (cliente) => {
        const r = await registrarRecebida(cliente, m);

        // Timeline só para mensagem do CLIENTE: o que muda o comportamento do
        // vendedor é "ele respondeu", não "eu respondi pelo celular".
        if (r.nova && r.leadId && !m.deMim) {
          await registrarNaTimeline(
            cliente,
            r.leadId,
            `Conversa no WhatsApp: ${previaDe(m.tipo, m.texto).slice(0, 120)}`,
            null,
          );
        }

        return r;
      });

      // Enfileirar DEPOIS do commit: a fila faz UPDATE nesta mesma linha, e
      // enfileirar antes criaria corrida com o próprio INSERT.
      if (resultado.nova && resultado.linhaId && m.midia) {
        pendentes.push({
          linhaId: resultado.linhaId,
          mensagemId: m.mensagemId,
          url: m.midia.url,
          mimeType: m.midia.mimeType,
          nomeArquivo: m.midia.nomeArquivo,
          token,
        });
      }

      if (!resultado.nova) {
        console.log(`[webhook whatsapp] mensagem ${m.mensagemId} já registrada`);
      }
    } catch (erro) {
      console.error(
        `[webhook whatsapp] não gravou a mensagem ${m.mensagemId}:`,
        erro instanceof Error ? erro.message : erro,
      );
    }
  }

  return pendentes;
}

/* ============================================================= STATUS == */

/**
 * Confirmação de entrega e de leitura.
 *
 * A regra de "só avança" está no SQL de `atualizarStatus`. Aqui só resta o que
 * fazer quando o WhatsApp recusa de vez: gravar o motivo em `ultimo_erro` da
 * instância, que é o texto que a tela de conexão mostra. É por este caminho
 * que aparecem o erro 463 e o limite de conversas novas.
 *
 * `afetadas = 0` é normal e não é erro: ou o status não avançou, ou é uma
 * mensagem que nunca gravamos (enviada de outro sistema). Criar linha aqui
 * seria lixo — não há conversa nem conteúdo para pendurar nela.
 */
async function tratarAtualizacoes(corpo: CorpoWebhook): Promise<void> {
  for (const a of lerAtualizacoesStatus(corpo)) {
    try {
      const { afetadas, falhou } = await emTransacao((cliente) => atualizarStatus(cliente, a));

      if (falhou) {
        await registrarErroInstancia(
          `O WhatsApp recusou a entrega de uma mensagem: ${a.erro ?? 'motivo não informado pela uazapi'}.`,
        );
      }

      if (afetadas === 0) {
        console.log(`[webhook whatsapp] status "${a.status}" não alterou ${a.mensagemId}`);
      }
    } catch (erro) {
      console.error(
        `[webhook whatsapp] status de ${a.mensagemId} falhou:`,
        erro instanceof Error ? erro.message : erro,
      );
    }
  }
}
