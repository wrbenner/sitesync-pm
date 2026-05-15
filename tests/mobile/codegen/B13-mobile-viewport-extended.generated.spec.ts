/**
 * B.13 — Mobile viewport regression × 20 priority routes (generated).
 *
 * Parametric counterpart to baseline `tests/mobile/B13-mobile-viewport.spec.ts`
 * (3 viewports × 7 critical-field flows = 21 cells). This generated spec
 * extends to the same 20 priority routes covered by B.10 visual regression,
 * giving overflow + JS-error coverage parity across mobile/tablet/desktop.
 *
 * Coverage delta: +39 cells (20 routes × 3 viewports - 21 baseline).
 *
 * Same assertions as baseline:
 *  - No horizontal overflow (body.scrollWidth ≤ body.clientWidth + 2px)
 *  - No TypeError / ReferenceError on the page
 *
 * Same skip semantics (E2E_REAL_BACKEND + POLISH_USER/PASS).
 */
import { test, expect, type Page, type ConsoleMessage } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const REAL_BACKEND = process.env.E2E_REAL_BACKEND === 'true'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const USER = process.env.POLISH_USER ?? ''
const PASS = process.env.POLISH_PASS ?? ''

test.skip(!REAL_BACKEND, 'Stage-env only — set E2E_REAL_BACKEND=true')

interface RouteRow { path: string; isProtected: boolean; isPublic: boolean }
const inventory = JSON.parse(
  readFileSync(resolve(__dirname, '../../../ops/coverage/routes.json'), 'utf-8'),
) as { routes: RouteRow[] }

const VIEWPORTS = [
  { device: 'iPhone', w: 375, h: 812 },
  { device: 'iPad', w: 414, h: 896 },
  { device: 'iPad Pro', w: 1024, h: 1366 },
]

// Priority route set — mirrors tests/visual/B10-visual-regression.spec.ts
// (VISUAL_ROUTES). Keep in lockstep when routes change priority.
const PRIORITY_ROUTES = [
  '/day', '/rfis', '/submittals', '/daily-log', '/punch-list',
  '/change-orders', '/schedule', '/drawings', '/budget', '/closeout',
  '/files', '/field', '/safety', '/settings/team', '/settings/billing',
  '/settings', '/dashboard', '/portfolio', '/iris', '/audit-trail',
].filter((p) => inventory.routes.some((r) => r.path === p))

async function signIn(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/#/login`)
  await page
    .getByRole('button', { name: /sign in with password/i })
    .first()
    .click()
    .catch(() => undefined)
  await page.waitForTimeout(400)
  await page.getByPlaceholder('Email').fill(USER)
  await page.getByPlaceholder('Password').fill(PASS)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL(/#\/(dashboard|day|onboarding|profile|$)/, { timeout: 20_000 })
  await page.waitForTimeout(1_200)
}

test.describe('B.13 — Mobile viewport regression × 20 priority routes (generated)', () => {
  for (const vp of VIEWPORTS) {
    for (const route of PRIORITY_ROUTES) {
      test(`${vp.device} ${vp.w}x${vp.h} renders ${route}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.w, height: vp.h })

        const consoleErrors: string[] = []
        page.on('console', (msg: ConsoleMessage) => {
          if (msg.type() === 'error' && /TypeError|ReferenceError/i.test(msg.text())) {
            consoleErrors.push(msg.text())
          }
        })

        await signIn(page)
        await page.goto(`${BASE_URL}/#${route}`)
        await page.waitForTimeout(1_500)

        const overflow = await page.evaluate(() => {
          const body = document.body
          return body.scrollWidth - body.clientWidth
        })
        expect(
          overflow,
          `${route} on ${vp.device} has horizontal overflow of ${overflow}px (body scrollWidth > clientWidth)`,
        ).toBeLessThanOrEqual(2)

        expect(
          consoleErrors,
          `JS crash on ${route} @ ${vp.device}:\n${consoleErrors.join('\n')}`,
        ).toHaveLength(0)
      })
    }
  }
})
