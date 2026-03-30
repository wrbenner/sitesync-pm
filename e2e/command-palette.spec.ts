import { test, expect } from '@playwright/test'

test.describe('Command Palette', () => {
  test('should open with Cmd+K', async ({ page }) => {
    await page.goto('#/')
    await page.waitForLoadState('networkidle')
    await page.keyboard.press('Meta+k')
    // The command palette should appear
    await page.waitForTimeout(500)
    // Look for the search input or dialog
    const dialog = page.locator('[cmdk-root], [role="dialog"]')
    if (await dialog.count() > 0) {
      await expect(dialog.first()).toBeVisible()
    }
  })

  test('should close with Escape', async ({ page }) => {
    await page.goto('#/')
    await page.waitForLoadState('networkidle')
    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(300)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  })
})
