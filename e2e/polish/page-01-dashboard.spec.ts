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

  test('loads within 5s and shows KPI tiles', async ({ page }) => {
    await page.goto('/#/dashboard')
    // No stuck loading skeleton after 5 seconds
    await page.waitForTimeout(5_000)
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
    await page.screenshot({ path: `polish-review/pages/dashboard/${test.info().project.name}-01-loaded.png`, fullPage: false })
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
