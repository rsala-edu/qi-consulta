import { defineConfig, devices } from '@playwright/test'

const PORT = 5199
/** Les E2E contra el build de proves (en local, llevat de QI_E2E_DEV=1) */
const BUILD = !process.env.CI && !process.env.QI_E2E_DEV

/** Google simulat (tests/e2e/google.ts), també per al build de producció */
export const ENTORN_PROVES = {
  VITE_GOOGLE_CLIENT_ID: 'client-de-prova.apps.googleusercontent.com',
  VITE_HASHOS_CORREUS_PERMESOS:
    'd1949bb93978ebea0b611a497057f210e94c831269473405e18e797069478384, 5c9fa083cf8e097e6968ca8f63acdfe0433a7c456b09b516a12f43702d2cf7ef',
}

export default defineConfig({
  testDir: './tests/e2e',
  // Aquesta va contra el build de producció (playwright.produccio.config.ts)
  testIgnore: ['**/produccio*.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // En local, 4: contra el build és el més ràpid sense errors (13/11: 6,1 min;
  // amb 6, errors per temps esgotat; amb 11, sense memòria). Al CI, el de Playwright
  workers: process.env.CI ? undefined : 4,
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
  // En local, per defecte contra un build de proves (vite build --mode proves +
  // vite preview): gasta menys memòria i va més de pressa que el servidor de
  // desenvolupament. QI_E2E_DEV=1 fa servir el servidor de desenvolupament
  // (el CI també). El build de proves és com el publicat, però deixa baixar
  // les iteracions de PBKDF2 i no registra el service worker
  webServer: BUILD
    ? {
        command: `npm run build:proves && npx vite preview --outDir dist-proves --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}/qi-consulta/`,
        // Sempre un build nou: un servidor que ja corre podria tenir el codi vell
        reuseExistingServer: false,
        timeout: 240_000,
        env: ENTORN_PROVES,
      }
    : {
        command: `npm run dev -- --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}/qi-consulta/`,
        reuseExistingServer: !process.env.CI,
        // Google simulat (tests/e2e/google.ts): un ID de client fals i els hashos
        // de doctora@exemple.invalid i proves@exemple.invalid (amb espais, com
        // els pot escriure algú a la variable del repositori)
        env: ENTORN_PROVES,
      },
})
