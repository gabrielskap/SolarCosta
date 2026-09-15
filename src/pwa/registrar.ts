// Registro do service worker.
//
// Fica separado do App para que a política de atualização seja lida num lugar
// só — e para que o App não precise conhecer nada do `virtual:pwa-register`.
//
// Contrato com quem chama (src/App.tsx):
//   · `aoTerNovaVersao` é disparado quando existe uma versão nova ESPERANDO.
//     Quem recebe deve mostrar um aviso com uma ação; a ação chama a função
//     `atualizar` que vem no parâmetro.
//   · `aoFicarPronto` é disparado na primeira vez que o app passa a funcionar
//     offline.
//
// A troca de versão nunca acontece sozinha: ver o comentário de `registerType`
// em vite.config.ts.

import { registerSW } from 'virtual:pwa-register';

interface Opcoes {
  aoTerNovaVersao?: (atualizar: () => void) => void;
  aoFicarPronto?: () => void;
}

/** Evita registrar duas vezes se o App remontar (StrictMode em dev). */
let registrado = false;

export function registrarServiceWorker({ aoTerNovaVersao, aoFicarPronto }: Opcoes = {}): void {
  if (registrado) return;
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  registrado = true;

  const atualizar = registerSW({
    immediate: true,

    onNeedRefresh() {
      // `atualizar(true)` manda o SKIP_WAITING e recarrega a página quando o
      // worker novo assume. A decisão é do usuário, não nossa.
      aoTerNovaVersao?.(() => void atualizar(true));
    },

    onOfflineReady() {
      aoFicarPronto?.();
    },

    onRegisterError(erro) {
      // Falhar aqui não pode derrubar o app: sem SW ele continua funcionando,
      // só perde o offline. Em dev isso acontece com alguma frequência.
      console.warn('[pwa] service worker não registrado:', erro);
    },
  });
}
