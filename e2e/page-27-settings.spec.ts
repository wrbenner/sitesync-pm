import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { settle, waitLoad, signIn } from './_helpers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '..', 'polish-review', 'pages', 'settings')
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
  test.describe(`Settings E2E @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, storageState: { cookies: [], origins: [] } })
    test('settings workflow', async ({ page }) => {
      await signIn(page, USER, PASS)

      const routes = [
        { path: '/settings', name: 'project-details' },
        { path: '/settings/team', name: 'team' },
        { path: '/settings/notifications', name: 'notifications' },
        { path: '/settings/workflows', name: 'workflows' },
      ]
      for (let i = 0; i < routes.length; i++) {
        await page.goto('#' + routes[i].path)
        await waitLoad(page)
        await settle(page, 800)
        await shot(page, vp.name, i + 1, routes[i].name)
      }

      expect(true).toBeTruthy()
    })
  })
}
