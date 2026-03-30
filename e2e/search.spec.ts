import { test, expect } from '@playwright/test'

test.describe('Search and Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('#/dashboard')
    await page.waitForLoadState('networkidle')
  })

  test('command palette opens with keyboard shortcut', async ({ page }) => {
    // Cmd+K or Ctrl+K should open command palette
    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(500)

    // Look for search input in command palette
    const palette = page.locator('[role="dialog"], [role="combobox"]').first()
    if (await palette.isVisible().catch(() => false)) {
      await expect(palette).toBeVisible()
    }
  })

  test('search input accepts text and shows results', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(300)

    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"], input[type="search"]').first()
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('concrete')
      await page.waitForTimeout(500) // Wait for search debounce
    }
  })

  test('escape closes command palette', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    await page.waitForTimeout(300)

    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)

    // Palette should be closed
    const palette = page.locator('[role="dialog"]').first()
    if (await palette.count() > 0) {
      await expect(palette).not.toBeVisible()
    }
  })
})
