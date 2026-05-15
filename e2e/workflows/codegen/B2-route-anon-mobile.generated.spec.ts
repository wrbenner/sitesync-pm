/**
 * B.2 — Route × anon × mobile viewport (generated).
 *
 * Mobile counterpart to iter 13's `B2-route-anon-access.generated.spec.ts`
 * (which runs at default desktop viewport). Pairs with iter 13 to give
 * anon coverage across both viewports.
 *
 * anon × 104 routes × mobile viewport (375×667) = +104 cells.
 *
 * --- Per-cell assertion ---
 *
 * Same allow/redirect logic as iter 13 (no signin):
 *   - isPublic: body non-empty + no JS crash
 *   - isProtected: redirect to known auth-gate route OR auth-gate UI text
 *
 * Mobile-specific gotchas:
 *   - Some routes show different layouts at <768px (collapsed nav)
 *   - "Sign in" CTA may live in a hamburger menu rather than top bar
 *     → the body-text regex still matches if rendered server-side
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

const MOBILE_VIEWPORT = { width: 375, height: 667 }

test.describe('B.2 — Route × anon × mobile viewport (generated)', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT)
  })

  for (const route of inventory.routes) {
    const expectation = route.isPublic ? 'allow' : 'redirect'
    test(`anon mobile — ${route.path} (${expectation})`, async ({ page }) => {
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
      await page.waitForTimeout(1_500)

      const currentHash = await page.evaluate(() => window.location.hash)
      const bodyText = (await page.locator('body').innerText().catch(() => '')) ?? ''

      if (route.isPublic) {
        expect(
          consoleErrors,
          `JS crash on anon mobile visit to ${route.path}:\n${consoleErrors.join('\n')}`,
        ).toHaveLength(0)
        expect(
          bodyText.trim().length,
          `anon mobile visit to public ${route.path} produced empty body (currentHash=${currentHash})`,
        ).toBeGreaterThan(0)
      } else {
        const onAuthGateRoute = /^#\/(login|signup|verify-pending|onboarding|terms|privacy)(\/|$)/.test(currentHash)
        const authGateUiVisible = /\bsign in\b|\blog in\b|\bcreate account\b|\bverify (your )?email\b/i.test(bodyText)
        const guarded = onAuthGateRoute || authGateUiVisible
        expect(
          guarded,
          `anon mobile visit to protected ${route.path} was NOT redirected: ` +
            `currentHash=${currentHash} authGateUiVisible=${authGateUiVisible}`,
        ).toBe(true)
      }
    })
  }
})
