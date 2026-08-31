/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base da API Express. Padrão: http://localhost:4000 */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** Injetado em runtime por public/env-config.js (sobrescrito pelo container em produção). */
interface Window {
  __ENV__?: {
    VITE_API_URL?: string;
  };
}
