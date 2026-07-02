/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string | undefined
  readonly VITE_API_TOKEN: string | undefined
  readonly VITE_FINNHUB_API_KEY: string | undefined
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
