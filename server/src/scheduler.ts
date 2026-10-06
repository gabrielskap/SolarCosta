// Rotina diária de manutenção.
//
// Marca boletos vencidos e obras atrasadas. Sem isso, um boleto que passou do
// vencimento continua "em aberto" para sempre e a obra nunca aparece como
// atrasada — as duas coisas alimentam a central de notificações.
//
// Por que dentro da API e não num cron do sistema:
//   · não duplica a senha do banco num crontab;
//   · sobe junto com a aplicação, sem passo extra de instalação;
//   · a função no banco é idempotente (UPDATE ... WHERE), então rodar duas
//     vezes, ou em duas instâncias da API, não causa efeito colateral.
//
// Se você preferir rodar pelo pg_cron (roda mesmo com a API fora do ar), use
// deploy/postgres/rotina-diaria-pg_cron.sql e desligue este agendador com
// SCHEDULER_ATIVO=false.

import { config } from './config.js';
import { consultarUm, emTransacao } from './db.js';
import { listarBaixaOperacional } from './services/bb/cobrancas.js';
import { buscarBoletoIdPorNossoNumero, darBaixaBoleto } from './services/boletos.js';

interface ResultadoRotina {
  boletos_vencidos: number;
  obras_atrasadas: number;
}

const UM_MINUTO = 60_000;

export async function executarRotinaDiaria(): Promise<ResultadoRotina> {
  const linha = await consultarUm<ResultadoRotina>(
    `SELECT * FROM "SolarCosta_fn_rotina_diaria"()`,
  );
  return linha ?? { boletos_vencidos: 0, obras_atrasadas: 0 };
}

/**
 * Rede de segurança para o webhook do BB: consulta a baixa operacional dos
 * últimos 5 dias (o máximo que a API aceita) e dá baixa em qualquer boleto que
 * o webhook não tenha capturado — entrega perdida, Nginx fora do ar na hora,
 * aplicação ainda não cadastrada em produção, etc. Idempotente: um boleto já
 * pago simplesmente não bate no `WHERE situacao <> 'pago'` de darBaixaBoleto.
 */
export async function reconciliarBaixaOperacionalBB(): Promise<{ boletos_baixados: number }> {
  if (!config.bbCobrancasAtivo) return { boletos_baixados: 0 };

  const hoje = new Date();
  const inicio = new Date(hoje);
  inicio.setDate(hoje.getDate() - 5);
  const isoInicio = inicio.toISOString().slice(0, 10);
  const isoFim = hoje.toISOString().slice(0, 10);

  const baixas = await listarBaixaOperacional(isoInicio, isoFim);

  let contagem = 0;
  for (const baixa of baixas) {
    // Cancelamento de baixa (10): não reabrimos boleto automaticamente, igual
    // ao webhook — reverteria um lançamento de caixa sem revisão humana.
    if (baixa.codigoEstadoBaixaOperacional === 10) continue;

    const baixou = await emTransacao(async (cliente) => {
      const boletoId = await buscarBoletoIdPorNossoNumero(cliente, baixa.id);
      if (!boletoId) return false;
      const resultado = await darBaixaBoleto(cliente, boletoId, {
        data_pagamento: baixa.dataLiquidacao,
        valor_pago: baixa.valorPagoSacado,
      });
      return Boolean(resultado);
    });

    if (baixou) contagem++;
  }

  return { boletos_baixados: contagem };
}

/** Milissegundos até o próximo horário HH:MM no fuso local do servidor. */
function msAte(hora: number, minuto: number): number {
  const agora = new Date();
  const alvo = new Date(agora);
  alvo.setHours(hora, minuto, 0, 0);
  if (alvo <= agora) alvo.setDate(alvo.getDate() + 1);
  return alvo.getTime() - agora.getTime();
}

export interface AgendadorOpcoes {
  /** Hora local da execução diária (0-23). */
  hora: number;
  /** Minuto local da execução diária (0-59). */
  minuto: number;
  /** Rodar uma vez na subida, além do horário fixo. */
  executarNaSubida: boolean;
}

/**
 * Agenda a rotina e devolve uma função para cancelá-la.
 *
 * Usa setTimeout encadeado em vez de setInterval de 24h: o intervalo fixo
 * derraparia com horário de verão e com o tempo que a própria execução leva.
 */
export function iniciarAgendador(opcoes: AgendadorOpcoes): () => void {
  let timer: NodeJS.Timeout | null = null;
  let cancelado = false;

  const rodar = async (motivo: string) => {
    const inicio = Date.now();
    try {
      const r = await executarRotinaDiaria();
      console.log(
        `[rotina] ${motivo} · ${r.boletos_vencidos} boleto(s) vencido(s), ` +
          `${r.obras_atrasadas} obra(s) atrasada(s) · ${Date.now() - inicio}ms`,
      );
    } catch (erro) {
      // Falhar aqui não pode derrubar a API: amanhã ela tenta de novo, e a
      // função é idempotente.
      console.error('[rotina] falhou:', erro instanceof Error ? erro.message : erro);
    }

    // Try/catch separado: uma falha no BB (fora do ar, credencial vencida) não
    // pode impedir a rotina de boletos vencidos acima de ter rodado.
    if (config.bbCobrancasAtivo) {
      try {
        const r = await reconciliarBaixaOperacionalBB();
        console.log(`[rotina] ${motivo} · BB: ${r.boletos_baixados} boleto(s) baixado(s) por reconciliação`);
      } catch (erro) {
        console.error('[rotina] reconciliação BB falhou:', erro instanceof Error ? erro.message : erro);
      }
    }
  };

  const agendarProxima = () => {
    if (cancelado) return;
    const espera = msAte(opcoes.hora, opcoes.minuto);
    const quando = new Date(Date.now() + espera);

    console.log(
      `[rotina] próxima execução em ${quando.toLocaleString('pt-BR')} ` +
        `(${Math.round(espera / UM_MINUTO)} min)`,
    );

    timer = setTimeout(() => {
      void rodar('execução diária').finally(agendarProxima);
    }, espera);

    // Não segura o processo aberto no encerramento.
    timer.unref?.();
  };

  if (opcoes.executarNaSubida) {
    void rodar('execução na subida');
  }
  agendarProxima();

  return () => {
    cancelado = true;
    if (timer) clearTimeout(timer);
  };
}
