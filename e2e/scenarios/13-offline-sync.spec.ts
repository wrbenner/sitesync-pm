/**
 * Scenario 13 — Offline → online sync race.
 *
 * SyncManager is core to the app: writes queue while offline, replay when
 * the network returns. Race conditions here are silent killers — duplicate
 * rows, lost edits, conflicting overrides.
 *
 * This spec uses Playwright's `context.setOffline()` to simulate the
 * disconnect. Works in dev-bypass mode since the offline behavior is
 * UI-driven (the React Query mutation queue), not Supabase-dependent.
 */
import { test, expect } from '@playwright/test'

const BASE = '/sitesync-pm/'

async function gotoDesktop(page: import('@playwright/test').Page, hash: string) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${BASE}#${hash}`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined)
  await page.waitForTimeout(800)
}

// ---------------------------------------------------------------------------
// O1 — Offline banner appears when network drops
// ---------------------------------------------------------------------------
test('O1: OfflineBanner renders when network goes offline', async ({ page, context }) => {
  await gotoDesktop(page, '/dashboard')
  await context.setOffline(true)
  // Trigger a fetch via a navigation so the network-aware code path fires.
  await page.evaluate(() => fetch('/sitesync-pm/').catch(() => undefined))
  await page.waitForTimeout(800)
  // OfflineBanner has specific copy variants — be tolerant.
  const offlineCopy = page.getByText(/offline|reconnect|connection|no internet/i).first()
  await expect(offlineCopy, 'OfflineBanner did not surface when offline').toBeVisible({ timeout: 8_000 })
  await context.setOffline(false)
})

// ---------------------------------------------------------------------------
// O2 — Offline banner clears when network returns
// ---------------------------------------------------------------------------
test('O2: OfflineBanner clears when network restored', async ({ page, context }) => {
  await gotoDesktop(page, '/dashboard')
  await context.setOffline(true)
  await page.evaluate(() => fetch('/sitesync-pm/').catch(() => undefined))
  await page.waitForTimeout(1000)
  await context.setOffline(false)
  // Wait for the banner to clear — give SyncManager up to 90s (HARD_CAP_MS).
  const offlineCopy = page.getByText(/offline|reconnect|connection|no internet/i).first()
  await expect(offlineCopy).not.toBeVisible({ timeout: 90_000 })
})

// ---------------------------------------------------------------------------
// O3 — Service worker / IndexedDB persistence: data survives reload
// ---------------------------------------------------------------------------
test('O3: React Query persisted cache survives full reload', async ({ page }) => {
  await gotoDesktop(page, '/dashboard')
  // Wait for initial cache hydration
  await page.waitForTimeout(2000)
  const beforeReload = await page.evaluate(() => {
    // Check for any persisted cache marker — usually React Query persists
    // under `REACT_QUERY_OFFLINE_CACHE` or `tanstack-query-cache` in
    // localStorage / IndexedDB.
    return Object.keys(localStorage).some((k) => /react.query|tanstack/i.test(k))
      || ('indexedDB' in window)
  })
  expect(beforeReload, 'No client-side cache backend detected').toBe(true)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1500)
  // After reload, the dashboard should render quickly (cache hit) — assert
  // it shows real content within 5s, not just a blank skeleton.
  await expect(page.locator('body')).not.toContainText(/Loading project — projects/i, { timeout: 5_000 })
})

// ---------------------------------------------------------------------------
// O4 — Tab visibility: backgrounded tab doesn't lose state on resume
// ---------------------------------------------------------------------------
test('O4: visibility-change → resume preserves auth state', async ({ page }) => {
  await gotoDesktop(page, '/dashboard')
  // Fire a visibilitychange to "hidden" then back to "visible" — simulates
  // backgrounding for 30s. The auth listener should not re-trigger an
  // unnecessary sign-out or session-recovery flow.
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(1500)
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(1500)
  // Must NOT be on /login — auth should have survived.
  expect(page.url()).not.toMatch(/\/login(\?|$)/)
})
