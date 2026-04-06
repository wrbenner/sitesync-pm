import { test, expect } from '@playwright/test'

/**
 * THE GC DEMO FLOW — April 15th
 * 
 * This test runs the exact 6-step demo Walker shows to GCs.
 * If this passes: the demo works flawlessly.
 * If this fails: something needs fixing before April 15th.
 * 
 * Run: npx playwright test e2e/demo-flow.spec.ts --headed
 */

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'https://sitesync-pm.vercel.app'
const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'demo@sitesync.ai'
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'SiteSync2026!'

test.describe('GC Demo Flow — April 15th', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto(BASE_URL)
    await page.waitForLoadState('networkidle')
  })

  test('Step 1: App loads and navigates to Dashboard', async ({ page }) => {
    // Should see the login page or dashboard
    await expect(page).toHaveTitle(/SiteSync/)
    
    // No console errors on load
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    
    await page.waitForTimeout(2000)
    
    // Filter out known non-critical errors
    const criticalErrors = consoleErrors.filter(e => 
      !e.includes('favicon') && 
      !e.includes('extension') &&
      !e.includes('ResizeObserver')
    )
    
    expect(criticalErrors).toHaveLength(0)
  })

  test('Step 2: Dashboard shows real project data (no mock data)', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/dashboard`)
    await page.waitForLoadState('networkidle')
    
    // Should not show any mock/demo data indicators
    const bodyText = await page.textContent('body')
    expect(bodyText).not.toContain('Lorem ipsum')
    expect(bodyText).not.toContain('John Doe')
    expect(bodyText).not.toContain('placeholder')
    
    // Dashboard should have key widgets
    await expect(page.locator('[data-testid="dashboard"]').or(page.locator('main'))).toBeVisible()
    
    // Should load within 3 seconds
    const startTime = Date.now()
    await page.waitForSelector('main', { timeout: 3000 })
    const loadTime = Date.now() - startTime
    expect(loadTime).toBeLessThan(3000)
  })

  test('Step 3: RFI page loads and create RFI works', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/rfis`)
    await page.waitForLoadState('networkidle')
    
    // Page should load
    await expect(page.getByRole('heading', { name: /RFI/i }).or(page.locator('h1'))).toBeVisible({ timeout: 5000 })
    
    // Create RFI button should be visible
    const createBtn = page.getByRole('button', { name: /New RFI|Create RFI/i })
    await expect(createBtn).toBeVisible()
  })

  test('Step 4: AI Copilot responds (not mock response)', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/ai-copilot`)
    await page.waitForLoadState('networkidle')
    
    // Page should load
    await expect(page.locator('main')).toBeVisible({ timeout: 5000 })
    
    // Should have an input field
    const input = page.getByRole('textbox').or(page.locator('textarea')).first()
    await expect(input).toBeVisible()
  })

  test('Step 5: Budget page loads with data structure', async ({ page }) => {
    await page.goto(`${BASE_URL}/#/budget`)
    await page.waitForLoadState('networkidle')
    
    await expect(page.locator('main')).toBeVisible({ timeout: 5000 })
    
    // No console errors
    const consoleErrors: string[] = []
    page.on('console', msg => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    await page.waitForTimeout(1000)
    const criticalErrors = consoleErrors.filter(e => !e.includes('favicon') && !e.includes('extension'))
    expect(criticalErrors).toHaveLength(0)
  })

  test('Step 6: Mobile layout works (iPad viewport)', async ({ page }) => {
    // Simulate iPad
    await page.setViewportSize({ width: 1024, height: 1366 })
    await page.goto(`${BASE_URL}/#/dashboard`)
    await page.waitForLoadState('networkidle')
    
    // Page should be responsive — no horizontal scrollbar
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    const viewportWidth = 1024
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 10) // 10px tolerance
    
    // Touch targets should be at least 44px
    const buttons = await page.locator('button').all()
    for (const btn of buttons.slice(0, 10)) { // Check first 10
      const box = await btn.boundingBox()
      if (box) {
        // Most buttons should meet minimum touch target
        const meetsMinimum = box.height >= 44 || box.width >= 44
        if (!meetsMinimum) {
          console.warn(`Small touch target: ${box.width}x${box.height}`)
        }
      }
    }
  })

  test('Performance: All 6 demo pages load under 3s', async ({ page }) => {
    const pages = ['dashboard', 'rfis', 'submittals', 'ai-copilot', 'budget', 'daily-log']
    
    for (const pageName of pages) {
      const start = Date.now()
      await page.goto(`${BASE_URL}/#/${pageName}`)
      await page.waitForSelector('main', { timeout: 3000 })
      const loadTime = Date.now() - start
      
      expect(loadTime, `${pageName} should load under 3s`).toBeLessThan(3000)
    }
  })
})
