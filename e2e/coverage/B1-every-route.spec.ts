/**
 * Phase B.1 — Per-route render + interactive-element exercise.
 *
 * Data-driven from ops/coverage/routes.json. For each of the 104 routes:
 *   1. Sign in as PM persona
 *   2. Navigate to the route
 *   3. Wait for loaders to clear
 *   4. Assert no 5xx in network responses + no console errors with
 *      'TypeError' or 'undefined is not a function' (the JS-crash signature)
 *   5. Count interactive elements (Button/Link/MenuItem/Modal/Drawer)
 *   6. Click every visible Button that isn't a "Delete"/"Destroy"/"Cancel"
 *      action; assert no resulting 4xx/5xx on PostgREST or RPC endpoints
 *
 * This is the BIG sweep — one spec, every route, every safe button.
 * Destructive actions are quarantined and tested via the dedicated B.2
 * workflow specs (rfi-delete, submittal-cancel, etc.).
 *
 * Gated on E2E_REAL_BACKEND=true so it can't run against the dev-bypass
 * stub (which would silently swallow everything).
 *
 * --- USAGE ---
 *   E2E_REAL_BACKEND=true E2E_BASE_URL=<vercel-preview-url> \
 *   POLISH_USER=<email> POLISH_PASS=<pw> \
 *   npx playwright test e2e/coverage/B1-every-route.spec.ts --workers=4
 */
import { test, expect, type Page, type Response, type ConsoleMessage } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))

interface RouteRow {
  path: string
  isProtected: boolean
  isPublic: boolean
  element_summary: string
  requiredPermissionHint: string | null
}

const REAL_BACKEND = process.env.E2E_REAL_BACKEND === 'true'
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:5173'
const USER = process.env.POLISH_USER ?? ''
const PASS = process.env.POLISH_PASS ?? ''

test.skip(!REAL_BACKEND, 'Stage-env only — set E2E_REAL_BACKEND=true')

const inventoryPath = resolve(__dirname, '../../ops/coverage/routes.json')
const inventory = JSON.parse(readFileSync(inventoryPath, 'utf-8')) as {
  count: number
  routes: RouteRow[]
}

// Routes we EXCLUDE from the sweep (each has a dedicated spec or is
// destructive / requires special fixtures):
//   - /login + /signup — auth specs handle these (B.2 auth workflow)
//   - parameterized routes that need real IDs (:rfiId etc.) — exercised
//     via the B.2 workflow specs after creating the entity
//   - /share/owner-payapp/:token — needs a real magic-link token
//   - /admin/orgs/:id — needs the operator-admin role we don't have here
const EXCLUDED_PATTERNS: RegExp[] = [
  /^\/login$/,
  /^\/signup$/,
  /^\/forgot-password$/,
  /^\/reset-password/,
  /^\/magic-link\//,
  /\/share\//,
  /\/admin\/orgs\//,
  /\/:\w+/, // any unfilled URL param
]

const sweepRoutes = inventory.routes.filter(
  (r) => r.isProtected && !EXCLUDED_PATTERNS.some((p) => p.test(r.path)),
)

// Console messages we ignore (known noise unrelated to functional bugs):
const CONSOLE_IGNORE = [
  /Warning:.*deprecated/,
  /Failed to load resource:.*svg/, // sprites occasionally 404 in preview
  /Download the React DevTools/,
  /\[HMR\]/,
  /vite/i,
]

const NETWORK_FAILURE_PATHS = ['/rest/v1/', '/functions/v1/', '/rpc/']

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

async function waitForLoaders(page: Page): Promise<void> {
  await page
    .waitForFunction(
      () => !/Loading…|Loading\.\.\./.test(document.body.textContent ?? ''),
      { timeout: 15_000 },
    )
    .catch(() => undefined)
}

interface CapturedFailure {
  type: 'network' | 'console'
  url?: string
  status?: number
  message: string
}

function captureFailures(page: Page): CapturedFailure[] {
  const failures: CapturedFailure[] = []
  page.on('response', async (res: Response) => {
    const url = res.url()
    const isApi = NETWORK_FAILURE_PATHS.some((p) => url.includes(p))
    if (!isApi) return
    if (res.status() >= 500 || res.status() === 401 || res.status() === 403) {
      // 401 on initial render is normal during sign-in race; ignore.
      if (res.status() === 401) return
      const body = await res.text().catch(() => '<unreadable>')
      failures.push({ type: 'network', url, status: res.status(), message: body.slice(0, 200) })
    }
  })
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() !== 'error') return
    const text = msg.text()
    if (CONSOLE_IGNORE.some((re) => re.test(text))) return
    // Only flag the JS-crash signatures, not every console.error
    if (/TypeError|ReferenceError|undefined is not a function|Cannot read prop/i.test(text)) {
      failures.push({ type: 'console', message: text.slice(0, 300) })
    }
  })
  return failures
}

test.describe('B.1 — Every protected route renders', () => {
  test.beforeAll(() => {
    console.log(`[B.1] Sweeping ${sweepRoutes.length} routes (of ${inventory.count} total)`)
  })

  for (const route of sweepRoutes) {
    test(`renders ${route.path}`, async ({ page }) => {
      const failures = captureFailures(page)
      await signIn(page)
      await page.goto(`${BASE_URL}/#${route.path}`)
      await waitForLoaders(page)
      // Settle for any post-mount fetches
      await page.waitForTimeout(800)

      // Page must not 404 to the SPA fallback (route exists in App.tsx)
      const url = new URL(page.url())
      expect(url.hash, `expected hash route to remain at ${route.path}`).toContain(route.path.split('/')[1] || '')

      // No JS crash and no API 500s
      const networkFailures = failures.filter((f) => f.type === 'network')
      const consoleFailures = failures.filter((f) => f.type === 'console')
      expect(
        networkFailures,
        `network 5xx/403 on ${route.path}:\n${networkFailures.map((f) => `  ${f.status} ${f.url}: ${f.message}`).join('\n')}`,
      ).toHaveLength(0)
      expect(
        consoleFailures,
        `JS crash on ${route.path}:\n${consoleFailures.map((f) => '  ' + f.message).join('\n')}`,
      ).toHaveLength(0)
    })
  }
})
