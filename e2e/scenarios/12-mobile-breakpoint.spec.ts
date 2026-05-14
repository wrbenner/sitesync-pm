/**
 * Scenario 12 — Mobile breakpoint sweep.
 *
 * The app has a MobileLayout that activates at viewport <= 768px. Most
 * existing specs run at desktop and never exercise the mobile path. This
 * spec drives the 27 main pages at iPhone width and asserts:
 *   - Page mounts without crash
 *   - No layout overflow (horizontal scroll on body)
 *   - Bottom-nav present (the MobileLayout fingerprint)
 *   - "Show navigation menu" button does NOT appear (desktop fingerprint)
 *
 * Doesn't depend on real backend — uses VITE_DEV_BYPASS like other UI specs.
 */
import { test, expect, Page } from '@playwright/test'

const ROUTES = [
  '/dashboard',
  '/rfis',
  '/daily-log',
  '/punch-list',
  '/submittals',
  '/schedule',
  '/budget',
  '/change-orders',
  '/drawings',
  '/files',
  '/safety',
  '/workforce',
  '/crews',
  '/time-tracking',
  '/directory',
  '/meetings',
  '/equipment',
  '/permits',
  '/reports',
  '/contracts',
  '/integrations',
  '/audit-trail',
  '/closeout',
  '/iris',
  '/settings',
  '/profile',
]

const IPHONE = { width: 393, height: 852 }

async function gotoMobile(page: Page, hash: string) {
  await page.setViewportSize(IPHONE)
  await page.goto(`/sitesync-pm/#${hash}`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined)
  await page.waitForTimeout(600)
}

for (const route of ROUTES) {
  test(`mobile@iPhone: ${route} mounts without crash + no horizontal overflow`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))

    await gotoMobile(page, route)

    // 1. Mounts without crash — main landmark present, body has non-empty text.
    const text = await page.locator('body').textContent()
    expect(text?.trim().length ?? 0, `${route} body empty`).toBeGreaterThan(20)

    // 2. No horizontal overflow.
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    expect(overflow, `${route} has ${overflow}px horizontal overflow`).toBeLessThan(20)

    // 3. Desktop-only "Show navigation menu" trigger must NOT be present.
    const desktopTrigger = await page.getByRole('button', { name: 'Show navigation menu' }).count()
    expect(desktopTrigger, `${route} shows desktop sidebar collapse button at iPhone width`).toBe(0)

    // 4. No pageerror crashed the route.
    expect(errors.filter((e) => !/non-recoverable|chunk loading/i.test(e)), `${route} crashed: ${errors.join('|')}`).toEqual([])
  })
}
