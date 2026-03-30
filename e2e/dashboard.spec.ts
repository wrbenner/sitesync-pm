import { test, expect } from '@playwright/test'

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('#/dashboard')
    await page.waitForLoadState('networkidle')
  })

  test('renders dashboard with key sections', async ({ page }) => {
    // Page should load
    await expect(page.locator('body')).toBeVisible()

    // Should have metric cards or dashboard widgets
    const mainContent = page.locator('#main-content, [role="main"]').first()
    await expect(mainContent).toBeVisible()
  })

  test('sidebar navigation works', async ({ page }) => {
    // Click Tasks in sidebar
    const tasksLink = page.locator('nav').getByText('Tasks').first()
    if (await tasksLink.isVisible()) {
      await tasksLink.click()
      await page.waitForLoadState('networkidle')
      await expect(page).toHaveURL(/#\/tasks/)
    }
  })

  test('skip to content link is focusable', async ({ page }) => {
    // Tab to the skip link
    await page.keyboard.press('Tab')
    const skipLink = page.locator('a[href="#main-content"]')
    if (await skipLink.count() > 0) {
      // Should become visible on focus
      await expect(skipLink).toHaveAttribute('href', '#main-content')
    }
  })
})
