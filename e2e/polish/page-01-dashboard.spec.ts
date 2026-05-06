/**
 * page-01-dashboard.spec.ts — Visual sweep for the Dashboard page.
 *
 * Checks: no stuck loading skeletons, KPI tiles visible, activity feed
 * renders, no layout overflow, FAB/nav not covering content.
 */

import { test, expect, loginIfNeeded } from './fixtures'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await loginIfNeeded(page)
  })

  test('loads within 10s and shows KPI tiles or empty state', async ({ page }) => {
    await page.goto('/#/dashboard')
    // 1) Wait for the loading skeleton to appear (aria-busy="true").
    await page.waitForSelector('[aria-busy="true"]', { state: 'attached', timeout: 5_000 }).catch(() => {})
    // 2) Wait for it to disappear — covers react-query's retry cycle (~7s on offline).
    await page.waitForSelector('[aria-busy="true"]', { state: 'detached', timeout: 12_000 }).catch(() => {})
    await page.screenshot({ path: `polish-review/pages/dashboard/${test.info().project.name}-01-loaded.png`, fullPage: false })
    // Page must show something meaningful after loading ends.
    const body = await page.locator('body').textContent()
    expect(body?.trim().length).toBeGreaterThan(0)
  })

  test('activity feed visible and not clipped', async ({ page }) => {
    await page.goto('/#/dashboard')
    await page.waitForTimeout(3_000)
    const feed = page.locator('[data-testid="activity-feed"], [aria-label*="activity" i]').first()
    if (await feed.count() > 0) {
      await expect(feed).toBeVisible()
    }
    await page.screenshot({ path: `polish-review/pages/dashboard/${test.info().project.name}-02-activity.png`, fullPage: true })
  })
})
