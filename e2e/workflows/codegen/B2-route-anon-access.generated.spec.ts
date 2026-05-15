/**
 * B.2 — Route × anon access matrix (generated).
 *
 * First slice of the route × persona × viewport matrix (3,120 cells total
 * per MASTER_MATRIX). This file covers the anon "persona" — what unsigned
 * users see when they hit each of the 104 routes:
 *
 *   - isPublic route → page must render (any visible content)
 *   - isProtected route → must redirect to /login (or signup/verify gate)
 *
 * Coverage delta: +104 cells (anon × 104 routes × 1 viewport — desktop default).
 *
 * --- No credentials needed ---
 *
 * Anon = no signin. Suite-level skip when E2E_REAL_BACKEND != true.
 *
 * --- Per-cell assertion ---
 *
 * For public routes:
 *   - Page renders without crashing (no TypeError/ReferenceError in console)
 *   - Body has non-empty text content (not a blank page)
 *
 * For protected routes:
 *   - Navigated URL ended on /login (or /signup, /verify-pending, /onboarding)
 *   - OR an auth-gate UI is visible ("Sign in", "Log in", etc.)
 *
 * False-positives are possible if a protected route renders its skeleton
 * before the guard redirect fires — we wait 1.5s for the SPA to settle.
 */
import { test, expect, type ConsoleMessage } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const REAL_BACKEND = process.env.E2E_REAL_BACKEND === 'true'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'

test.skip(!REAL_BACKEND, 'Stage-env only — set E2E_REAL_BACKEND=true')

interface RouteRow {
  path: string
  isProtected: boolean
  isPublic: boolean
}
const inventory = JSON.parse(
  readFileSync(resolve(__dirname, '../../../ops/coverage/routes.json'), 'utf-8'),
) as { routes: RouteRow[] }

test.describe('B.2 — Route × anon access matrix (generated)', () => {
  for (const route of inventory.routes) {
    const expectation = route.isPublic ? 'allow' : 'redirect'
    test(`anon — ${route.path} (${expectation})`, async ({ page }) => {
      const consoleErrors: string[] = []
      page.on('console', (msg: ConsoleMessage) => {
        if (msg.type() === 'error' && /TypeError|ReferenceError/i.test(msg.text())) {
          consoleErrors.push(msg.text())
        }
      })

      await page.goto(`${BASE_URL}/#${route.path}`)
      await page
        .waitForFunction(() => !/Loading…|Loading\.\.\./.test(document.body.textContent ?? ''), { timeout: 15_000 })
        .catch(() => undefined)
      // Allow SPA route-guard redirect to settle
      await page.waitForTimeout(1_500)

      const currentHash = await page.evaluate(() => window.location.hash)
      const bodyText = (await page.locator('body').innerText().catch(() => '')) ?? ''

      if (route.isPublic) {
        // Public: page should render with some text content; no JS crash.
        expect(
          consoleErrors,
          `JS crash on anon visit to ${route.path}:\n${consoleErrors.join('\n')}`,
        ).toHaveLength(0)
        expect(
          bodyText.trim().length,
          `anon visit to public ${route.path} produced empty body (currentHash=${currentHash})`,
        ).toBeGreaterThan(0)
      } else {
        // Protected: expect redirect to an auth-gate route OR visible auth-gate UI.
        const onAuthGateRoute = /^#\/(login|signup|verify-pending|onboarding|terms|privacy)(\/|$)/.test(currentHash)
        const authGateUiVisible = /\bsign in\b|\blog in\b|\bcreate account\b|\bverify (your )?email\b/i.test(bodyText)
        const guarded = onAuthGateRoute || authGateUiVisible
        expect(
          guarded,
          `anon visit to protected ${route.path} was NOT redirected: ` +
            `currentHash=${currentHash} authGateUiVisible=${authGateUiVisible}`,
        ).toBe(true)
      }
    })
  }
})
