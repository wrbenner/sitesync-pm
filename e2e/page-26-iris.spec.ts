import { test, expect } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { settle, waitLoad, signIn, tryClick } from './_helpers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '..', 'polish-review', 'pages', 'iris')
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
  test.describe(`Iris E2E @ ${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height }, storageState: { cookies: [], origins: [] } })
    test('iris workflow', async ({ page }) => {
      await signIn(page, USER, PASS)
      await page.goto('#/ai')
      await waitLoad(page)
      await settle(page, 800)
      await shot(page, vp.name, 1, 'empty-with-prompts')

      const prompt = page.getByRole('button', { name: /budget analysis/i }).first()
      if (await prompt.count() > 0) {
        // Clicking the suggested prompt only populates the input — the
        // captures previously stopped here and 02/03 looked identical.
        // Submit the message so streaming actually begins, then wait for
        // the assistant message to appear before each shot.
        await prompt.click().catch(() => undefined)
        await page.keyboard.press('Enter').catch(() => undefined)
        await page
          .waitForSelector('[data-message-role="assistant"], [role="article"][data-streaming="true"]', { timeout: 6_000 })
          .catch(() => undefined)
        await settle(page, 600)
        await shot(page, vp.name, 2, 'streaming')
        await page
          .waitForFunction(
            () => !document.querySelector('[data-streaming="true"]'),
            { timeout: 12_000, polling: 300 },
          )
          .catch(() => undefined)
        await settle(page, 600)
        await shot(page, vp.name, 3, 'response-complete')
      }

      if (await tryClick(page, /^approvals$/i)) { await settle(page, 400); await shot(page, vp.name, 4, 'approvals'); await page.keyboard.press('Escape'); await settle(page, 200) }
      if (await tryClick(page, /^history$/i)) { await settle(page, 400); await shot(page, vp.name, 5, 'history'); await page.keyboard.press('Escape'); await settle(page, 200) }

      expect(true).toBeTruthy()
    })
  })
}
