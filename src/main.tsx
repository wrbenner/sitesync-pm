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
          })
        } else {
          console.log('[a11y] No accessibility violations found')
        }
      })
    }, 2000)
  })
}
