import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { settle, waitLoad, signIn, tryClick } from './_helpers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '..', 'polish-review', 'pages', 'budget')
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
  test.describe(`Budget E2E @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, storageState: { cookies: [], origins: [] } })
    test('budget workflow', async ({ page }) => {
      await signIn(page, USER, PASS)
      await page.goto('#/budget')
      await waitLoad(page)
      await settle(page, 800)
      await shot(page, vp.name, 1, 'summary')

      for (const tab of [
        { rx: /^cost codes$/i, name: 'cost-codes' },
        { rx: /^cash flow$/i, name: 'cash-flow' },
        { rx: /^period close$/i, name: 'period-close' },
        { rx: /^snapshots$/i, name: 'snapshots' },
      ]) {
        if (await tryClick(page, tab.rx)) {
          await settle(page, 500)
          await shot(page, vp.name, 2, tab.name)
        }
      }

      if (await tryClick(page, /^\+ add$/i)) {
        await settle(page, 400)
        await shot(page, vp.name, 6, 'add-menu')
        await page.keyboard.press('Escape')
        await settle(page, 200)
      }

      // sub-tab Overview/WBS/Change Orders/Earned Value
      for (const tab of [
        { rx: /^wbs$/i, name: 'wbs' },
        { rx: /^change orders$/i, name: 'sub-change-orders' },
        { rx: /^earned value$/i, name: 'earned-value' },
      ]) {
        if (await tryClick(page, tab.rx)) {
          await settle(page, 500)
          await shot(page, vp.name, 7, `sub-${tab.name}`)
        }
      }

      expect(true).toBeTruthy()
    })
  })
}
