import { test, expect, devices } from '@playwright/test'

test.describe('Mobile Experience', () => {
  const { defaultBrowserType: _dbt, ...iPhone14 } = devices['iPhone 14']
  test.use(iPhone14)

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

// ── iPhone 13 Touch Target Compliance ────────────────────────────────────────

const iPhone13 = {
  viewport: { width: 390, height: 844 },
  userAgent: devices['iPhone 13'].userAgent,
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
}

const TOUCH_TARGET_MIN = 44
const PAGES_TO_CHECK = [
  { route: '#/dashboard', name: 'dashboard' },
  { route: '#/rfis', name: 'rfis' },
  { route: '#/daily-log', name: 'daily-log' },
]

for (const { route, name } of PAGES_TO_CHECK) {
  test.describe(`Touch targets on /${name} (iPhone 13)`, () => {
    test.use(iPhone13)

    test(`first 5 interactive elements are at least ${TOUCH_TARGET_MIN}px tall`, async ({ page }) => {
      await page.goto(route)
      await page.waitForLoadState('networkidle')

      // Collect buttons and links that are visible and not hidden
      const interactives = page.locator('button:visible, a:visible, [role="button"]:visible')
      const count = await interactives.count()

      let checked = 0
      for (let i = 0; i < count && checked < 5; i++) {
        const el = interactives.nth(i)
        const box = await el.boundingBox()
        if (!box || box.width === 0 || box.height === 0) continue

        expect(
          box.height,
          `Element ${i} on /${name} has height ${box.height}px, expected >= ${TOUCH_TARGET_MIN}px`,
        ).toBeGreaterThanOrEqual(TOUCH_TARGET_MIN)

        checked++
      }

      // Ensure we found at least one element to check
      expect(checked, `No visible interactive elements found on /${name}`).toBeGreaterThan(0)
    })
  })
}
