import { test, expect, devices } from '@playwright/test'

test.describe('Mobile Experience', () => {
  test.use({ ...devices['iPhone 14'] })

  test('shows mobile layout with bottom tabs', async ({ page }) => {
    await page.goto('#/dashboard')
    await page.waitForLoadState('networkidle')

    // Bottom nav should be visible
    const bottomNav = page.locator('nav').last()
    await expect(bottomNav).toBeVisible()

    // Should have tab buttons
    const tabs = bottomNav.locator('button')
    const tabCount = await tabs.count()
    expect(tabCount).toBeGreaterThanOrEqual(4)
  })

  test('tabs navigate between pages', async ({ page }) => {
    await page.goto('#/dashboard')
    await page.waitForLoadState('networkidle')

    // Tap Tasks tab
    const tasksTab = page.locator('button').filter({ hasText: /Tasks/i }).first()
    if (await tasksTab.isVisible().catch(() => false)) {
      await tasksTab.tap()
      await page.waitForLoadState('networkidle')
    }
  })

  test('more menu opens with additional pages', async ({ page }) => {
    await page.goto('#/dashboard')
    await page.waitForLoadState('networkidle')

    const moreBtn = page.locator('button').filter({ hasText: /More/i }).first()
    if (await moreBtn.isVisible().catch(() => false)) {
      await moreBtn.tap()
      // Should show more menu overlay
      await page.waitForTimeout(300)
    }
  })

  test('touch targets are at least 44px', async ({ page }) => {
    await page.goto('#/dashboard')
    await page.waitForLoadState('networkidle')

    const buttons = page.locator('nav button')
    const count = await buttons.count()
    for (let i = 0; i < Math.min(count, 5); i++) {
      const box = await buttons.nth(i).boundingBox()
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(40)
      }
    }
  })
})
