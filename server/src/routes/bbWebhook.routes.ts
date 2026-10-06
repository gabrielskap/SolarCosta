// Webhook de Cobrança do Banco do Brasil — aviso de baixa operacional (boleto
// pago, em qualquer banco).
//
// ================================ AUTENTICAÇÃO ================================
// Diferente do webhook da uazapi (whatsappWebhook.routes.ts), o BB não manda
// segredo nenhum no corpo ou na URL — a autenticidade vem do mTLS exigido pelo
// próprio BB na conexão: o Nginx valida o certificado cliente apresentado
// contra o certificado do BB (ssl_client_certificate, ver
// deploy/nginx/solarcosta.conf) e só então repassa `X-BB-Verificado: SUCCESS`
// para cá. Sem esse header — porque não passou pelo Nginx, ou porque o
// certificado não bateu — a rota responde 404, pelo mesmo motivo do
// whatsappWebhook: não confirmar a quem sondar que existe endpoint aqui.
//
// ============================== SEMPRE 200 ==============================
// Mesma política do webhook da uazapi: o BB não documenta uma fila de retry
// própria para este evento, então falha nossa vira log, não 5xx.
//
// ========================= O QUE ACONTECE AQUI =========================
// Cada item do lote é uma baixa operacional: acha o boleto por nosso_numero e
// chama services/boletos.ts::darBaixaBoleto — a MESMA função usada pela rota
// PATCH /boletos/:id/baixa, então o trigger que gera o lançamento de caixa e a
// auditoria disparam do mesmo jeito, venha a baixa da tela ou do banco.
// O payload bruto de cada item fica em SolarCosta_BBWebhookEventos: o BB não
// garante entrega única, e é ali que dá para investigar um evento que não
// bateu com nenhum boleto.

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { emTransacao } from '../db.js';
import { buscarBoletoIdPorNossoNumero, darBaixaBoleto } from '../services/boletos.js';

export const bbWebhookRouter = Router();

/**
 * 500 por 15 min: o volume esperado é um lote diário de baixas, não uma
 * torrente de mensagens — bem mais folgado do que o necessário, sem abrir
 * espaço para exaustão por rajada.
 *
 * Exportado porque é montado no app.ts, antes do parse do corpo (mesmo motivo
 * do limiteWebhookWhatsapp: um limitador dentro do router só rodaria depois do
 * parse).
 */
export const limiteWebhookBB = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 500,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    console.warn(`[webhook bb] rate limit atingido por ${req.ip}`);
    res.status(429).json({ erro: 'Muitas requisições.', codigo: 'limite_excedido' });
  },
});

/** Formato do payload de cobrança, ver guias-e-tutoriais/webhook da API Cobranças. */
interface ItemBaixaOperacional {
  id?: string;
  dataLiquidacao?: string; // 'dd/mm/aaaa hh:mm:ss'
  valorPagoSacado?: number;
  codigoEstadoBaixaOperacional?: number; // 1 baixa BB, 2 baixa outro banco, 10 cancelamento
}

/** 'dd/mm/aaaa hh:mm:ss' (ou só 'dd/mm/aaaa') -> 'aaaa-mm-dd'. */
function dataDaLiquidacao(bruta: string | undefined): string | null {
  if (!bruta) return null;
  const [dia, mes, ano] = bruta.slice(0, 10).split('/');
  if (!dia || !mes || !ano) return null;
  return `${ano}-${mes}-${dia}`;
}

bbWebhookRouter.post('/cobranca', async (req, res) => {
  if (req.header('x-bb-verificado') !== 'SUCCESS') {
    res.status(404).json({ erro: 'Rota não encontrada.', codigo: 'rota_inexistente' });
    return;
  }

  const itens = Array.isArray(req.body) ? (req.body as ItemBaixaOperacional[]) : [];

  for (const item of itens) {
    try {
      await emTransacao(async (cliente) => {
        const boletoId = item.id ? await buscarBoletoIdPorNossoNumero(cliente, item.id) : null;

        // Cancelamento de baixa (codigoEstadoBaixaOperacional = 10): não
        // reabrimos o boleto automaticamente — isso reverteria um lançamento
        // de caixa já conciliado sem revisão humana. Fica só registrado.
        if (boletoId && item.codigoEstadoBaixaOperacional !== 10) {
          await darBaixaBoleto(cliente, boletoId, {
            data_pagamento: dataDaLiquidacao(item.dataLiquidacao),
            valor_pago: item.valorPagoSacado ?? null,
          });
        }

        await cliente.query(
          `INSERT INTO "SolarCosta_BBWebhookEventos" (tipo, payload, boleto_id, processado_em)
           VALUES ('cobranca.baixa_operacional', $1, $2, now())`,
          [JSON.stringify(item), boletoId],
        );

        if (!boletoId) {
          console.warn(`[webhook bb] baixa operacional para nosso_numero desconhecido: ${item.id ?? '?'}`);
        }
      });
    } catch (erro) {
      console.error('[webhook bb] falha ao processar item', erro instanceof Error ? erro.message : erro);
      try {
        await emTransacao(async (cliente) => {
          await cliente.query(
            `INSERT INTO "SolarCosta_BBWebhookEventos" (tipo, payload, erro)
             VALUES ('cobranca.baixa_operacional', $1, $2)`,
            [JSON.stringify(item), erro instanceof Error ? erro.message : String(erro)],
          );
        });
      } catch (erroGravar) {
        console.error('[webhook bb] falha ao gravar evento com erro', erroGravar);
      }
    }
  }

  res.status(200).json({ ok: true });
});
