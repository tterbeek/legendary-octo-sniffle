import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Import PWA registration helper
import { registerSW } from 'virtual:pwa-register'

// Register the service worker (handles install, updates, etc.)
registerSW({
  onNeedRefresh() {
    if (confirm('A new version is available. Reload now?')) {
      window.location.reload()
    }
  },
  onOfflineReady() {
    console.log('App ready to work offline')
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
