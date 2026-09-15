/// <reference lib="webworker" />

// Service worker do Solar Costa.
//
// O que ele faz nesta fase (Fase 0 do plano de PWA):
//   · guarda a casca do app (HTML, JS, CSS, ícones) para abrir instantâneo,
//     inclusive sem rede;
//   · espera uma ordem explícita para assumir uma versão nova.
//
// O que ele AINDA NÃO faz: cachear resposta de API. Isso é a Fase 3, e tem
// duas armadilhas que precisam ser resolvidas juntas — o Cache Storage é
// indexado por URL, então resposta autenticada cacheada aqui vazaria entre
// usuários do mesmo aparelho; e o app precisa saber renderizar em modo
// somente-leitura. Enquanto isso não existir, `/api/` passa direto para a
// rede, sem o SW no meio.

import { cleanupOutdatedCaches, precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope;

/* ------------------------------------------------------------- precache --- */

// O Workbox substitui isto pela lista real de arquivos do build, cada um com
// sua revisão. É o que faz a atualização ser confiável: muda o hash, muda a
// entrada, o arquivo velho é descartado.
precacheAndRoute(self.__WB_MANIFEST);

// Remove caches de precache de versões anteriores do Workbox.
cleanupOutdatedCaches();

/* ----------------------------------------------------------- navegação --- */

/*
 * Toda navegação (inclusive rota profunda como /sistema/leads/123) responde
 * com o index.html do precache. É o mesmo contrato que o Express e o Nginx já
 * cumprem com o fallback de SPA — a diferença é que agora vale offline também.
 *
 * As exclusões importam: sem elas o SW sequestraria /api/* e /health, que
 * precisam ir para a rede de verdade.
 */
const handlerIndex = createHandlerBoundToURL('index.html');
registerRoute(
  new NavigationRoute(handlerIndex, {
    denylist: [/^\/api\//, /^\/health$/],
  }),
);

/* ------------------------------------------------------------- imagens --- */

/*
 * Logos e imagens do CMS. Ficam fora do precache (são grandes e nem toda
 * sessão precisa delas) e entram no cache conforme aparecem.
 *
 * `/api/publico/midia/:id` é servido com `immutable` pelo backend e o conteúdo
 * é endereçado por hash, então CacheFirst é seguro aqui.
 */
registerRoute(
  ({ request, url }) =>
    request.destination === 'image' || url.pathname.startsWith('/api/publico/midia/'),
  new CacheFirst({
    cacheName: 'solar-imagens-v1',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60, purgeOnQuotaError: true }),
    ],
  }),
);

/* ---------------------------------------------------------- atualização --- */

/*
 * Nada de `skipWaiting()` solto no topo do arquivo: isso é exatamente o
 * `autoUpdate` que decidimos não ter. A versão nova fica em `waiting` até o
 * app mandar a mensagem — o que só acontece quando o usuário clica em
 * "Atualizar" no toast (ver src/pwa/registrar.ts).
 */
self.addEventListener('message', (evento) => {
  if (evento.data?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});

export {};
