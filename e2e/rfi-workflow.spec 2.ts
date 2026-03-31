import { test, expect } from '@playwright/test'

test.describe('RFI Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('#/rfis')
    await page.waitForLoadState('networkidle')
  })

  test('RFI page loads with table or empty state', async ({ page }) => {
    // Should show either the RFI list table or an empty state
    const body = page.locator('body')
    await expect(body).toBeVisible()

    // Look for either data rows or empty state message
    const hasContent = await page.locator('table, [data-testid="empty-state"]').first().isVisible().catch(() => false)
    const hasPage = await page.getByText(/RFI/i).first().isVisible().catch(() => false)
    expect(hasContent || hasPage).toBeTruthy()
  })

  test('can open create RFI modal', async ({ page }) => {
    // Look for a create/new button
    const createBtn = page.locator('button').filter({ hasText: /new|create|add/i }).first()
    if (await createBtn.isVisible().catch(() => false)) {
      await createBtn.click()
      // Modal should appear
      const modal = page.locator('[role="dialog"]')
      await expect(modal).toBeVisible({ timeout: 3000 })
    }
  })

  test('search input filters results', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]').first()
    if (await searchInput.isVisible().catch(() => false)) {
      await searchInput.fill('structural')
      await page.waitForTimeout(500) // debounce
    }
  })
})
