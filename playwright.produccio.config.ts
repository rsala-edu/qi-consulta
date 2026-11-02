// Proves contra el build de producció (vite build + vite preview, amb la
// base /qi-consulta/), com el que es publica a GitHub Pages. Algunes
// errades només surten minificades o amb el codi partit en fragments.
import { defineConfig } from '@playwright/test'
import base, { ENTORN_PROVES } from './playwright.config.ts'

const PORT = 5198

export default defineConfig({
  ...base,
  testIgnore: undefined,
  testMatch: '**/produccio*.spec.ts',
  use: { ...base.use, baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/qi-consulta/`,
    reuseExistingServer: false,
    timeout: 240_000,
    env: ENTORN_PROVES,
  },
})
