// Ponto de entrada: sobe o servidor só depois de confirmar que o banco
// responde e que as migrations foram aplicadas.

import { criarApp } from './app.js';
import { config } from './config.js';
import { fecharPool, verificarConexao } from './db.js';

async function main(): Promise<void> {
  await verificarConexao();

  const app = criarApp();
  const servidor = app.listen(config.PORT, () => {
    console.log(`[api] Solar Costa ouvindo em http://localhost:${config.PORT} (${config.NODE_ENV})`);
  });

  // Encerramento limpo: para de aceitar conexões novas, drena as em curso e
  // devolve o pool. Sem isso o Docker mata requisições no meio no deploy.
  const encerrar = (sinal: string) => {
    console.log(`[api] ${sinal} recebido, encerrando...`);
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
