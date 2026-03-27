import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initErrorTracking } from './lib/errorTracking'

// Initialize error tracking before rendering
initErrorTracking();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register service worker for offline support and PWA
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sitesync-pm/sw.js')
      .then((registration) => {
        console.info('[SW] Registered:', registration.scope);

        // Check for updates periodically
        setInterval(() => registration.update(), 60 * 60 * 1000);
      })
      .catch((error) => {
        console.warn('[SW] Registration failed:', error);
      });
  });
}
