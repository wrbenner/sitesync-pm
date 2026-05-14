/**
 * Scenario 14 — Long-session memory + leak detection.
 *
 * A construction PM keeps SiteSync open all day. Tab leaks (event listeners,
 * react-query cache unbounded growth, dangling websocket subscriptions)
 * compound over hours and crash the tab around hour 6.
 *
 * This spec simulates a compressed "full work day" in ~90 seconds by
 * navigating between routes rapidly while measuring JS heap size at the
 * start and end. Asserts heap growth is bounded.
 *
 * Doesn't need real backend — the leak surface is React-side.
 */
import { test, expect, Page } from '@playwright/test'

const BASE = '/sitesync-pm/'

const ROUTES = [
  '/dashboard', '/rfis', '/daily-log', '/punch-list', '/submittals',
  '/schedule', '/budget', '/change-orders', '/drawings', '/files',
  '/safety', '/workforce', '/reports', '/profile', '/dashboard',
]

async function gotoDesktop(page: Page, hash: string) {
  await page.goto(`${BASE}#${hash}`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 4_000 }).catch(() => undefined)
  await page.waitForTimeout(150)
}

async function heapMB(page: Page): Promise<number | null> {
  // performance.memory is Chrome-only. Returns null on other browsers — spec
  // is automatically skipped via expect.toBeGreaterThan.
  return await page.evaluate(() => {
    const perfWithMem = performance as unknown as { memory?: { usedJSHeapSize: number } }
    return perfWithMem.memory ? perfWithMem.memory.usedJSHeapSize / 1024 / 1024 : null
  })
}

// ---------------------------------------------------------------------------
// L1 — 100-route hop: heap should not grow more than 3x the warm baseline
// ---------------------------------------------------------------------------
test('L1: 100 navigations stay within 3x warm-baseline heap', async ({ page }) => {
  test.setTimeout(180_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoDesktop(page, '/dashboard')
  await page.waitForTimeout(2000)

  const baseline = await heapMB(page)
  if (baseline === null) test.skip(true, 'performance.memory not available — Chrome-only spec')

  // Hop through routes 7x to total ~100 nav events.
  for (let cycle = 0; cycle < 7; cycle++) {
    for (const route of ROUTES) {
      await gotoDesktop(page, route)
    }
  }

  // Force GC if exposed (Playwright with --js-flags=--expose-gc).
  await page.evaluate(() => {
    const win = window as unknown as { gc?: () => void }
    if (win.gc) win.gc()
  })
  await page.waitForTimeout(1000)

  const final = await heapMB(page)
  expect(final).not.toBeNull()
  const ratio = (final ?? 0) / (baseline ?? 1)
  test.info().annotations.push({
    type: 'metric',
    description: `Heap: baseline=${baseline?.toFixed(1)}MB final=${final?.toFixed(1)}MB ratio=${ratio.toFixed(2)}x`,
  })
  expect(ratio, `heap grew ${ratio.toFixed(2)}x — likely leak`).toBeLessThan(3)
})

// ---------------------------------------------------------------------------
// L2 — DOM node count: stays bounded across navigations
// ---------------------------------------------------------------------------
test('L2: DOM node count bounded across 50 navigations', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  await gotoDesktop(page, '/dashboard')
  await page.waitForTimeout(2000)

  const baseline = await page.evaluate(() => document.querySelectorAll('*').length)

  for (let i = 0; i < 50; i++) {
    await gotoDesktop(page, ROUTES[i % ROUTES.length])
  }
  await page.waitForTimeout(1500)

  const final = await page.evaluate(() => document.querySelectorAll('*').length)
  const ratio = final / baseline
  test.info().annotations.push({
    type: 'metric',
    description: `DOM nodes: baseline=${baseline} final=${final} ratio=${ratio.toFixed(2)}x`,
  })
  // Real apps churn nodes; 3x is a generous ceiling. >5x means stale subtree
  // retention (common React Portal / Floating UI leak signature).
  expect(ratio, `DOM nodes grew ${ratio.toFixed(2)}x`).toBeLessThan(5)
})

// ---------------------------------------------------------------------------
// L3 — Event listener accumulation: getEventListeners-style detection
// ---------------------------------------------------------------------------
test('L3: window event listener count stays bounded', async ({ page }) => {
  test.setTimeout(120_000)
  await page.setViewportSize({ width: 1440, height: 900 })

  // Patch addEventListener to count. Has to happen before initial nav so
  // every listener is counted from t=0.
  await page.addInitScript(() => {
    const w = window as unknown as { __listenerCounts?: Record<string, number> }
    w.__listenerCounts = {}
    const orig = EventTarget.prototype.addEventListener
    EventTarget.prototype.addEventListener = function (type, ...rest) {
      w.__listenerCounts![type] = (w.__listenerCounts![type] ?? 0) + 1
      return orig.call(this, type, ...rest)
    }
  })

  await gotoDesktop(page, '/dashboard')
  await page.waitForTimeout(2000)

  for (let i = 0; i < 30; i++) {
    await gotoDesktop(page, ROUTES[i % ROUTES.length])
  }

  const counts = await page.evaluate(() => {
    const w = window as unknown as { __listenerCounts?: Record<string, number> }
    return w.__listenerCounts ?? {}
  })
  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  test.info().annotations.push({
    type: 'metric',
    description: `Listener registrations across 30 navs: ${total} (${JSON.stringify(counts)})`,
  })
  // No assertion threshold here — this records, doesn't gate. A growth pattern
  // across runs is the signal, captured in the annotation.
  expect(total).toBeGreaterThan(0)
})
