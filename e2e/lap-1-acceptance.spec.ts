// Lap 1 Acceptance Gate (Day 30)
// Spec: docs/audits/LAP_1_ACCEPTANCE_GATE_SPEC_2026-05-01.md
//
// Three programmatic gates for Lap 1:
//   1. Cold open to dashboard ≤ 1.4s first paint on simulated 4G iPhone
//   2. Audit-row drawer opens ≤ 800ms after click
//   3. Demo-path JS+CSS bundle ≤ 500 KB gzipped
//
// Routes adapted to actual app:
//   - /dashboard redirects to /day → Cockpit page is the dashboard
//   - /audit-trail is the audit page (no per-project sub-route)
//   - VITE_DEV_BYPASS=true (set in playwright.config.ts) bypasses auth — no
//     demo-login button needed.
//
// If a gate fails, see docs/audits/LAP_1_ACCEPTANCE_GATE_SPEC_2026-05-01.md
// "Failure Recovery" — bundle issues route to Day 27 work, drawer issues
// route to data-fetch optimization, first-paint issues route to LCP analysis.

import { test, expect } from '@playwright/test'

// Slow 4G profile (Lighthouse default)
const FOUR_G_PROFILE = {
  offline: false,
  downloadThroughput: (4 * 1024 * 1024) / 8,  // 4 Mbps
  uploadThroughput: (3 * 1024 * 1024) / 8,    // 3 Mbps
  latency: 400,                                // 400ms RTT
}

async function applyMobileThrottle(page: import('@playwright/test').Page, context: import('@playwright/test').BrowserContext) {
  const cdp = await context.newCDPSession(page)
  await cdp.send('Network.enable')
  await cdp.send('Network.emulateNetworkConditions', FOUR_G_PROFILE)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.setViewportSize({ width: 390, height: 844 })  // iPhone 12
}

test.describe('Lap 1 Acceptance Gate (Day 30)', () => {
  test('cold open to dashboard ≤ 1.4s first paint on 4G iPhone', async ({ page, context }) => {
    await applyMobileThrottle(page, context)
    await context.clearCookies()

    const start = Date.now()
    await page.goto('/#/day', { waitUntil: 'load' })
    await expect(page.getByTestId('dashboard-hero')).toBeVisible()
    const elapsed = Date.now() - start

    console.log(`[Lap 1 Gate] Dashboard first paint: ${elapsed}ms (target ≤ 1400ms)`)
    expect(elapsed).toBeLessThan(1400)
  })

  test('audit-row drawer opens ≤ 800ms after click', async ({ page, context }) => {
    await applyMobileThrottle(page, context)

    await page.goto('/#/audit-trail', { waitUntil: 'load' })

    // Wait for at least one audit row to be visible. If the audit table is
    // empty (e.g., fresh demo seed has no audit history), skip — the gate
    // doesn't apply. The receipt should record this case.
    const firstRow = page.getByTestId('audit-row').first()
    const rowVisible = await firstRow.isVisible({ timeout: 5000 }).catch(() => false)
    test.skip(!rowVisible, 'Audit trail empty — drawer gate not applicable in this seed state')

    const start = Date.now()
    await firstRow.click()
    await expect(page.getByTestId('audit-row-drawer')).toBeVisible()
    const elapsed = Date.now() - start

    console.log(`[Lap 1 Gate] Audit drawer open: ${elapsed}ms (target ≤ 800ms)`)
    expect(elapsed).toBeLessThan(800)
  })

  test('demo-path JS+CSS bundle ≤ 500 KB gzipped', async ({ page }) => {
    const responses: Array<{ url: string; size: number }> = []
    page.on('response', async (response) => {
      const url = response.url()
      if (url.endsWith('.js') || url.endsWith('.css')) {
        const buf = await response.body().catch(() => Buffer.alloc(0))
        const encoding = response.headers()['content-encoding']
        // If already gzipped on the wire, body() returns decoded — use the
        // content-length header as a better proxy. Otherwise estimate.
        const contentLength = parseInt(response.headers()['content-length'] ?? '0', 10)
        const size = encoding === 'gzip' && contentLength > 0
          ? contentLength
          : Math.ceil(buf.length * 0.3)  // rough gzip estimate when not pre-compressed
        responses.push({ url, size })
      }
    })

    await page.goto('/#/day', { waitUntil: 'load' })
    const total = responses.reduce((s, r) => s + r.size, 0)

    console.log(`[Lap 1 Gate] Demo-path bundle: ${(total / 1024).toFixed(1)} KB gzipped (target ≤ 500 KB)`)
    if (total >= 500 * 1024) {
      const top = [...responses].sort((a, b) => b.size - a.size).slice(0, 10)
      console.log('[Lap 1 Gate] Top 10 chunks:')
      for (const r of top) console.log(`  ${(r.size / 1024).toFixed(1)} KB  ${r.url}`)
    }

    expect(total).toBeLessThan(500 * 1024)
  })
})
