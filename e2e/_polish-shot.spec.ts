import { test } from '@playwright/test'
import * as path from 'path'

const STATE = path.resolve(process.cwd(), 'e2e/.auth/state.json')
test.use({ storageState: STATE })

test('authenticated polish shot', async ({ page }) => {
  test.setTimeout(60_000)
  await page.goto('http://localhost:5173/sitesync-pm/', { waitUntil: 'load' })
  await page.waitForTimeout(2000)

  for (const [route, name] of [['/daily-log','daily-log'], ['/budget','budget'], ['/punch-list','punch-list'], ['/safety','safety']] as const) {
    await page.goto('http://localhost:5173/sitesync-pm/#' + route, { waitUntil: 'load' })
    await page.waitForTimeout(2000)
    await page.screenshot({ path: '/tmp/polish-' + name + '.png', fullPage: false })
  }
})
