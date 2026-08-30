/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL base da API Express. Padrão: http://localhost:4000 */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
