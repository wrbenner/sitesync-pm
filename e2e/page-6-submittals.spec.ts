import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { settle, waitLoad, signIn, tryClick } from './_helpers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '..', 'polish-review', 'pages', 'submittals')
const USER = process.env.POLISH_USER!
const PASS = process.env.POLISH_PASS!

async function shot(page: import('@playwright/test').Page, viewport: string, n: number, name: string) {
  await page.screenshot({
    path: path.join(OUT_DIR, `${viewport}-${String(n).padStart(2, '0')}-${name}.png`),
    fullPage: true,
  }).catch(() => undefined)
}

const VIEWPORTS = [
  { name: 'iphone',  width: 393,  height: 852 },
  { name: 'ipad',    width: 1024, height: 1366 },
  { name: 'desktop', width: 1440, height: 900 },
] as const

for (const vp of VIEWPORTS) {
  test.describe(`Submittals E2E @ ${vp.name}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      storageState: { cookies: [], origins: [] },
    })

    test('submittals workflow', async ({ page }) => {
      await signIn(page, USER, PASS)
      await page.goto('#/submittals')
      await waitLoad(page)
      await settle(page, 600)
      await shot(page, vp.name, 1, 'list-or-empty')

      // New Submittal modal
      const opened =
        (await tryClick(page, /^new submittal$/i)) ||
        (await tryClick(page, /^create submittal$/i)) ||
        (await tryClick(page, /^create first submittal$/i))
      if (opened) {
        await settle(page, 500)
        await shot(page, vp.name, 2, 'new-submittal-modal')
        await page.keyboard.press('Escape')
        await settle(page, 200)
      }

      // Import from spec
      if (await tryClick(page, /import from spec/i)) {
        await settle(page, 500)
        await shot(page, vp.name, 3, 'import-from-spec')
        await page.keyboard.press('Escape')
        await settle(page, 200)
      }

      // Detail
      const firstLink = page.locator('a[href*="/submittals/"]').first()
      if (await firstLink.count() > 0) {
        await firstLink.click().catch(() => undefined)
        await waitLoad(page, 10_000)
        await settle(page, 500)
        await shot(page, vp.name, 4, 'detail')
      }

      expect(true).toBeTruthy()
    })
  })
}
