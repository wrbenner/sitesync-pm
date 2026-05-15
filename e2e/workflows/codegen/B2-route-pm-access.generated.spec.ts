/**
 * B.2 — Route × project_manager access matrix (generated).
 *
 * Third slice of the 3,120-cell route × persona × viewport batch.
 * project_manager × 104 routes × 1 viewport = +104 cells.
 *
 * --- Credentials ---
 *
 * B2_USER_PROJECT_MANAGER / B2_PASS_PROJECT_MANAGER. Suite-skip when unset.
 *
 * --- Per-cell assertion ---
 *
 * "Resolves cleanly" stance (same as iter 14 viewer slice):
 *   - No TypeError/ReferenceError in console
 *   - Body has non-empty text content
 *   - Either landed on the requested route OR redirected to a known
 *     guard route (login/onboarding/dashboard/day/etc.)
 *
 * Per-route role policy is asserted in B.2 CRUD specs (iter 9-12);
 * this batch is about robustness — no crashes, no blank pages.
 */
import { test, expect, type ConsoleMessage, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const REAL_BACKEND = process.env.E2E_REAL_BACKEND === 'true'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const USER = process.env.B2_USER_PROJECT_MANAGER ?? ''
const PASS = process.env.B2_PASS_PROJECT_MANAGER ?? ''

test.skip(!REAL_BACKEND, 'Stage-env only — set E2E_REAL_BACKEND=true')
test.skip(!USER || !PASS, 'Credentials not provisioned: set B2_USER_PROJECT_MANAGER and B2_PASS_PROJECT_MANAGER in CI')

interface RouteRow {
  path: string
  isProtected: boolean
  isPublic: boolean
}
const inventory = JSON.parse(
  readFileSync(resolve(__dirname, '../../../ops/coverage/routes.json'), 'utf-8'),
) as { routes: RouteRow[] }

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

test.describe('B.2 — Route × project_manager access matrix (generated)', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  for (const route of inventory.routes) {
    test(`project_manager — ${route.path} resolves`, async ({ page }) => {
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
        `project_manager visiting ${route.path} hit JS error:\n${consoleErrors.join('\n')}`,
      ).toHaveLength(0)

      expect(
        bodyText.trim().length,
        `project_manager visit to ${route.path} produced empty body (currentHash=${currentHash})`,
      ).toBeGreaterThan(0)

      const landedOnTarget = currentHash.startsWith(`#${route.path}`)
      const onKnownGuard = /^#\/(login|signup|verify-pending|onboarding|terms|privacy|dashboard|day)(\/|$)/.test(currentHash)
      const resolved = landedOnTarget || onKnownGuard
      expect(
        resolved,
        `project_manager visit to ${route.path} ended on unknown route ${currentHash}`,
      ).toBe(true)
    })
  }
})
