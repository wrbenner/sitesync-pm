/**
 * B.2 — Route × viewer access matrix (generated).
 *
 * Second slice of the 3,120-cell route × persona × viewport batch.
 * Iter 13 covered anon; this file covers the viewer persona — an
 * authenticated but minimally-privileged role. Coverage: viewer × 104
 * routes × 1 viewport = +104 cells.
 *
 * --- Credentials ---
 *
 * Reuses iter 9's env-var convention:
 *   B2_USER_VIEWER, B2_PASS_VIEWER
 * Skips with a clear note if either is unset.
 *
 * --- Per-cell assertion ---
 *
 * The goal is robustness, not policy enforcement: catch routes that
 * CRASH for viewer, redirect oddly, or render an empty page. The
 * per-route role expectation lives in the dedicated B.2 CRUD specs
 * (iter 9-12) — here we only assert "the page resolves cleanly":
 *   - No TypeError/ReferenceError in console
 *   - Body has non-empty text content (or landed on an auth gate)
 *   - Either landed on the requested route OR redirected to a known
 *     auth-gate / permission-gate route — both are valid resolutions
 *
 * False-positives: a fully-blank page on a route where viewer is
 * specifically allowed signals a real bug. Skip with a clear console
 * error tail in the failure message.
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

test.describe('B.2 — Route × viewer access matrix (generated)', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page)
  })

  for (const route of inventory.routes) {
    test(`viewer — ${route.path} resolves`, async ({ page }) => {
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

      // No JS crash regardless of where we ended up.
      expect(
        consoleErrors,
        `viewer visiting ${route.path} hit JS error:\n${consoleErrors.join('\n')}`,
      ).toHaveLength(0)

      // Body should have content. Either landed on the requested route,
      // OR landed on a guard route (login/onboarding/permission-denied
      // shell). Empty body = real bug.
      expect(
        bodyText.trim().length,
        `viewer visit to ${route.path} produced empty body (currentHash=${currentHash})`,
      ).toBeGreaterThan(0)

      // Soft check: log if redirected somewhere unexpected, but don't
      // fail — viewer is allowed to be redirected away from many routes.
      const landedOnTarget = currentHash.startsWith(`#${route.path}`)
      const onKnownGuard = /^#\/(login|signup|verify-pending|onboarding|terms|privacy|dashboard|day)(\/|$)/.test(currentHash)
      const resolved = landedOnTarget || onKnownGuard
      expect(
        resolved,
        `viewer visit to ${route.path} ended on unknown route ${currentHash}`,
      ).toBe(true)
    })
  }
})
