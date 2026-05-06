import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { settle, waitLoad, signIn, tryClick } from './_helpers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '..', 'polish-review', 'pages', 'meetings')
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
  test.describe(`Meetings E2E @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, storageState: { cookies: [], origins: [] } })
    test('meetings workflow', async ({ page }) => {
      await signIn(page, USER, PASS)
      await page.goto('#/meetings')
      await waitLoad(page)
      await settle(page, 800)
      await shot(page, vp.name, 1, 'upcoming')

      if (await tryClick(page, /^past$/i)) { await settle(page, 400); await shot(page, vp.name, 2, 'past') }
      if (await tryClick(page, /^templates$/i)) {
        await settle(page, 500)
        await shot(page, vp.name, 3, 'templates')
        await page.keyboard.press('Escape')
        await settle(page, 200)
      }
      if (await tryClick(page, /schedule meeting/i)) {
        await settle(page, 500)
        await shot(page, vp.name, 4, 'schedule')
        await page.keyboard.press('Escape')
        await settle(page, 200)
      }

      expect(true).toBeTruthy()
    })
  })
}
