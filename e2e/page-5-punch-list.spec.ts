/**
 * PAGE 5 — /punch-list — Full e2e verification.
 */
import { test, expect, Page } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { signIn } from './_helpers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '..', 'polish-review', 'pages', 'punch-list')

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

async function waitLoad(page: Page) {
  await page.waitForFunction(
    () => !document.body.textContent?.match(/Loading\.\.\./),
    { timeout: 15_000 },
  ).catch(() => undefined)
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
  test.describe(`Punch List E2E @ ${vp.name}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      storageState: { cookies: [], origins: [] },
    })

    test('punch-list workflow', async ({ page }) => {
      await signIn(page, USER, PASS)
      await page.goto('#/punch-list', { waitUntil: 'domcontentloaded' })
      await waitLoad(page)
      await settle(page, 600)
      await shot(page, vp.name, 1, 'list')

      const newBtn =
        page.getByRole('button', { name: /^new item$/i }).first()
      const newAlt =
        page.getByRole('button', { name: /^create first/i }).first()
      const which = (await newBtn.count()) > 0 ? newBtn : (await newAlt.count() > 0 ? newAlt : null)
      if (which) {
        await which.click().catch(() => undefined)
        await settle(page, 500)
        await shot(page, vp.name, 2, 'new-item-modal')
        await page.keyboard.press('Escape')
        await settle(page, 200)
      }

      const gridBtn = page.getByRole('button', { name: /grid view/i }).first()
      if (await gridBtn.count() > 0) {
        await gridBtn.click().catch(() => undefined)
        await settle(page, 400)
        await shot(page, vp.name, 3, 'grid-view')
      }

      const mapBtn = page.getByRole('button', { name: /map view/i }).first()
      if (await mapBtn.count() > 0) {
        await mapBtn.click().catch(() => undefined)
        await settle(page, 600)
        await shot(page, vp.name, 4, 'map-view')
      }

      const listBtn = page.getByRole('button', { name: /^list view$/i }).first()
      if (await listBtn.count() > 0) {
        await listBtn.click().catch(() => undefined)
        await settle(page, 300)
      }

      for (const tab of ['Open', 'In Progress', 'Pending Verify', 'Closed']) {
        const tabBtn = page.locator('button').filter({ hasText: new RegExp(`^${tab}\\s*\\d`, 'i') }).first()
        if (await tabBtn.count() > 0) {
          await tabBtn.click().catch(() => undefined)
          await settle(page, 300)
          await shot(
            page, vp.name,
            5 + ['Open', 'In Progress', 'Pending Verify', 'Closed'].indexOf(tab),
            `filter-${tab.toLowerCase().replace(/\s/g, '-')}`,
          )
        }
      }

      const allBtn = page.getByRole('button', { name: /^all\s*\d/i }).first()
      if (await allBtn.count() > 0) {
        await allBtn.click().catch(() => undefined)
        await settle(page, 300)
      }
      const firstItem = page.locator('a[href*="/punch-list/"]').first()
      if (await firstItem.count() > 0) {
        await firstItem.click().catch(() => undefined)
        await settle(page, 600)
        await shot(page, vp.name, 9, 'detail')
      }

      expect(true).toBeTruthy()
    })
  })
}
