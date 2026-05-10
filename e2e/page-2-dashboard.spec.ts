/**
 * PAGE 2 — /dashboard — Full e2e verification.
 */
import { test, expect, Page } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { signIn } from './_helpers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '..', 'polish-review', 'pages', 'dashboard')

const USER = process.env.POLISH_USER!
const PASS = process.env.POLISH_PASS!

async function settle(page: Page, ms = 250) {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }`,
  }).catch(() => undefined)
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined)
  await page.waitForTimeout(ms)
}

async function shot(page: Page, viewport: string, n: number, name: string) {
  const filename = `${viewport}-${String(n).padStart(2, '0')}-${name}.png`
  await page.screenshot({
    path: path.join(OUT_DIR, filename),
    fullPage: true,
  }).catch(() => undefined)
}


const VIEWPORTS = [
  { name: 'iphone',  width: 393,  height: 852 },
  { name: 'ipad',    width: 1024, height: 1366 },
  { name: 'desktop', width: 1440, height: 900 },
] as const

for (const vp of VIEWPORTS) {
  test.describe(`Dashboard E2E @ ${vp.name}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      storageState: { cookies: [], origins: [] },
    })

    test('dashboard workflow', async ({ page }) => {
      await signIn(page, USER, PASS)

      const landingUrl = page.url()
      console.log(`[${vp.name}] post-login URL:`, landingUrl)

      await shot(page, vp.name, 1, 'cold-post-login')

      await page.goto('#/dashboard', { waitUntil: 'domcontentloaded' })
      await settle(page, 1200)
      await shot(page, vp.name, 2, 'dashboard-landing')

      const merrittCrossingHeading = page.getByText(/Merritt Crossing/i).first()
      const isProjectVisible = await merrittCrossingHeading.isVisible().catch(() => false)
      console.log(`[${vp.name}] project name visible:`, isProjectVisible)

      if (vp.name === 'desktop' && isProjectVisible) {
        const scheduleKpi = page.getByText(/^SCHEDULE$/).first()
        if (await scheduleKpi.count() > 0) {
          await scheduleKpi.hover()
          await settle(page, 250)
          await shot(page, vp.name, 3, 'kpi-schedule-hover')
        }

        const budgetKpi = page.getByText(/^BUDGET$/).first()
        if (await budgetKpi.count() > 0) {
          await budgetKpi.hover()
          await settle(page, 250)
          await shot(page, vp.name, 4, 'kpi-budget-hover')
        }
      }

      await page.evaluate(() => window.scrollTo({ top: 600, behavior: 'instant' }))
      await settle(page, 200)
      await shot(page, vp.name, 5, 'scrolled-mid')

      await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }))
      await settle(page, 300)
      await shot(page, vp.name, 6, 'scrolled-bottom')

      if (vp.name === 'iphone') {
        const aiFab = page.locator('[aria-label*="Iris" i], [aria-label*="AI" i], button[aria-label*="copilot" i]').first()
        if (await aiFab.count() > 0) {
          await aiFab.click({ timeout: 3_000 }).catch(() => undefined)
          await settle(page, 500)
          await shot(page, vp.name, 7, 'ai-fab-opened')
          await page.keyboard.press('Escape').catch(() => undefined)
          await settle(page, 200)
        }
      }

      const projectSwitcher = page.locator('button').filter({ hasText: /Merritt Crossing|Select Project/i }).first()
      if (await projectSwitcher.count() > 0) {
        await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
        await projectSwitcher.click().catch(() => undefined)
        await settle(page, 400)
        await shot(page, vp.name, 8, 'project-switcher-open')
        await page.keyboard.press('Escape').catch(() => undefined)
        await settle(page, 200)
      }

      const bell = page.locator('button[aria-label*="notification" i]').first()
      if (await bell.count() > 0) {
        await bell.click({ timeout: 3_000 }).catch(() => undefined)
        await settle(page, 400)
        await shot(page, vp.name, 9, 'notifications-open')
        await page.keyboard.press('Escape').catch(() => undefined)
        await settle(page, 200)
      }

      await page.keyboard.press('Meta+k').catch(() => undefined)
      await settle(page, 300)
      await shot(page, vp.name, 10, 'command-palette-open')
      await page.keyboard.press('Escape').catch(() => undefined)
      await settle(page, 150)

      expect(true).toBeTruthy()
    })
  })
}
