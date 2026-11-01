import { defineConfig, devices } from '@playwright/test'

const PORT = 5199

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'ca-ES',
    trace: 'retain-on-failure',
    // WebGL per programari, perquè el navegador sense pantalla pugui dibuixar el cos 3D
    launchOptions: { args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] },
  },
  projects: [
    { name: 'tauleta', use: { ...devices['Galaxy Tab S9 landscape'] } },
    { name: 'escriptori', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/qi-consulta/`,
    reuseExistingServer: !process.env.CI,
    // Google simulat (tests/e2e/google.ts): un ID de client fals i el hash
    // de doctora@exemple.invalid
    env: {
      VITE_GOOGLE_CLIENT_ID: 'client-de-prova.apps.googleusercontent.com',
      VITE_HASH_CORREU_DOCTORA: 'd1949bb93978ebea0b611a497057f210e94c831269473405e18e797069478384',
    },
  },
})
