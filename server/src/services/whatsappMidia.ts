// Anexos recebidos no WhatsApp: da uazapi para o nosso Postgres.
//
// POR QUE ISTO NÃO RODA DENTRO DO WEBHOOK
//
// O webhook precisa responder 200 rápido — a uazapi não documenta a política de
// backoff dela, e resposta lenta pode virar evento reentregue. Um vídeo de
// 10 MB seguraria o handler por segundos e, no pior caso, uma conexão do pool
// junto (o pool tem 10 por padrão).
//
// Então a mensagem é gravada primeiro sem os bytes — a thread já mostra
// "Imagem" — a resposta sai, e o download entra nesta fila.
//
// POR QUE UMA FILA EM MEMÓRIA, E NÃO UM `void baixar()` SOLTO
//
// Um lote de 20 fotos viraria 20 downloads simultâneos de até 16 MB: 320 MB de
// pico num container que não tem essa folga. Dois trabalhadores bastam — o
// gargalo é rede, não CPU — e o teto de fila existe porque a porta de entrada
// é um endpoint aberto na internet: fila sem limite é fila que cresce até o
// processo morrer.
//
// O QUE SE PERDE NUM REDEPLOY: fila não drenada morre com o processo, e aí a
// mídia daquela mensagem fica com `erro` em branco e `midia_id` nulo para
// sempre. A alternativa seria tabela de fila com retomada no boot — uma feature
// inteira para uma janela de segundos entre o evento e o download. Quando
// acontecer, o conserto é pedir ao cliente que reenvie o arquivo.

import crypto from 'node:crypto';
import { consultar, emTransacao } from '../db.js';
import { baixarMidia, FalhaMidia } from './uazapi.js';

/** Dois: o gargalo é rede, e mais do que isso só multiplica o pico de memória. */
const SIMULTANEOS = 2;

/**
 * Teto da fila.
 *
 * 50 anexos pendentes já é um lote absurdo para uma empresa; passar disso é
 * sinal de enxurrada, não de uso. Descartar com log é melhor do que crescer:
 * quem entra por endpoint aberto não define o consumo de memória da API.
 */
const TETO_FILA = 50;

export interface TarefaMidia {
  /** Id da NOSSA linha em SolarCosta_WhatsAppMensagens. */
  linhaId: string;
  /** Id da mensagem no WhatsApp, para o /message/download. */
  mensagemId: string;
  url: string | null;
  mimeType: string | null;
  nomeArquivo: string | null;
  /** Token da instância, necessário no download. Nunca sai daqui. */
  token: string;
}

const fila: TarefaMidia[] = [];
/** Dedupe: o mesmo evento reentregue não deve baixar o arquivo duas vezes. */
const naFila = new Set<string>();
let trabalhando = 0;

/**
 * Põe um anexo na fila. Não espera, não lança.
 *
 * Chamado DEPOIS de `res.json()`, então lançar aqui viraria rejeição não
 * tratada e derrubaria o processo. Tudo o que pode dar errado é logado.
 */
export function enfileirarMidia(tarefa: TarefaMidia): void {
  if (naFila.has(tarefa.linhaId)) return;

  if (fila.length >= TETO_FILA) {
    console.warn(
      `[whatsapp mídia] fila cheia (${TETO_FILA}): anexo de ${tarefa.mensagemId} descartado`,
    );
    void marcarErro(tarefa.linhaId, 'A fila de downloads estava cheia. Peça o arquivo novamente.');
    return;
  }

  fila.push(tarefa);
  naFila.add(tarefa.linhaId);
  girar();
}

function girar(): void {
  while (trabalhando < SIMULTANEOS && fila.length > 0) {
    const tarefa = fila.shift()!;
    trabalhando += 1;

    void processar(tarefa)
      .catch((erro) =>
        console.error(
          `[whatsapp mídia] ${tarefa.mensagemId} falhou:`,
          erro instanceof Error ? erro.message : erro,
        ),
      )
      .finally(() => {
        trabalhando -= 1;
        naFila.delete(tarefa.linhaId);
        girar();
      });
  }
}

async function processar(tarefa: TarefaMidia): Promise<void> {
  let arquivo;
  try {
    arquivo = await baixarMidia(tarefa.token, {
      url: tarefa.url,
      mensagemId: tarefa.mensagemId,
      mimeType: tarefa.mimeType,
      nomeArquivo: tarefa.nomeArquivo,
    });
  } catch (erro) {
    const motivo = erro instanceof FalhaMidia || erro instanceof Error ? erro.message : String(erro);
    await marcarErro(tarefa.linhaId, `Não foi possível baixar o arquivo: ${motivo}`);
    console.error(`[whatsapp mídia] ${tarefa.mensagemId}: ${motivo}`);
    return;
  }

  const hash = crypto.createHash('sha256').update(arquivo.bytes).digest('hex');

  await emTransacao(async (cliente) => {
    // O UPDATE do ON CONFLICT é no-op de propósito: grava a coluna com o valor
    // que ela já tem. Serve só para o RETURNING devolver o id da linha
    // existente — `DO NOTHING` não devolveria nada, e aí a mesma foto
    // reencaminhada não teria como reaproveitar os bytes já guardados.
    const { rows } = await cliente.query<{ id: string }>(
      `INSERT INTO "SolarCosta_WhatsAppMidia"
          (nome_arquivo, mime_type, tamanho_bytes, hash_sha256, conteudo)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (hash_sha256) DO UPDATE
          SET nome_arquivo = "SolarCosta_WhatsAppMidia".nome_arquivo
       RETURNING id`,
      [arquivo.nomeArquivo, arquivo.mimeType, arquivo.bytes.length, hash, arquivo.bytes],
    );

    await cliente.query(
      `UPDATE "SolarCosta_WhatsAppMensagens" SET
          midia_id     = $2,
          mime_type    = COALESCE(mime_type, $3),
          nome_arquivo = COALESCE(nome_arquivo, $4),
          erro         = NULL
        WHERE id = $1`,
      [tarefa.linhaId, rows[0]!.id, arquivo.mimeType, arquivo.nomeArquivo],
    );
  });

  console.log(
    `[whatsapp mídia] ${tarefa.mensagemId}: ${arquivo.bytes.length} bytes (${arquivo.mimeType})`,
  );
}

/**
 * Escreve o motivo na própria mensagem.
 *
 * É o que a thread mostra em vez de um ícone quebrado sem explicação — e o que
 * permite ao vendedor saber que precisa pedir o arquivo de novo.
 */
async function marcarErro(linhaId: string, motivo: string): Promise<void> {
  await consultar(
    `UPDATE "SolarCosta_WhatsAppMensagens" SET erro = left($2, 500) WHERE id = $1`,
    [linhaId, motivo],
  ).catch((erro) =>
    console.error('[whatsapp mídia] não gravou o erro:', erro instanceof Error ? erro.message : erro),
  );
}
