/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** ID del client OAuth de Google (és públic) */
  readonly VITE_GOOGLE_CLIENT_ID?: string
  /** SHA-256 del correu de la doctora en minúscules (mai el correu en clar) */
  readonly VITE_HASH_CORREU_DOCTORA?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
