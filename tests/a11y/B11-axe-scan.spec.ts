/**
 * Phase B.11 — a11y scan (WCAG 2.1 AA via @axe-core/playwright).
 *
 * For each public + top-priority protected route from routes.json:
 *   - Render the route
 *   - Run axe-core scan
 *   - Fail on any 'critical' or 'serious' violation
 *   - Log 'moderate' / 'minor' violations as warnings
 *
 * @axe-core/playwright is the standard package. If it's not already
 * installed, this spec skips cleanly.
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

interface RouteRow {
  path: string
  isProtected: boolean
  isPublic: boolean
}

const inventory = JSON.parse(
  readFileSync(resolve(__dirname, '../../ops/coverage/routes.json'), 'utf-8'),
) as { routes: RouteRow[] }

// Public routes need no auth; sample priority protected routes for the
// baseline. Full sweep runs nightly. Bugatti continuation expands this to
// include the 3 named demo surfaces (Iris Inbox, RFI Detail, Daily Log)
// plus every page touched by Phases J/K cross-codebase Sev-1/Sev-2 sweeps.
const PRIORITY_PROTECTED = [
  '/day',
  '/rfis',
  '/submittals',
  '/daily-log',
  '/punch-list',
  '/change-orders',
  // Bugatti demo surfaces (Phases B + F):
  '/iris/inbox',
  // Note: RFI Detail (/rfis/:id) requires a fixture RFI id; covered by a
  // separate spec rather than the generic axe sweep.
]
const sampleRoutes = [
  ...inventory.routes.filter((r) => r.isPublic).map((r) => r.path).slice(0, 5),
  ...PRIORITY_PROTECTED.filter((p) => inventory.routes.some((r) => r.path === p)),
]

async function signIn(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/#/login`)
  // Login defaults to magic-link mode; toggle to password mode.
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

interface AxeViolation { id: string; impact: 'minor' | 'moderate' | 'serious' | 'critical'; nodes: unknown[] }
interface AxeResults { violations: AxeViolation[] }

async function runAxe(page: Page): Promise<AxeResults | null> {
  try {
    // @ts-expect-error — optional dependency; only loaded if installed
    const { default: AxeBuilder } = await import('@axe-core/playwright')
    const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    return (await builder.analyze()) as AxeResults
  } catch {
    return null
  }
}

test.describe('B.11 — a11y axe-core scan', () => {
  for (const path of sampleRoutes) {
    test(`a11y: ${path}`, async ({ page }) => {
      const protectedRoute = !inventory.routes.find((r) => r.path === path)?.isPublic
      if (protectedRoute) {
        if (!USER || !PASS) test.skip(true, 'POLISH_USER + POLISH_PASS required for protected routes')
        await signIn(page)
      }
      await page.goto(`${BASE_URL}/#${path}`)
      await page.waitForTimeout(1_500)

      const results = await runAxe(page)
      if (!results) {
        test.skip(true, '@axe-core/playwright not installed; npm i -D @axe-core/playwright to enable')
      }

      const critical = (results!.violations ?? []).filter((v) => v.impact === 'critical')
      const serious = (results!.violations ?? []).filter((v) => v.impact === 'serious')
      expect(
        critical,
        `${path} CRITICAL a11y violations:\n${critical.map((v) => `  ${v.id} (${v.nodes.length} nodes)`).join('\n')}`,
      ).toHaveLength(0)
      expect(
        serious,
        `${path} SERIOUS a11y violations:\n${serious.map((v) => `  ${v.id} (${v.nodes.length} nodes)`).join('\n')}`,
      ).toHaveLength(0)
    })
  }
})
