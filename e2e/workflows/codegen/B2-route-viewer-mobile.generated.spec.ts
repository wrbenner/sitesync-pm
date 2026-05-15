/**
 * B.2 — Route × viewer × mobile viewport (generated).
 *
 * Mobile counterpart to iter 14's desktop viewer spec. 104 routes × viewer
 * × mobile viewport (375×667) = +104 cells.
 *
 * --- Credentials ---
 *
 * B2_USER_VIEWER / B2_PASS_VIEWER. Suite-skip when unset.
 *
 * Same "resolves cleanly" stance as iter 14. Mobile viewport catches
 * layout/overflow bugs that desktop hides.
 */
import { test, expect, type ConsoleMessage, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const REAL_BACKEND = process.env.E2E_REAL_BACKEND === 'true'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const USER = process.env.B2_USER_VIEWER ?? ''
const PASS = process.env.B2_PASS_VIEWER ?? ''

test.skip(!REAL_BACKEND, 'Stage-env only — set E2E_REAL_BACKEND=true')
test.skip(!USER || !PASS, 'Credentials not provisioned: set B2_USER_VIEWER and B2_PASS_VIEWER in CI')

interface RouteRow {
  path: string
  isProtected: boolean
  isPublic: boolean
}
const inventory = JSON.parse(
  readFileSync(resolve(__dirname, '../../../ops/coverage/routes.json'), 'utf-8'),
) as { routes: RouteRow[] }

const MOBILE_VIEWPORT = { width: 375, height: 667 }

async function signIn(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/#/login`)
  await page.waitForTimeout(400)
  await page
    .getByRole('button', { name: /sign in with password/i })
    .first()
    .click()
    .catch(() => undefined)
  await page.waitForTimeout(200)
  await page.getByLabel('Email', { exact: true }).fill(USER)
  await page.getByLabel('Password', { exact: true }).fill(PASS)
  await page.getByLabel('Password', { exact: true }).press('Enter')
  await page.waitForURL(/#\/(dashboard|onboarding|profile|day|$)/, { timeout: 20_000 })
  await page.waitForTimeout(1_200)
}

test.describe('B.2 — Route × viewer × mobile viewport (generated)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
    await signIn(page)
  })

  for (const route of inventory.routes) {
    test(`viewer mobile — ${route.path} resolves`, async ({ page }) => {
      const consoleErrors: string[] = []
      page.on('console', (msg: ConsoleMessage) => {
        if (msg.type() === 'error' && /TypeError|ReferenceError/i.test(msg.text())) {
          consoleErrors.push(msg.text())
        }
      })

      await page.goto(`${BASE_URL}/#${route.path}`)
      await page
        .waitForFunction(() => !/Loading…|Loading\.\.\./.test(document.body.textContent ?? ''), { timeout: 20_000 })
        .catch(() => undefined)
      await page.waitForTimeout(1_500)

      const currentHash = await page.evaluate(() => window.location.hash)
      const bodyText = (await page.locator('body').innerText().catch(() => '')) ?? ''

      expect(
        consoleErrors,
        `viewer mobile visiting ${route.path} hit JS error:\n${consoleErrors.join('\n')}`,
      ).toHaveLength(0)

      expect(
        bodyText.trim().length,
        `viewer mobile visit to ${route.path} produced empty body (currentHash=${currentHash})`,
      ).toBeGreaterThan(0)

      const landedOnTarget = currentHash.startsWith(`#${route.path}`)
      const onKnownGuard = /^#\/(login|signup|verify-pending|onboarding|terms|privacy|dashboard|day)(\/|$)/.test(currentHash)
      const resolved = landedOnTarget || onKnownGuard
      expect(
        resolved,
        `viewer mobile visit to ${route.path} ended on unknown route ${currentHash}`,
      ).toBe(true)
    })
  }
})
