import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { settle, waitLoad, signIn, tryClick } from './_helpers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '..', 'polish-review', 'pages', 'profile')
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
  test.describe(`Profile E2E @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, storageState: { cookies: [], origins: [] } })
    test('profile workflow', async ({ page }) => {
      await signIn(page, USER, PASS)
      await page.goto('#/profile')
      await waitLoad(page)
      await settle(page, 800)
      await shot(page, vp.name, 1, 'overview')

      // Scroll to danger zone
      await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }))
      await settle(page, 200)
      await shot(page, vp.name, 2, 'scrolled-to-danger')

      if (await tryClick(page, /^delete account$/i)) {
        await settle(page, 400)
        await shot(page, vp.name, 3, 'delete-confirm-empty')

        // Type the confirm phrase
        await page.keyboard.type('DELETE MY ACCOUNT').catch(() => undefined)
        await settle(page, 200)
        await shot(page, vp.name, 4, 'delete-confirm-typed')
        await page.keyboard.press('Escape').catch(() => undefined)
        await settle(page, 200)
      }

      expect(true).toBeTruthy()
    })
  })
}
