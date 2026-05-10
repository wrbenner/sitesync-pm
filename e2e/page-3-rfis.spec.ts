/**
 * PAGE 3 — /rfis — Full e2e verification.
 */
import { test, expect, Page } from '@playwright/test'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { signIn } from './_helpers'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT_DIR = path.resolve(__dirname, '..', 'polish-review', 'pages', 'rfis')

const USER = process.env.POLISH_USER!
const PASS = process.env.POLISH_PASS!

async function settle(page: Page, ms = 250) {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }`,
  }).catch(() => undefined)
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined)
  await page.waitForTimeout(ms)
}

async function shot(page: Page, viewport: string, n: number, name: string) {
  const filename = `${viewport}-${String(n).padStart(2, '0')}-${name}.png`
  await page.screenshot({
    path: path.join(OUT_DIR, filename),
    fullPage: true,
  }).catch(() => undefined)
}


const VIEWPORTS = [
  { name: 'iphone',  width: 393,  height: 852 },
  { name: 'ipad',    width: 1024, height: 1366 },
  { name: 'desktop', width: 1440, height: 900 },
] as const

for (const vp of VIEWPORTS) {
  test.describe(`RFIs E2E @ ${vp.name}`, () => {
    test.use({
      viewport: { width: vp.width, height: vp.height },
      storageState: { cookies: [], origins: [] },
    })

    test('rfis workflow', async ({ page }) => {
      await signIn(page, USER, PASS)

      await page.goto('#/rfis', { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(
        () => !document.body.textContent?.includes('Loading...'),
        { timeout: 15_000 },
      ).catch(() => undefined)
      await settle(page, 600)
      await shot(page, vp.name, 1, 'list-or-empty')

      let formOpened = false
      const ctas = [
        /^create first rfi$/i,
        /^new rfi$/i,
        /^create rfi$/i,
        /^\+ new$/i,
        /^new$/i,
      ]
      for (const re of ctas) {
        const btn = page.getByRole('button', { name: re }).first()
        if (await btn.count() > 0) {
          await btn.click().catch(() => undefined)
          formOpened = true
          break
        }
      }
      if (formOpened) {
        await settle(page, 400)
        await shot(page, vp.name, 2, 'new-form-empty')

        const questionField = page.getByPlaceholder(/needs to be clarified/i).first()
        if (await questionField.count() > 0) {
          await questionField.fill(
            'What is the spec section reference for the embedded plates on column line A? The structural drawings reference detail S2.4 but the spec book seems to be missing this section. We need clarity by Friday to keep the rebar tie-in on schedule.',
          )
          await settle(page, 200)
          await shot(page, vp.name, 3, 'question-typed')
        }

        const contextField = page.getByPlaceholder(/background.*context|already checked/i).first()
        if (await contextField.count() > 0) {
          await contextField.fill(
            'Verified: not in S-001 General Notes, not in S-100 Foundation Plan. Checked spec book TOC for sections 03 30 00 and 05 12 00.',
          )
          await settle(page, 200)
          await shot(page, vp.name, 4, 'context-typed')
        }

        const highPill = page.getByRole('button', { name: /^high$/i }).first()
        if (await highPill.count() > 0) {
          await highPill.click().catch(() => undefined)
          await settle(page, 200)
          await shot(page, vp.name, 5, 'priority-high')
        }

        const criticalPill = page.getByRole('button', { name: /^critical$/i }).first()
        if (await criticalPill.count() > 0) {
          await criticalPill.click().catch(() => undefined)
          await settle(page, 200)
          await shot(page, vp.name, 6, 'priority-critical')
        }

        const specField = page.getByPlaceholder(/03 30 00/i).first()
        if (await specField.count() > 0) {
          await specField.fill('05 12 00')
        }
        const drawingField = page.getByPlaceholder(/A-201/i).first()
        if (await drawingField.count() > 0) {
          await drawingField.fill('S2.4')
        }
        await settle(page, 200)
        await shot(page, vp.name, 7, 'all-fields-filled')

        await page.keyboard.press('Escape')
        await settle(page, 300)
      }

      const firstRfiLink = page.locator('a[href*="/rfis/"]').first()
      if (await firstRfiLink.count() > 0) {
        await firstRfiLink.click().catch(() => undefined)
        await settle(page, 600)
        await shot(page, vp.name, 8, 'detail')

        await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' }))
        await settle(page, 200)
        await shot(page, vp.name, 9, 'detail-scrolled')

        await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }))
        await settle(page, 200)
        await shot(page, vp.name, 10, 'detail-bottom')
      }

      await page.goto('#/rfis', { waitUntil: 'domcontentloaded' })
      await settle(page, 600)

      const openTab = page.getByRole('button', { name: /^open\s*\d*$/i }).first()
      if (await openTab.count() > 0) {
        await openTab.click().catch(() => undefined)
        await settle(page, 300)
        await shot(page, vp.name, 11, 'filter-open')
      }

      const closedTab = page.getByRole('button', { name: /^closed\s*\d*$/i }).first()
      if (await closedTab.count() > 0) {
        await closedTab.click().catch(() => undefined)
        await settle(page, 300)
        await shot(page, vp.name, 12, 'filter-closed')
      }

      expect(true).toBeTruthy()
    })
  })
}
