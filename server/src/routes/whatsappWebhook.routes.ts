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
//   3. rate limit, porque um endpoint aberto que consulta o banco a cada
//      requisição é um alvo de exaustão.
//
// ============================== SEMPRE 200 ==============================
// Evento desconhecido, corpo estranho, erro nosso: a resposta é 200. Webhook
// que devolve 4xx/5xx vira fila de retry do outro lado, e a uazapi não
// documenta a política de backoff dela. O que erra a gente loga e segue.
// A exceção é a falha de autenticação, que é 404 — e 404, não 401, para não
// confirmar a quem sondar que existe endpoint naquele caminho.

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { consultarUm, emTransacao } from '../db.js';
import { conferirSegredo, decifrar } from '../services/segredos.js';
import { traduzirStatus } from '../services/uazapi.js';

export const whatsappWebhookRouter = Router();

/**
 * 600 por 15 min ≈ 40 por minuto.
 *
 * Folgado para conversa humana e apertado o bastante para não virar porta de
 * exaustão. O `trust proxy` já está ligado no app.ts, então o IP contado é o
 * de quem chamou, não o do Nginx.
 */
const limite = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: true,
  legacyHeaders: false,
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
  limite,
  async (req, res) => {
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
      if (!instancia.token_cifrado || !conferirSegredo(corpo.token ?? '', decifrar(instancia.token_cifrado))) {
        console.warn('[webhook whatsapp] token do corpo não confere');
        res.status(404).json({ erro: 'Rota não encontrada.', codigo: 'rota_inexistente' });
        return;
      }

      const evento = corpo.EventType ?? corpo.event ?? '';

      if (evento === 'connection') {
        await tratarConexao(instancia.id, corpo);
      } else {
        // `messages` e `messages_update` entram na fase de recebimento. Até lá
        // o webhook já está registrado e autenticado, e um evento ignorado é
        // uma linha de log — não um 404 que faria a uazapi ficar reenviando.
        console.log(`[webhook whatsapp] evento "${evento}" ignorado nesta versão`);
      }
    } catch (erro) {
      // Ver o cabeçalho: erro nosso não vira retry do outro lado.
      console.error('[webhook whatsapp] falha ao processar', erro instanceof Error ? erro.message : erro);
    }

    res.status(200).json({ ok: true });
  },
);

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
