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

// Publicació a GitHub Pages: https://<usuari>.github.io/qi-consulta/
export default defineConfig({
  base: '/qi-consulta/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
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
})
