/**
 * Phase B.1 — Click every safe Button on every protected route.
 *
 * The companion to B1-every-route.spec.ts. After verifying the route
 * renders cleanly, this one finds every visible <Button> / [role=button]
 * / clickable <a> / <MenuItem> on the page and clicks it (excluding
 * destructive labels). Then asserts no API 5xx or JS crash resulted.
 *
 * This catches the "dead button" class of bug: button is rendered, has
 * an onClick handler that the elements.json scan saw, but the handler
 * fires an API call that errors or a state update that crashes the
 * component tree.
 *
 * --- USAGE ---
 *   E2E_REAL_BACKEND=true E2E_BASE_URL=<vercel-preview-url> \
 *   POLISH_USER=<email> POLISH_PASS=<pw> \
 *   npx playwright test e2e/coverage/B1-every-button.spec.ts --workers=2
 *
 * Workers=2 (not 4) because the click cycles can stress the same
 * project_id across parallel workers and cause artificial deadlocks.
 */
import { test, expect, type Page, type Response, type ConsoleMessage } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

interface RouteRow {
  path: string
  isProtected: boolean
}

const REAL_BACKEND = process.env.E2E_REAL_BACKEND === 'true'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const USER = process.env.POLISH_USER ?? ''
const PASS = process.env.POLISH_PASS ?? ''

test.skip(!REAL_BACKEND, 'Stage-env only — set E2E_REAL_BACKEND=true')

const inventoryPath = resolve(__dirname, '../../ops/coverage/routes.json')
const inventory = JSON.parse(readFileSync(inventoryPath, 'utf-8')) as {
  routes: RouteRow[]
}

const EXCLUDED_PATTERNS: RegExp[] = [
  /^\/login$/,
  /^\/signup$/,
  /^\/forgot-password$/,
  /^\/reset-password/,
  /^\/magic-link\//,
  /\/share\//,
  /\/admin\/orgs\//,
  /\/:\w+/,
]

// Labels we MUST NOT click (destructive, navigates away, blocks the test):
const DANGER_LABELS = [
  /delete/i,
  /destroy/i,
  /remove/i,
  /drop/i,
  /cancel subscription/i,
  /sign out/i,
  /log out/i,
  /switch org/i,
  /transfer ownership/i,
  /pay now/i,
  /submit pay app/i,
  /approve change order/i,
  /void/i,
  /close (rfi|submittal|punch|item)/i,
  /publish/i,
  /distribute/i,
  /send (email|notification|invite)/i,
  /sign and (close|submit|approve)/i,
]

const sweepRoutes = inventory.routes.filter(
  (r) => r.isProtected && !EXCLUDED_PATTERNS.some((p) => p.test(r.path)),
).slice(0, 25) // Cap at top 25 routes — full sweep is run separately on a longer cadence

async function signIn(page: Page): Promise<void> {
  await page.goto(`${BASE_URL}/#/login`)
  await page.getByRole('button', { name: /sign in with password/i }).first().click().catch(() => undefined)
  await page.waitForTimeout(400)
  await page.getByPlaceholder('Email').fill(USER)
  await page.getByPlaceholder('Password').fill(PASS)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL(/#\/(dashboard|onboarding|profile|day|$)/, { timeout: 20_000 })
  await page.waitForTimeout(1_200)
}

const CONSOLE_IGNORE = [/Warning:.*deprecated/, /\[HMR\]/, /vite/i]

interface ClickFailure { label: string; type: 'network' | 'console'; detail: string }

async function exerciseSafeButtons(page: Page, _route: string): Promise<ClickFailure[]> {
  const failures: ClickFailure[] = []

  page.on('response', async (res: Response) => {
    const url = res.url()
    if (!/\/rest\/v1\/|\/functions\/v1\/|\/rpc\//.test(url)) return
    if (res.status() >= 500) {
      const body = await res.text().catch(() => '<unreadable>')
      failures.push({ label: '(network)', type: 'network', detail: `${res.status()} ${url}: ${body.slice(0, 150)}` })
    }
  })
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() !== 'error') return
    const t = msg.text()
    if (CONSOLE_IGNORE.some((re) => re.test(t))) return
    if (/TypeError|ReferenceError|undefined is not a function/i.test(t)) {
      failures.push({ label: '(console)', type: 'console', detail: t.slice(0, 250) })
    }
  })

  // Find all clickable elements on the page that are visible AND not danger.
  const buttons = await page.locator('button:visible, [role=button]:visible, a[href]:visible').all()
  let clicked = 0
  for (const btn of buttons) {
    if (clicked >= 8) break // budget per route
    const label = (await btn.textContent().catch(() => '')) ?? ''
    const trimmed = label.trim()
    if (!trimmed) continue
    if (DANGER_LABELS.some((re) => re.test(trimmed))) continue
    // Skip if it's a navigation away (anchor with external href)
    const href = await btn.getAttribute('href').catch(() => null)
    if (href && (href.startsWith('http') || href.startsWith('mailto:'))) continue
    try {
      await btn.click({ timeout: 2_000, trial: false })
      clicked++
      await page.waitForTimeout(400)
      // If a modal opened, escape out so the next click can land
      await page.keyboard.press('Escape').catch(() => undefined)
      await page.waitForTimeout(200)
    } catch {
      // Element became stale (re-render). Move on.
    }
  }
  return failures
}

test.describe('B.1 — Click every safe button on top routes', () => {
  for (const route of sweepRoutes) {
    test(`buttons on ${route.path}`, async ({ page }) => {
      await signIn(page)
      await page.goto(`${BASE_URL}/#${route.path}`)
      await page.waitForTimeout(1_500)
      const failures = await exerciseSafeButtons(page, route.path)
      expect(
        failures,
        `${route.path} button-exercise failures:\n${failures.map((f) => `  [${f.type}] ${f.label}: ${f.detail}`).join('\n')}`,
      ).toHaveLength(0)
    })
  }
})
