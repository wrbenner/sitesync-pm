# Lap 1 Acceptance Gate Spec

**Date:** 2026-05-01
**Status:** Spec ready for autonomous execution
**Scope:** Day 30 of Lap 1
**Author:** Day 9 prep pass

---

## The Gate (per Lap 1 tracker)

> Cold-open demo on 4G iPhone — 1.4s first paint, audit-row drawer ≤ 800ms.
> Friendly GC walks through it next day and emails asking when they can pilot.

The "friendly GC walks through it" is human, not programmatic. But the
1.4s/800ms numbers are testable, and if they're not green, the friendly
GC won't be impressed. So we test those programmatically before going
human.

---

## Programmatic Test

Create `e2e/lap-1-acceptance.spec.ts`:

```ts
import { test, expect } from '@playwright/test'

const FOUR_G_PROFILE = {
  // Slow 4G as defined by Lighthouse
  // ~400ms RTT, 4 Mbps down, 3 Mbps up
  offline: false,
  downloadThroughput: (4 * 1024 * 1024) / 8,  // 4 Mbps in bytes/sec
  uploadThroughput: (3 * 1024 * 1024) / 8,
  latency: 400,
}

test.describe('Lap 1 Acceptance Gate (Day 30)', () => {
  test('cold open to dashboard ≤ 1.4s first paint on 4G iPhone', async ({ page, context }) => {
    // 4G throttle
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', FOUR_G_PROFILE)

    // CPU throttle (mid-range mobile)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })

    // Mobile viewport (iPhone 12)
    await page.setViewportSize({ width: 390, height: 844 })

    // Cold open: clear all caches first
    await context.clearCookies()
    await page.goto('about:blank')

    // Time the navigation to dashboard
    const start = Date.now()
    await page.goto('/dashboard', { waitUntil: 'load' })

    // First paint metric — wait for the dashboard hero to be visible
    await expect(page.getByTestId('dashboard-hero')).toBeVisible()
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(1400)  // 1.4s
  })

  test('audit-row drawer opens ≤ 800ms after click', async ({ page, context }) => {
    // 4G throttle (same as above — extract to fixture)
    const cdp = await context.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', FOUR_G_PROFILE)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
    await page.setViewportSize({ width: 390, height: 844 })

    // Sign in + navigate to a project with audit rows
    await page.goto('/login')
    await page.getByTestId('demo-login-button').click()
    await page.goto('/projects/demo-project/audit')

    // Wait for the list to be visible
    await expect(page.getByTestId('audit-row').first()).toBeVisible()

    // Time the drawer open
    const start = Date.now()
    await page.getByTestId('audit-row').first().click()
    await expect(page.getByTestId('audit-row-drawer')).toBeVisible()
    const elapsed = Date.now() - start

    expect(elapsed).toBeLessThan(800)
  })

  test('demo-path bundle ≤ 500 KB gzipped', async ({ page, context }) => {
    // Capture all network responses
    const responses: Array<{ url: string; size: number }> = []
    page.on('response', async (response) => {
      if (response.url().endsWith('.js') || response.url().endsWith('.css')) {
        const buf = await response.body().catch(() => Buffer.alloc(0))
        const encoding = response.headers()['content-encoding']
        // Approximate gzipped size — Playwright doesn't expose it directly
        const size = encoding === 'gzip' ? buf.length : Math.ceil(buf.length * 0.3)
        responses.push({ url: response.url(), size })
      }
    })

    await page.goto('/dashboard', { waitUntil: 'load' })
    const total = responses.reduce((s, r) => s + r.size, 0)

    expect(total).toBeLessThan(500 * 1024)  // 500 KB
  })
})
```

---

## Required Fixtures

Add these `data-testid` attributes to the app if missing:

| Test ID | Where | Purpose |
|---|---|---|
| `dashboard-hero` | First content block on `/dashboard` | First-paint signal |
| `audit-row` | Each row in the audit list | Drawer trigger |
| `audit-row-drawer` | The drawer that opens on row click | Drawer visibility signal |
| `demo-login-button` | Login page demo path | Bypass real auth in CI |

The organism should grep for each id; if missing, add it to the
relevant component (no functional change, just `data-testid` attribute).

---

## CI Integration

Add to `.github/workflows/ci.yml` (or wherever Playwright runs):

```yaml
- name: Lap 1 acceptance gate
  run: npx playwright test e2e/lap-1-acceptance.spec.ts
```

Run on every PR to `main` after Day 30. Failure blocks merge.

---

## Manual Sanity Check (Walker, Day 30 morning)

Even with the programmatic test green, do this once:

1. Disconnect from WiFi. Connect iPhone 12+ to 4G.
2. Open Safari. Navigate to demo URL.
3. Time it on a stopwatch. Should feel ≤ 1.5s.
4. Tap an audit row. Drawer should slide in immediately.
5. If either feels slow despite the test passing — the test fixture is wrong, not the app. Tighten the test.
6. Hand the phone to a GC you trust. Watch their face. If they go "huh, that's fast" — Day 30 is green.

---

## Failure Recovery

If the gate fails:

| Failure | First diagnosis | Fix |
|---|---|---|
| First paint > 1.4s | Check `BUNDLE_FINAL_2026-05-01.txt`. If demo-path > 500 KB, more lazy-loading needed. If LCP > 1s, check hero render path. | Day 27 work continues into Day 30. |
| Drawer > 800ms | Check the data fetch — is the row data already loaded or is it making a fresh request? | Pre-fetch on row hover. Or render the drawer optimistically with skeleton. |
| Bundle > 500 KB | Run treemap. Find the unexpected fat dep. | Lazy-load or replace it. |

---

## What "Done" Looks Like

- All 3 Playwright tests green in CI.
- `BUNDLE_FINAL_2026-05-01.txt` shows demo-path ≤ 500 KB gzipped.
- `docs/audits/DAY_30_LAP_1_ACCEPTANCE_RECEIPT_2026-05-01.md` shipped with the actual measured numbers.
- Tracker row 30 → ✓.
- Walker emails a friendly GC. They walk through the demo. Either they
  email back asking about a pilot — or we learn what to fix in Lap 2.

The programmatic gate doesn't replace the human gate. It just makes sure
the human gate isn't doomed before we run it.
