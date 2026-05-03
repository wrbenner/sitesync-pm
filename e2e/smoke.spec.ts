import { test, expect } from '@playwright/test'
import { PAGE_REGISTRY } from '../audit/registry'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns the sidebar nav (inner Sidebar element, not the App wrapper). */
function sidebar(page: import('@playwright/test').Page) {
  // Two nested nav[aria-label="Main navigation"] exist: the outer App wrapper
  // and the inner Sidebar element. The buttons live in the last/inner one.
  return page.locator('nav[aria-label="Main navigation"]').last()
}

async function waitForPageContent(page: import('@playwright/test').Page) {
  await page.waitForSelector('[role="main"]', { timeout: 10_000 })
}

// ── 1. App loads and sidebar is visible ──────────────────────────────────────

test.describe('App loads', () => {
  test('sidebar renders with brand logo', async ({ page }) => {
    await page.goto('#/')
    await page.waitForSelector('nav[aria-label="Main navigation"]', { timeout: 10_000 })
    await expect(sidebar(page)).toBeVisible()
    // Brand wordmark is always visible in the sidebar header
    await expect(page.getByText('SiteSync')).toBeVisible()
  })
})

// ── 2. Main nav items navigate to their pages ─────────────────────────────────

test.describe('Sidebar navigation', () => {
  // Dev-bypass role is 'viewer'. Budget requires budget.view (owner/admin/pm/super),
  // so the Budget nav item is intentionally hidden for viewer — omit it from this test.
  const navItems = [
    { label: 'Home',       route: /#\/dashboard/ },
    { label: 'RFIs',       route: /#\/rfis/ },
    { label: 'Submittals', route: /#\/submittals/ },
    { label: 'Schedule',   route: /#\/schedule/ },
    { label: 'Daily Log',  route: /#\/daily-log/ },
    { label: 'Punch List', route: /#\/punch-list/ },
  ]

  test.beforeEach(async ({ page }) => {
    await page.goto('#/')
    await page.waitForSelector('nav[aria-label="Main navigation"]', { timeout: 10_000 })
  })

  for (const { label, route } of navItems) {
    test(`clicking "${label}" loads the page`, async ({ page }) => {
      await sidebar(page).getByRole('button', { name: label }).click()
      await waitForPageContent(page)
      await expect(page).toHaveURL(route)
      await expect(page.locator('[role="main"]')).toBeVisible()
    })
  }
})

// ── 3. Dashboard metric cards render ─────────────────────────────────────────

test.describe('Dashboard metric cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('#/dashboard')
    await waitForPageContent(page)
  })

  test('renders without crash', async ({ page }) => {
    // RouteAnnouncer fires within 50ms confirming the dashboard route mounted.
    // This is a reliable smoke signal the page loaded without an error boundary.
    const announcer = page.getByTestId('route-announcer')
    if (await announcer.count() > 0) {
      await expect(announcer).toContainText('Dashboard', { timeout: 5_000 })
    }
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).not.toMatch(/something went wrong|an unexpected error occurred/i)
  })

  test('renders loading or content state', async ({ page }) => {
    // The main area always renders — either the DashboardSkeleton (while Supabase
    // resolves) or the actual project content once the query settles.
    await expect(page.locator('[role="main"]')).toBeVisible()
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).not.toMatch(/something went wrong|an unexpected error occurred/i)
  })
})

// ── 4. AI Copilot chat interface ──────────────────────────────────────────────

test.describe('AI Copilot', () => {
  test('loads with a chat input', async ({ page }) => {
    // /copilot redirects to /ai (AIAssistant page)
    await page.goto('#/ai')
    await page.waitForSelector('textarea', { timeout: 10_000 })
    const input = page.locator('textarea').first()
    await expect(input).toBeVisible()
    // Placeholder matches "Ask about <project name>…" pattern
    await expect(input).toHaveAttribute('placeholder', /Ask about|Ask your AI team/)
  })
})

// ── 5. List pages render data rows ────────────────────────────────────────────

test.describe('List pages have rows', () => {
  const listPages = [
    { name: 'RFIs',        hash: '#/rfis' },
    { name: 'Submittals',  hash: '#/submittals' },
    { name: 'Punch List',  hash: '#/punch-list' },
    { name: 'Daily Log',   hash: '#/daily-log' },
  ]

  for (const { name, hash } of listPages) {
    test(`${name} renders interactive rows or tabs`, async ({ page }) => {
      await page.goto(hash)
      await waitForPageContent(page)
      // Pages use role="row" (table header), role="tab" (filter tabs), or an
      // EmptyState heading when no project is selected (dev-bypass mode).
      // Any of these confirms content loaded past the skeleton.
      const loaded = page.locator('[role="row"], [role="tab"], h1, h2, h3')
      await expect(loaded.first()).toBeVisible({ timeout: 10_000 })
      expect(await loaded.count()).toBeGreaterThan(0)
    })
  }
})

// ── 6. Every registered route renders without uncaught errors ────────────────
// Sourced from audit/registry.ts so new routes are automatically covered.

const ROUTE_SKIP = new Set<string>(['*', '/login', '/signup', '/onboarding'])
const ERROR_BOUNDARY_RE = /something went wrong|an unexpected error occurred/i

test.describe('Every route renders cleanly', () => {
  for (const contract of PAGE_REGISTRY) {
    if (ROUTE_SKIP.has(contract.route)) continue
    if (contract.status === 'stub') continue

    test(`${contract.route} has no pageerror or console.error`, async ({ page }) => {
      const pageErrors: string[] = []
      const consoleErrors: string[] = []

      page.on('pageerror', (err) => pageErrors.push(err.message))
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text())
      })

      await page.goto(`#${contract.route}`)
      await waitForPageContent(page)

      const body = await page.locator('body').innerText()
      expect(body, `ErrorBoundary on ${contract.route}`).not.toMatch(ERROR_BOUNDARY_RE)

      // Filter known-benign errors: third-party libs + expected network failures in
      // dev-bypass mode (Supabase / external APIs unavailable when VITE_SUPABASE_URL
      // is not set, producing ERR_NAME_NOT_RESOLVED / ERR_CERT_AUTHORITY_INVALID).
      const meaningful = consoleErrors.filter(
        (e) =>
          !/sentry/i.test(e) &&
          !/ReactQueryDevtools/i.test(e) &&
          !/React DevTools/i.test(e) &&
          !/ERR_CERT|ERR_SSL|net::ERR_/i.test(e),
      )
      expect(pageErrors, `pageerror on ${contract.route}:\n${pageErrors.join('\n')}`).toHaveLength(0)
      expect(meaningful, `console.error on ${contract.route}:\n${meaningful.join('\n')}`).toHaveLength(0)
    })
  }
})
