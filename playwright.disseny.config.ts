// Captures del disseny (revisió de la 3B, part B): ordinador a 1440 × 900 i
// 1920 × 1080, i tauleta horitzontal i vertical. No són proves.
//
//   CAPTURES_SUFIX=despres npx playwright test -c playwright.disseny.config.ts
//
// Port propi i sense reaprofitar cap servidor: així es pot fer el mateix amb
// el codi d'abans (una altra còpia del repositori) sense barrejar-los.
import { defineConfig, devices } from '@playwright/test'
import base, { ENTORN_PROVES } from './playwright.config.ts'

const PORT = Number(process.env.CAPTURES_PORT ?? 5197)

export default defineConfig({
  ...base,
  testDir: './tests/captures',
  testMatch: ['disseny.spec.ts', 'evolucio.spec.ts'],
  testIgnore: undefined,
  fullyParallel: true,
  workers: 2,
  retries: 0,
  use: { ...base.use, baseURL: `http://localhost:${PORT}` },
  projects: [
    { name: 'ordinador-1440', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'ordinador-1920', use: { ...devices['Desktop Chrome'], viewport: { width: 1920, height: 1080 } } },
    { name: 'tauleta', use: { ...devices['Galaxy Tab S9 landscape'] } },
    { name: 'tauleta-vertical', use: { ...devices['Galaxy Tab S9'] } },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/qi-consulta/`,
    reuseExistingServer: false,
    env: ENTORN_PROVES,
  },
})
