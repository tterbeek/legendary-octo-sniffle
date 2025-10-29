import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',  // automatically update service worker
      includeAssets: ['favicon.svg'], // optional
      manifest: {
        name: 'Shared Shopping List',
        short_name: 'Shopping List',
        description: 'A collaborative shopping list app',
        theme_color: '#578080', // your custom green
        background_color: '#ffffff',
        display: 'standalone', // makes it a PWA
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png', // put these in `public/`
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})
