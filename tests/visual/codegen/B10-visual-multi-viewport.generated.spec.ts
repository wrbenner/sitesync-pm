/**
 * B.10 — Visual regression sweep × 3 viewports (generated).
 *
 * Parametric counterpart to the baseline `tests/visual/B10-visual-regression.spec.ts`
 * (20 routes × 1 desktop viewport). This generated spec iterates the same
 * 20 routes across mobile (375×667), tablet (768×1024), and desktop (1280×720)
 * viewports for full responsive coverage.
 *
 * Coverage delta vs baseline: +40 cells (20 routes × 2 additional viewports).
 *
 * Gate wiring: Gate 16 - Visual Regression. First CI run captures all 60
 * baselines into `tests/visual/__screenshots__/`; subsequent runs diff
 * against committed baselines.
 *
 * Same skip semantics and signIn flow as baseline.
 */
import { test, expect, type Page } from '@playwright/test'
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

// Keep in lockstep with baseline `tests/visual/B10-visual-regression.spec.ts`.
// When a route is added/removed there, mirror the change here.
const VISUAL_ROUTES = [
  '/day', '/rfis', '/submittals', '/daily-log', '/punch-list',
  '/change-orders', '/schedule', '/drawings', '/budget', '/closeout',
  '/files', '/field', '/safety', '/settings/team', '/settings/billing',
  '/settings', '/dashboard', '/portfolio', '/iris', '/audit-trail',
].filter((p) => inventory.routes.some((r) => r.path === p))

const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 720 },
] as const

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
  await page.waitForTimeout(1_500)
}

test.describe('B.10 — Visual regression × 3 viewports (generated)', () => {
  for (const vp of VIEWPORTS) {
    test.describe(vp.name, () => {
      for (const path of VISUAL_ROUTES) {
        test(`screenshot: ${path} @ ${vp.name}`, async ({ page }) => {
          await page.setViewportSize({ width: vp.width, height: vp.height })
          await signIn(page)
          await page.goto(`${BASE_URL}/#${path}`)
          await page
            .waitForFunction(() => !/Loading…|Loading\.\.\./.test(document.body.textContent ?? ''), { timeout: 20_000 })
            .catch(() => undefined)
          await page.waitForTimeout(2_500)

          const slug = path.replace(/^\//, '').replace(/\//g, '-') || 'root'
          await expect(page).toHaveScreenshot(`${slug}-${vp.name}.png`, {
            fullPage: true,
            maxDiffPixelRatio: 0.005,
            animations: 'disabled',
            mask: [
              page.locator('[data-testid="last-updated"]'),
              page.locator('[data-testid="presence-avatar"]'),
              page.locator('[data-testid="live-count"]'),
              page.locator('time'),
            ],
          })
        })
      }
    })
  }
})
