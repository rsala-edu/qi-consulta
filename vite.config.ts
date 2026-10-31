import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Publicació a GitHub Pages: https://<usuari>.github.io/qi-consulta/
export default defineConfig({
  base: '/qi-consulta/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icona.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Qi — consulta d\'acupuntura',
        short_name: 'Qi',
        description: 'Pacients, valoracions i sessions d\'acupuntura',
        lang: 'ca',
        theme_color: '#3f6b5a',
        background_color: '#f7f5f0',
        display: 'standalone',
        icons: [
          { src: 'icona-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icona-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icona-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Tot el necessari per funcionar sense connexió va dins la precàrrega
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
})
