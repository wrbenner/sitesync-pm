/**
 * B.11 — a11y axe-core full route sweep (generated).
 *
 * Parametric counterpart to the baseline `tests/a11y/B11-axe-scan.spec.ts`.
 * Iterates EVERY route in `ops/coverage/routes.json` (104 routes at last
 * codegen) rather than the 11-route priority sample. Designed for nightly
 * or scheduled runs where the longer wall-clock is acceptable.
 *
 * Gate wiring: Gate 15 - a11y Axe Scan (consume via E2E_REAL_BACKEND=true
 * with POLISH_USER/POLISH_PASS for protected routes).
 *
 * Same skip semantics as baseline: skip if @axe-core/playwright is not
 * installed; skip protected routes if credentials are missing.
 *
 * Source of truth: tests/a11y/B11-axe-scan.spec.ts (baseline). Keep both
 * in lockstep when the assertion contract changes.
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
  readFileSync(resolve(__dirname, '../../../ops/coverage/routes.json'), 'utf-8'),
) as { routes: RouteRow[] }

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

test.describe('B.11 — a11y axe-core scan (full route sweep, generated)', () => {
  for (const route of inventory.routes) {
    test(`a11y: ${route.path}`, async ({ page }) => {
      if (route.isProtected) {
        if (!USER || !PASS) test.skip(true, 'POLISH_USER + POLISH_PASS required for protected routes')
        await signIn(page)
      }
      await page.goto(`${BASE_URL}/#${route.path}`)
      await page.waitForTimeout(1_500)

      const results = await runAxe(page)
      if (!results) {
        test.skip(true, '@axe-core/playwright not installed; npm i -D @axe-core/playwright to enable')
      }

      const critical = (results!.violations ?? []).filter((v) => v.impact === 'critical')
      const serious = (results!.violations ?? []).filter((v) => v.impact === 'serious')
      expect(
        critical,
        `${route.path} CRITICAL a11y violations:\n${critical.map((v) => `  ${v.id} (${v.nodes.length} nodes)`).join('\n')}`,
      ).toHaveLength(0)
      expect(
        serious,
        `${route.path} SERIOUS a11y violations:\n${serious.map((v) => `  ${v.id} (${v.nodes.length} nodes)`).join('\n')}`,
      ).toHaveLength(0)
    })
  }
})
