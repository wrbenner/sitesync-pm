/**
 * Phase B.10 — Visual regression sweep.
 *
 * Playwright's built-in toHaveScreenshot() captures baselines per route.
 * Subsequent runs diff against the baseline; any change > ±2px requires
 * explicit reviewer approval (per Phase E Gate 16).
 *
 * Baselines live in tests/visual/__screenshots__/ and are git-tracked
 * (small PNGs; commit only the relevant viewport).
 */
import { test, expect, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const REAL_BACKEND = process.env.E2E_REAL_BACKEND === 'true'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const USER = process.env.POLISH_USER ?? ''
const PASS = process.env.POLISH_PASS ?? ''

test.skip(!REAL_BACKEND, 'Stage-env only — set E2E_REAL_BACKEND=true')

interface RouteRow { path: string; isProtected: boolean; isPublic: boolean }
const inventory = JSON.parse(
  readFileSync(resolve(__dirname, '../../ops/coverage/routes.json'), 'utf-8'),
) as { routes: RouteRow[] }

// Routes that have visual regression baselines. Cap to top 20 to keep
// the screenshot bytes manageable in the repo. Full sweep is nightly.
const VISUAL_ROUTES = [
  '/day', '/rfis', '/submittals', '/daily-log', '/punch-list',
  '/change-orders', '/schedule', '/drawings', '/budget', '/closeout',
  '/photos', '/field', '/safety', '/team', '/billing',
  '/settings', '/dashboard', '/portfolio', '/iris', '/audit-trail',
].filter((p) => inventory.routes.some((r) => r.path === p))

async function signIn(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/#/login`)
  await page.getByPlaceholder('you@company.com').fill(USER)
  await page.getByPlaceholder('Enter your password').fill(PASS)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL(/#\/(dashboard|day|onboarding|profile|$)/, { timeout: 20_000 })
  await page.waitForTimeout(1_500)
}

test.describe('B.10 — Visual regression sweep', () => {
  for (const path of VISUAL_ROUTES) {
    test(`screenshot: ${path}`, async ({ page }) => {
      await signIn(page)
      await page.goto(`${BASE_URL}/#${path}`)
      await page
        .waitForFunction(() => !/Loading…|Loading\.\.\./.test(document.body.textContent ?? ''), { timeout: 20_000 })
        .catch(() => undefined)
      await page.waitForTimeout(2_500) // settle for any post-mount animations

      // Mask elements known to vary (dates, presence avatars, live counts).
      // toHaveScreenshot() applies the maxDiffPixelRatio threshold per Phase E.
      await expect(page).toHaveScreenshot(`${path.replace(/^\//, '').replace(/\//g, '-') || 'root'}.png`, {
        fullPage: true,
        maxDiffPixelRatio: 0.005, // 0.5% drift cap
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
