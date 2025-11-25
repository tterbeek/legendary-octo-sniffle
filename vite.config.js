import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',  // automatically update service worker
      manifest: {
        name: 'GrocLi',
        short_name: 'GrocLi',
        description: 'A collaborative grocery lists app',
        theme_color: '#578080', // your custom green
        background_color: '#ffffff',
        display: 'standalone', // makes it a PWA
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/icon-192x192-v3.png', // put these in `public/`
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: '/icon-512x512-v3.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: '/maskable-icon-192x192-v3.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ]
})
