// Captures de pantalla per revisar el disseny (tests/captures). Només a la tauleta.
import { defineConfig, devices } from '@playwright/test'
import base from './playwright.config.ts'

export default defineConfig({
  ...base,
  testDir: './tests/captures',
  testIgnore: undefined,
  projects: [{ name: 'tauleta', use: { ...devices['Galaxy Tab S9 landscape'] } }],
})
