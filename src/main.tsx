import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initVitals } from './lib/vitals'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Start Core Web Vitals + RUM tracking after first paint
if (typeof requestIdleCallback !== 'undefined') {
  requestIdleCallback(() => initVitals())
} else {
  setTimeout(() => initVitals(), 0)
}

// ── Service Worker Registration ──────────────────────────
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sitesync-pm/sw.js')

      // Check for updates periodically (every 30 min)
      setInterval(() => registration.update(), 30 * 60 * 1000)

      // Handle new service worker waiting to activate
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version available, dispatch event for UI to show update prompt
            window.dispatchEvent(
              new CustomEvent('sw-update-available', { detail: { registration } })
            )
          }
        })
      })

      // Listen for messages from SW
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'BACKGROUND_SYNC_COMPLETE') {
          window.dispatchEvent(new CustomEvent('background-sync-complete'))
        }
        if (event.data?.type === 'SW_ACTIVATED') {
          // New SW activated, could reload for fresh assets
          window.dispatchEvent(new CustomEvent('sw-activated'))
        }
      })
    } catch {
      // Service worker registration failed silently
    }
  })
}
