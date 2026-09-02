import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  base: '/hoshi/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'models/**/*'],
      workbox: {
        // Default de Workbox es 2MB por archivo; el modelo de evaluacion
        // posicional (src/eval/, vendorizado en public/models/) trae
        // fragmentos de pesos de ~4MB cada uno.
        maximumFileSizeToCacheInBytes: 12 * 1024 * 1024,
      },
      manifest: {
        id: '/hoshi/',
        name: 'Hoshi',
        short_name: 'Hoshi',
        description: 'Aprende Go (weiqi/baduk) desde cero. Learn Go from scratch.',
        start_url: '/hoshi/',
        scope: '/hoshi/',
        display: 'standalone',
        background_color: '#f2eee4',
        theme_color: '#f2eee4',
        orientation: 'portrait',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./tests/setup.ts'],
  },
})
