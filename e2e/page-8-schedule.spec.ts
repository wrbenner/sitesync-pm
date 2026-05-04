import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { settle, waitLoad, signIn, tryClick } from './_helpers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '..', 'polish-review', 'pages', 'schedule')
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
  test.describe(`Schedule E2E @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, storageState: { cookies: [], origins: [] } })
    test('schedule workflow', async ({ page }) => {
      await signIn(page, USER, PASS)
      await page.goto('#/schedule')
      await waitLoad(page)
      await settle(page, 1000)
      await shot(page, vp.name, 1, 'gantt-default')

      if (await tryClick(page, /look-ahead/i)) { await settle(page, 600); await shot(page, vp.name, 2, 'look-ahead') }
      if (await tryClick(page, /^list$/i)) { await settle(page, 600); await shot(page, vp.name, 3, 'list-view') }
      if (await tryClick(page, /^timeline$/i)) { await settle(page, 600); await shot(page, vp.name, 4, 'timeline') }
      if (await tryClick(page, /what-if/i)) { await settle(page, 400); await shot(page, vp.name, 5, 'what-if'); await page.keyboard.press('Escape'); await settle(page, 200) }
      if (await tryClick(page, /^import$/i)) { await settle(page, 500); await shot(page, vp.name, 6, 'import-wizard'); await page.keyboard.press('Escape'); await settle(page, 200) }
      if (await tryClick(page, /^expand$/i)) { await settle(page, 400); await shot(page, vp.name, 7, 'logic-quality-expanded') }
      expect(true).toBeTruthy()
    })
  })
}
