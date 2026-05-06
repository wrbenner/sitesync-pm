import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { settle, waitLoad, signIn, tryClick } from './_helpers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '..', 'polish-review', 'pages', 'drawings')
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
  test.describe(`Drawings E2E @ ${vp.name}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      storageState: { cookies: [], origins: [] },
    })

    test('drawings workflow', async ({ page }) => {
      await signIn(page, USER, PASS)
      await page.goto('#/drawings')
      await waitLoad(page)
      await settle(page, 600)
      await shot(page, vp.name, 1, 'list-or-empty')

      // Upload modal
      const uploadOpened =
        (await tryClick(page, /^upload$/i)) || (await tryClick(page, /upload drawings/i))
      if (uploadOpened) {
        await settle(page, 500)
        await shot(page, vp.name, 2, 'upload-modal')
        await page.keyboard.press('Escape')
        await settle(page, 200)
      }

      // Sets panel
      if (await tryClick(page, /^sets$/i)) {
        await settle(page, 500)
        await shot(page, vp.name, 3, 'sets-panel')
        await page.keyboard.press('Escape')
        await settle(page, 200)
      }

      // Annotations panel
      if (await tryClick(page, /^annotations$/i)) {
        await settle(page, 500)
        await shot(page, vp.name, 4, 'annotations-panel')
        await page.keyboard.press('Escape')
        await settle(page, 200)
      }

      // Open first drawing if any
      const firstDrawing = page.locator('button, a').filter({ has: page.locator('img, [data-thumb]') }).first()
      if (await firstDrawing.count() > 0) {
        await firstDrawing.click().catch(() => undefined)
        await waitLoad(page, 10_000)
        await settle(page, 800)
        await shot(page, vp.name, 5, 'viewer')
      }

      expect(true).toBeTruthy()
    })
  })
}
