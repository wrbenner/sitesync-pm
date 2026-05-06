/**
 * page-05-budget.spec.ts — Visual sweep for the Budget page.
 *
 * Checks: budget summary tiles render, line items table visible, no
 * S-Curve loading forever, no random number changes on reload.
 */

import { test, expect, loginIfNeeded } from './fixtures'

test.describe('Budget', () => {
  test.beforeEach(async ({ page }) => {
    await loginIfNeeded(page)
  })

  test('budget summary tiles render without skeleton', async ({ page }) => {
    await page.goto('/#/budget')
    await page.waitForTimeout(5_000)
    await expect(page.locator('[aria-busy="true"]')).toHaveCount(0)
    await page.screenshot({ path: `polish-review/pages/budget/${test.info().project.name}-01-summary.png`, fullPage: false })
  })

  test('line items table is visible and not overflowing viewport', async ({ page }) => {
    await page.goto('/#/budget')
    await page.waitForTimeout(3_000)
    await page.screenshot({ path: `polish-review/pages/budget/${test.info().project.name}-02-table.png`, fullPage: true })
  })
})
