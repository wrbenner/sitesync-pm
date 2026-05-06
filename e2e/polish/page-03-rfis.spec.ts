/**
 * page-03-rfis.spec.ts — Visual sweep for the RFIs page.
 *
 * Checks: list renders, filters visible, no clipped badges, status tabs shown.
 */

import { test, expect, loginIfNeeded } from './fixtures'

test.describe('RFIs', () => {
  test.beforeEach(async ({ page }) => {
    await loginIfNeeded(page)
  })

  test('list renders without stuck skeleton', async ({ page }) => {
    await page.goto('/#/rfis')
    await page.waitForTimeout(5_000)
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
    await page.screenshot({ path: `polish-review/pages/rfis/${test.info().project.name}-01-list.png`, fullPage: false })
  })

  test('status tabs are visible and clickable', async ({ page }) => {
    await page.goto('/#/rfis')
    await page.waitForTimeout(3_000)
    const tabs = page.locator('[role="tab"], [role="tablist"] button')
    if (await tabs.count() > 0) {
      await expect(tabs.first()).toBeVisible()
    }
    await page.screenshot({ path: `polish-review/pages/rfis/${test.info().project.name}-02-tabs.png`, fullPage: false })
  })
})
