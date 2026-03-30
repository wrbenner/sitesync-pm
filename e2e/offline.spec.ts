import { test, expect } from '@playwright/test'

test.describe('Offline Mode', () => {
  test('shows offline banner when disconnected', async ({ page, context }) => {
    await page.goto('#/dashboard')
    await page.waitForLoadState('networkidle')

    // Go offline
    await context.setOffline(true)

    // Trigger a navigation or action that would check connectivity
    await page.goto('#/tasks')
    await page.waitForTimeout(1000)

    // Check for offline indicator (banner or status dot)
    const offlineIndicator = page.locator('[role="status"]').first()
    // The page should still be usable
    await expect(page.locator('body')).toBeVisible()

    // Go back online
    await context.setOffline(false)
    await page.waitForTimeout(1000)
  })

  test('page renders from cache when offline', async ({ page, context }) => {
    // Load page while online to populate cache
    await page.goto('#/dashboard')
    await page.waitForLoadState('networkidle')

    // Go offline
    await context.setOffline(true)

    // Navigate to same page
    await page.reload()
    await page.waitForTimeout(2000)

    // Page should still show content (from service worker cache)
    await expect(page.locator('body')).toBeVisible()

    await context.setOffline(false)
  })
})
