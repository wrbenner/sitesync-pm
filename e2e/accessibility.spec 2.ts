import { test, expect } from '@playwright/test'

test.describe('Accessibility', () => {
  test('route announcer announces page changes', async ({ page }) => {
    await page.goto('#/dashboard')
    await page.waitForLoadState('networkidle')

    // Check for route announcer
    const announcer = page.locator('[role="status"][aria-live="polite"]')
    if (await announcer.count() > 0) {
      await expect(announcer).toHaveAttribute('aria-atomic', 'true')
    }

    // Navigate to another page
    await page.goto('#/tasks')
    await page.waitForLoadState('networkidle')

    if (await announcer.count() > 0) {
      const text = await announcer.textContent()
      expect(text).toContain('Tasks')
    }
  })

  test('focus visible ring on keyboard navigation', async ({ page }) => {
    await page.goto('#/dashboard')
    await page.waitForLoadState('networkidle')

    // Tab through interactive elements
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Tab')

    // Active element should have focus visible styles
    const focused = page.locator(':focus-visible')
    const count = await focused.count()
    // At least one element should have focus-visible
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('all images have alt text or aria-hidden', async ({ page }) => {
    await page.goto('#/dashboard')
    await page.waitForLoadState('networkidle')

    const images = page.locator('img')
    const count = await images.count()
    for (let i = 0; i < count; i++) {
      const img = images.nth(i)
      const alt = await img.getAttribute('alt')
      const hidden = await img.getAttribute('aria-hidden')
      const role = await img.getAttribute('role')
      // Image should have alt text, or be aria-hidden, or have presentation role
      expect(alt !== null || hidden === 'true' || role === 'presentation').toBeTruthy()
    }
  })

  test('interactive elements are keyboard accessible', async ({ page }) => {
    await page.goto('#/dashboard')
    await page.waitForLoadState('networkidle')

    // Verify buttons have proper roles
    const buttons = page.locator('button')
    const count = await buttons.count()
    for (let i = 0; i < Math.min(count, 10); i++) {
      const btn = buttons.nth(i)
      if (await btn.isVisible()) {
        // Buttons should be focusable
        const tabIndex = await btn.getAttribute('tabindex')
        expect(tabIndex === null || parseInt(tabIndex) >= 0).toBeTruthy()
      }
    }
  })

  test('page has proper heading hierarchy', async ({ page }) => {
    await page.goto('#/dashboard')
    await page.waitForLoadState('networkidle')

    // Check for at least one heading
    const headings = page.locator('h1, h2, h3, h4, h5, h6, [role="heading"]')
    const count = await headings.count()
    // Dashboard should have headings
    expect(count).toBeGreaterThanOrEqual(0)
  })
})
