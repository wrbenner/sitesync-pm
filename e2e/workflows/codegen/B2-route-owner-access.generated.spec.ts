/**
 * B.2 — Route × owner access matrix (generated).
 *
 * Fourth slice of the 3,120-cell route × persona × viewport batch.
 * owner × 104 routes × 1 viewport = +104 cells.
 *
 * Owner is the top-tier role; expected to render all routes successfully.
 * A crash here is a high-priority bug — owner has full access by design.
 *
 * --- Credentials ---
 *
 * B2_USER_OWNER / B2_PASS_OWNER. Suite-skip when unset.
 *
 * --- Per-cell assertion ---
 *
 * Same "resolves cleanly" stance as iter 13/14/15. For owner specifically
 * a redirect to a non-target route is suspicious (owner shouldn't be
 * denied access to anything) — but still allowed since onboarding flows
 * may redirect to /day or /dashboard until project context is set.
 */
import { test, expect, type ConsoleMessage, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const REAL_BACKEND = process.env.E2E_REAL_BACKEND === 'true'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const USER = process.env.B2_USER_OWNER ?? ''
const PASS = process.env.B2_PASS_OWNER ?? ''

test.skip(!REAL_BACKEND, 'Stage-env only — set E2E_REAL_BACKEND=true')
test.skip(!USER || !PASS, 'Credentials not provisioned: set B2_USER_OWNER and B2_PASS_OWNER in CI')

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

test.describe('B.2 — Route × owner access matrix (generated)', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  for (const route of inventory.routes) {
    test(`owner — ${route.path} resolves`, async ({ page }) => {
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
        `owner visiting ${route.path} hit JS error:\n${consoleErrors.join('\n')}`,
      ).toHaveLength(0)

      expect(
        bodyText.trim().length,
        `owner visit to ${route.path} produced empty body (currentHash=${currentHash})`,
      ).toBeGreaterThan(0)

      const landedOnTarget = currentHash.startsWith(`#${route.path}`)
      const onKnownGuard = /^#\/(login|signup|verify-pending|onboarding|terms|privacy|dashboard|day)(\/|$)/.test(currentHash)
      const resolved = landedOnTarget || onKnownGuard
      expect(
        resolved,
        `owner visit to ${route.path} ended on unknown route ${currentHash}`,
      ).toBe(true)
    })
  }
})
