import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initVitals } from './lib/vitals'
import { registerServiceWorker } from './lib/registerSW'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register service worker for PWA / offline support
registerServiceWorker()

// Start Core Web Vitals + RUM tracking after first paint
if (typeof requestIdleCallback !== 'undefined') {
  requestIdleCallback(() => initVitals())
} else {
  setTimeout(() => initVitals(), 0)
}

// Development only: axe-core accessibility audit
if (import.meta.env.DEV) {
  import('axe-core').then((axe) => {
    // Run after initial render settles
    setTimeout(() => {
      axe.default.run(document.body).then((results) => {
        if (results.violations.length > 0) {
          console.warn(`[a11y] ${results.violations.length} accessibility violations:`)
          results.violations.forEach((v) => {
            console.warn(`  ${v.impact} — ${v.id}: ${v.help} (${v.nodes.length} nodes)`)
            // Log the actual offending selectors so they can be fixed —
            // counts alone are useless without targets. Cap at 3 per
            // violation to avoid drowning the console.
            v.nodes.slice(0, 3).forEach((n) => {
              const target = Array.isArray(n.target) ? n.target.join(' ') : String(n.target)
              const summary = n.failureSummary?.split('\n')[1]?.trim() || ''
              console.warn(`    ↳ ${target}${summary ? '  — ' + summary : ''}`)
            })
            if (v.nodes.length > 3) console.warn(`    ↳ …and ${v.nodes.length - 3} more`)
          })
        } else {
          console.log('[a11y] No accessibility violations found')
        }
      })
    }, 2000)
  })
}
