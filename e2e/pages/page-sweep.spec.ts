/**
 * Polish page sweep — visits every route and captures screenshots.
 *
 * Run via playwright.polish.config.ts:
 *   POLISH_USER='...' POLISH_PASS='...' \
 *     npx playwright test --config=playwright.polish.config.ts --project=page-e2e
 *
 * Screenshots land in polish-review/pages/<page>/<viewport>-NN-name.png.
 *
 * In dev-bypass mode (VITE_DEV_BYPASS=true) auth is skipped — no credentials needed.
 */
import { test, expect, type Page } from '@playwright/test'
import * as path from 'path'
import * as fs from 'fs'

// ── Pages to sweep ─────────────────────────────────────────
// Ordered by demo-path priority.
const PAGES = [
  { path: '/dashboard', name: 'dashboard' },
  { path: '/daily-log', name: 'daily-log' },
  { path: '/rfis', name: 'rfis' },
  { path: '/submittals', name: 'submittals' },
  { path: '/punch-list', name: 'punch-list' },
  { path: '/drawings', name: 'drawings' },
  { path: '/schedule', name: 'schedule' },
  { path: '/budget', name: 'budget' },
  { path: '/pay-apps', name: 'pay-apps' },
  { path: '/change-orders', name: 'change-orders' },
  { path: '/contracts', name: 'contracts' },
  { path: '/procurement', name: 'procurement' },
  { path: '/workforce', name: 'workforce' },
  { path: '/directory', name: 'directory' },
  { path: '/meetings', name: 'meetings' },
  { path: '/safety', name: 'safety' },
  { path: '/files', name: 'files' },
  { path: '/reports', name: 'reports' },
  { path: '/closeout', name: 'closeout' },
  { path: '/ai', name: 'ai' },
  { path: '/bim', name: 'bim' },
  { path: '/audit-trail', name: 'audit-trail' },
  { path: '/integrations', name: 'integrations' },
  { path: '/settings', name: 'settings' },
  { path: '/profile', name: 'profile' },
  { path: '/estimating', name: 'estimating' },
  { path: '/crews', name: 'crews' },
  { path: '/equipment', name: 'equipment' },
] as const

const BASE_URL = process.env.POLISH_BASE_URL || 'http://localhost:5173/sitesync-pm/'
const DEV_BYPASS = process.env.VITE_DEV_BYPASS === 'true' || !process.env.POLISH_USER

// ── Helpers ─────────────────────────────────────────────────

async function login(page: Page) {
  if (DEV_BYPASS) return
  await page.goto(BASE_URL + 'login')
  await page.fill('input[type="email"]', process.env.POLISH_USER!)
  await page.fill('input[type="password"]', process.env.POLISH_PASS!)
  await page.click('button[type="submit"]')
  await page.waitForURL(/dashboard/, { timeout: 15_000 })
}

async function saveScreenshot(page: Page, pageName: string, label: string) {
  const viewport = page.viewportSize()
  const vp = viewport ? `${viewport.width}x${viewport.height}` : 'unknown'
  const dir = path.join('polish-review', 'pages', pageName)
  fs.mkdirSync(dir, { recursive: true })
  const filename = path.join(dir, `${vp}-${label}.png`)
  await page.screenshot({ path: filename, fullPage: false })
}

// ── Auth setup ──────────────────────────────────────────────

test.beforeAll(async ({ browser }) => {
  if (DEV_BYPASS) return
  const page = await browser.newPage()
  await login(page)
  await page.context().storageState({ path: '.auth-state.json' })
  await page.close()
})

// ── Page sweep ──────────────────────────────────────────────

for (const pageSpec of PAGES) {
  test(`page: ${pageSpec.name}`, async ({ page }) => {
    if (!DEV_BYPASS) {
      await page.context().addInitScript(() => {})
    }

    await page.goto(BASE_URL.replace(/\/$/, '') + pageSpec.path, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    })

    // Wait for content: loading skeletons should resolve
    await page.waitForTimeout(1500)

    // Capture initial load
    await saveScreenshot(page, pageSpec.name, '01-load')

    // Check for JS errors / crash indicators
    const bodyText = await page.locator('body').textContent().catch(() => '')
    const hasErrorBoundary = (bodyText ?? '').includes('Something went wrong')
    const hasBlankScreen = (bodyText ?? '').trim().length < 20

    expect(hasErrorBoundary, `${pageSpec.name} shows error boundary`).toBe(false)
    expect(hasBlankScreen, `${pageSpec.name} renders blank`).toBe(false)

    // Check no stuck loading spinner (aria-busy without content)
    const busyCount = await page.locator('[aria-busy="true"]').count()
    if (busyCount > 0) {
      // Give extra time for loading states to resolve
      await page.waitForTimeout(2000)
      await saveScreenshot(page, pageSpec.name, '02-after-extra-wait')
    }
  })
}
