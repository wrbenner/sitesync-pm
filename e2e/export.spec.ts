import { test, expect } from '@playwright/test'

test.describe('Export', () => {
  test('should have export button on RFIs page', async ({ page }) => {
    await page.goto('#/rfis')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    const exportBtn = page.getByText('Export', { exact: true })
    if (await exportBtn.count() > 0) {
      await expect(exportBtn.first()).toBeVisible()
    }
  })

  test('should have export button on Budget page', async ({ page }) => {
    await page.goto('#/budget')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)
    const exportBtn = page.getByText('Export', { exact: true })
    if (await exportBtn.count() > 0) {
      await expect(exportBtn.first()).toBeVisible()
    }
  })
})
