import { test, expect } from '@playwright/test'

const viewports = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
]

const keyPages = ['#/', '#/rfis', '#/tasks', '#/budget', '#/punch-list']

test.describe('Responsive', () => {
  for (const viewport of viewports) {
    for (const path of keyPages) {
      test(`${path} renders at ${viewport.name} (${viewport.width}x${viewport.height})`, async ({ page }) => {
        await page.setViewportSize(viewport)
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        await page.waitForTimeout(500)

        // No horizontal overflow
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
        expect(bodyWidth).toBeLessThanOrEqual(viewport.width + 10) // small tolerance

        await expect(page.locator('body')).toBeVisible()
      })
    }
  }
})
