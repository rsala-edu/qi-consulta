import { execSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Versió de l'app per als detalls tècnics: el commit (a GitHub Actions, GITHUB_SHA)
function versioApp(): string {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA.slice(0, 7)
  try {
    return execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return 'dev'
  }
}
process.env.VITE_VERSIO_APP ??= versioApp()
process.env.VITE_DATA_APP ??= new Date().toISOString()

// Publicació a GitHub Pages: https://<usuari>.github.io/qi-consulta/
export default defineConfig({
  base: '/qi-consulta/',
  plugins: [
    react(),
    // version.json: quina versió hi ha publicada (l'app la mira sense memòria cau)
    {
      name: 'qi-versio',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'version.json',
          source: JSON.stringify({ versio: process.env.VITE_VERSIO_APP, data: process.env.VITE_DATA_APP }),
        })
      },
    },
    VitePWA({
      // La versió nova s'instal·la i espera: l'app la fa servir quan la doctora
      // toca «Actualitzar» (o sola, si està bloquejada). El registre el fa
      // src/actualitzacio (amb updateViaCache: 'none' i comprovacions periòdiques)
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['logo/qi-icona.svg', 'logo/qi-icona-180.png', 'logo/qi-simbol.svg', 'logo/qi-simbol-clar.svg'],
      manifest: {
        name: 'Qi — consulta d\'acupuntura',
        short_name: 'Qi',
        description: 'Pacients, valoracions i sessions d\'acupuntura',
        lang: 'ca',
        theme_color: '#2f5d50',
        background_color: '#f6f3ec',
        display: 'standalone',
        icons: [
          { src: 'logo/qi-icona-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'logo/qi-icona-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'logo/qi-icona-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: 'logo/qi-icona-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Tot el necessari per funcionar sense connexió va dins la precàrrega
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,glb}'],
        // El fragment de Three.js i el cos 3D (GLB) han de cabre a la memòria cau
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  // Només per a les proves de publicació (tests/e2e/produccio-actualitzacio):
  // QI_SAL_TROSSOS canvia el nom de tots els trossos, com si fos una versió
  // nova amb el codi canviat (si no, les dues versions de prova en tindrien
  // molts d'iguals)
  ...(process.env.QI_SAL_TROSSOS
    ? {
        build: {
          rollupOptions: {
            output: {
              entryFileNames: `assets/[name]-${process.env.QI_SAL_TROSSOS}-[hash].js`,
              chunkFileNames: `assets/[name]-${process.env.QI_SAL_TROSSOS}-[hash].js`,
              assetFileNames: `assets/[name]-${process.env.QI_SAL_TROSSOS}-[hash][extname]`,
            },
          },
        },
      }
    : {}),
})
