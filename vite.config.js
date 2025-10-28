import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',       // auto-update service worker
      includeAssets: ['favicon.svg'],    // optional: add favicon or other assets
      manifest: {
        name: 'Shared Shopping List',       // full app name
        short_name: 'Shopping List',        // short name for small screens
        description: 'A collaborative shopping list app',
        theme_color: '#578080',             // your custom green
        background_color: '#ffffff',
        display: 'standalone',              // runs as standalone app
        scope: '/',                          // root of your app
        start_url: '/',                       // where PWA opens
        icons: [
          {
            src: 'pwa-192x192.png',          // you need to provide these icons in public/
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
            purpose: 'any maskable'         // makes icon maskable for Android/Edge
          }
        ]
      }
    })
  ]
})
