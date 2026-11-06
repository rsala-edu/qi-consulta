/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** ID del client OAuth de Google (és públic) */
  readonly VITE_GOOGLE_CLIENT_ID?: string
  /** SHA-256 dels correus permesos (en minúscules), separats per comes; mai els correus en clar */
  readonly VITE_HASHOS_CORREUS_PERMESOS?: string
  /** Commit de la versió (vite.config.ts), per als detalls tècnics */
  readonly VITE_VERSIO_APP?: string
  /** Data i hora de la compilació (ISO) */
  readonly VITE_DATA_APP?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
