// Ponto de entrada: sobe o servidor só depois de confirmar que o banco
// responde e que as migrations foram aplicadas.

import { criarApp } from './app.js';
import { config } from './config.js';
import { fecharPool, verificarConexao } from './db.js';
import { iniciarAgendador } from './scheduler.js';

async function main(): Promise<void> {
  await verificarConexao();

  const app = criarApp();
  const servidor = app.listen(config.PORT, () => {
    console.log(`[api] Solar Costa ouvindo em http://localhost:${config.PORT} (${config.NODE_ENV})`);
  });

  // Sem isto, porta ocupada derruba o processo com stack trace cru.
  servidor.on('error', (erro: NodeJS.ErrnoException) => {
    if (erro.code === 'EADDRINUSE') {
      console.error(
        `[api] a porta ${config.PORT} já está em uso. ` +
          'Encerre o outro processo ou defina PORT no .env.',
      );
    } else if (erro.code === 'EACCES') {
      console.error(`[api] sem permissão para abrir a porta ${config.PORT}.`);
    } else {
      console.error('[api] erro no servidor HTTP:', erro.message);
    }
    process.exit(1);
  });

  // Rotina diária: marca boletos vencidos e obras atrasadas.
  const pararAgendador = config.SCHEDULER_ATIVO
    ? iniciarAgendador({
        hora: config.SCHEDULER_HORA,
        minuto: config.SCHEDULER_MINUTO,
        // Na subida, pega o que ficou para trás enquanto a API esteve fora.
        executarNaSubida: true,
      })
    : () => {
        console.log('[rotina] agendador desligado (SCHEDULER_ATIVO=false)');
      };

  // Encerramento limpo: para de aceitar conexões novas, drena as em curso e
  // devolve o pool. Sem isso o Docker mata requisições no meio no deploy.
  const encerrar = (sinal: string) => {
    console.log(`[api] ${sinal} recebido, encerrando...`);
    pararAgendador();
    servidor.close(() => {
      fecharPool()
        .then(() => process.exit(0))
        .catch((e) => {
          console.error('[api] erro ao fechar o pool', e);
          process.exit(1);
        });
    });

    // Rede de segurança: se algo travar, sai mesmo assim.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => encerrar('SIGTERM'));
  process.on('SIGINT', () => encerrar('SIGINT'));
}

main().catch((erro) => {
  console.error('[api] falha na inicialização:', erro instanceof Error ? erro.message : erro);
  process.exit(1);
});
