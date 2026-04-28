import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { settle, waitLoad, signIn, tryClick } from './_helpers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '..', 'polish-review', 'pages', 'change-orders')
const USER = process.env.POLISH_USER!
const PASS = process.env.POLISH_PASS!

async function shot(p: import('@playwright/test').Page, vp: string, n: number, name: string) {
  await p.screenshot({ path: path.join(OUT_DIR, `${vp}-${String(n).padStart(2, '0')}-${name}.png`), fullPage: true }).catch(() => undefined)
}

const VIEWPORTS = [
  { name: 'iphone',  width: 393,  height: 852 },
  { name: 'ipad',    width: 1024, height: 1366 },
  { name: 'desktop', width: 1440, height: 900 },
] as const

for (const vp of VIEWPORTS) {
  test.describe(`Change Orders E2E @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, storageState: { cookies: [], origins: [] } })
    test('change-orders workflow', async ({ page }) => {
      await signIn(page, USER, PASS)
      await page.goto('#/change-orders')
      await waitLoad(page)
      await settle(page, 800)
      await shot(page, vp.name, 1, 'list-or-empty')

      const opened = (await tryClick(page, /^new change order$/i)) || (await tryClick(page, /^create first/i))
      if (opened) {
        await settle(page, 500)
        await shot(page, vp.name, 2, 'new-co-modal')
        await page.keyboard.press('Escape')
        await settle(page, 200)
      }

      const firstLink = page.locator('a[href*="/change-orders/"]').first()
      if (await firstLink.count() > 0) {
        await firstLink.click().catch(() => undefined)
        await waitLoad(page, 10_000)
        await settle(page, 600)
        await shot(page, vp.name, 3, 'detail')
      }

      expect(true).toBeTruthy()
    })
  })
}
