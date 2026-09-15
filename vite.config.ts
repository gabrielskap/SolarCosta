import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        /*
         * `injectManifest`, e não `generateSW`: o service worker é NOSSO
         * arquivo (src/sw.ts). O Workbox entra só para resolver a parte chata
         * — a lista de precache com os nomes hasheados que o build acabou de
         * gerar —, injetada no lugar de `self.__WB_MANIFEST`.
         */
        strategies: 'injectManifest',
        srcDir: 'src',
        filename: 'sw.ts',

        /*
         * 'prompt' é decisão deliberada, não preferência.
         *
         * Com um service worker no ar, o `Cache-Control: no-store` que o
         * Express manda no index.html deixa de mandar no que o usuário vê. Com
         * `autoUpdate`, a página poderia trocar de versão embaixo do vendedor
         * no meio do preenchimento de uma proposta. Aqui a versão nova espera,
         * o app avisa por toast e a troca acontece no clique.
         */
        registerType: 'prompt',
        injectRegister: null, // registramos à mão em src/pwa/registrar.ts

        includeAssets: ['favicon.png', 'icons/apple-touch-icon.png'],

        manifest: {
          id: '/sistema/',
          name: 'Solar Costa CRM',
          short_name: 'Solar Costa',
          description:
            'Gestão comercial da Solar Costa: agenda de visitas, leads, propostas e obras.',
          lang: 'pt-BR',
          dir: 'ltr',
          /*
           * O escopo é o CRM, não a raiz — o mesmo index.html serve o site
           * institucional e o sistema. Com `/sistema/` (a barra final é
           * obrigatória: sem ela o escopo vira '/'), o navegador só oferece
           * instalação para quem já está dentro do sistema, e o visitante do
           * site não recebe convite para instalar um CRM.
           */
          scope: '/sistema/',
          start_url: '/sistema/dashboard',
          display: 'standalone',
          orientation: 'portrait',
          background_color: '#f4f6fa', // --color-fundo
          theme_color: '#004276', // --color-marca
          categories: ['business', 'productivity'],
          icons: [
            { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
            {
              src: '/icons/icon-maskable-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
          shortcuts: [
            { name: 'Agenda & Visitas', url: '/sistema/agenda' },
            { name: 'Leads', url: '/sistema/leads' },
            { name: 'Nova proposta', url: '/sistema/propostas/nova' },
          ],
        },

        injectManifest: {
          // As telas lazy entram no precache: é o que permite abrir a agenda
          // offline sem ter visitado a rota antes. Os PNGs de logo ficam de
          // fora do precache e são pegos em runtime (ver src/sw.ts).
          globPatterns: ['**/*.{js,css,html}', 'icons/*.png'],
          globIgnores: ['**/node_modules/**'],
        },

        devOptions: {
          // Sem isto, nada de PWA funciona em `vite dev` e a única forma de
          // testar seria `build && preview`.
          enabled: true,
          type: 'module',
          navigateFallback: 'index.html',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          /*
           * Separa as bibliotecas do código da aplicação.
           *
           * O ganho não é o total baixado — é o CACHE: o `vendor-react` e o
           * `vendor-charts` levam hash próprio e sobrevivem a um deploy que só
           * mexeu nas telas. Sem isso, cada deploy invalidava os ~960 kB
           * inteiros do chunk do CRM, e o vendedor em campo baixava tudo de
           * novo no 4G.
           *
           * `recharts` é o caso mais claro: ~300 kB que só o Dashboard, o
           * Relatórios e o PDFModal usam.
           */
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined;

            // Gráficos: recharts arrasta a família d3 junto. Só o Dashboard,
            // o Relatórios e o PDFModal usam — e nenhum deles está no caminho
            // de quem abre a agenda no celular.
            if (/[\\/]node_modules[\\/](recharts|d3-|victory-vendor|internmap|decimal)/.test(id)) {
              return 'vendor-charts';
            }

            // React + roteador: praticamente nunca mudam, então ganham um hash
            // estável que sobrevive aos deploys de tela.
            if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) {
              return 'vendor-react';
            }

            // Ícones num chunk só. Cada ícone do lucide é um módulo separado e,
            // sem esta linha, o Rollup criava ~20 arquivos de 0,4 kB — 20
            // idas e voltas de rede que doem muito mais no 4G do que os bytes.
            if (id.includes('node_modules/lucide-react') || id.includes('node_modules\\lucide-react')) {
              return 'vendor-icons';
            }

            return undefined;
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
