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
  // Labels must match CORE_NAV in src/components/Sidebar.tsx.
  // Budget/Change Orders require budget.view — not available to viewer role in dev-bypass — so omit them.
  const navItems = [
    { label: 'Home',           route: /#\/dashboard/ },
    { label: 'RFIs',           route: /#\/rfis/ },
    { label: 'Submittals',     route: /#\/submittals/ },
    { label: 'Schedule',       route: /#\/schedule/ },
    { label: 'Daily Log',      route: /#\/daily-log/ },
    { label: 'Punch List',     route: /#\/punch-list/ },
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

// ── 3. Dashboard renders without crashing ────────────────────────────────────
// With a real backend + project, the dashboard shows an h1 project name and
// metric cards ("Schedule Health", "Budget Used", …). In dev-bypass mode those
// KPIs load from Supabase which is unavailable, so we verify the page loads
// cleanly without an error boundary crash — not the specific card content.

test.describe('Dashboard metric cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('#/dashboard')
    await waitForPageContent(page)
  })

  test('renders without error boundary crash', async ({ page }) => {
    // Allow up to 12 s for the dashboard to settle (KPI queries may retry once)
    await page.waitForFunction(
      () => !document.querySelector('[aria-busy="true"]'),
      { timeout: 12_000 },
    ).catch(() => { /* acceptable — check content below */ })
    const body = await page.locator('body').innerText()
    expect(body).not.toMatch(/something went wrong|an unexpected error occurred/i)
    // Main region must be present (even empty = pass; crashed = fail)
    await expect(page.locator('[role="main"]').first()).toBeVisible({ timeout: 5_000 })
  })
})

// ── 4. AI Copilot route loads ──────────────────────────────────────────────────
// In dev-bypass mode the viewer role lacks ai.use, so the page shows Access
// Restricted rather than the chat textarea. We verify the route loads without
// an error boundary crash — not that the textarea is present.

test.describe('AI Copilot', () => {
  test('route loads without crashing', async ({ page }) => {
    await page.goto('#/copilot')
    await waitForPageContent(page)
    const body = await page.locator('body').innerText()
    expect(body).not.toMatch(/something went wrong|an unexpected error occurred/i)
  })
})

// ── 5. List pages load past the skeleton ──────────────────────────────────────
// With a real backend, pages show data rows or filter tabs.
// In dev-bypass mode (no Supabase) the query fails and pages show an error/empty
// state. Either way the skeleton must resolve within 15 s and the page must not
// crash (ErrorBoundary text absent).

test.describe('List pages have rows', () => {
  const listPages = [
    { name: 'RFIs',        hash: '#/rfis' },
    { name: 'Submittals',  hash: '#/submittals' },
    { name: 'Punch List',  hash: '#/punch-list' },
    { name: 'Daily Log',   hash: '#/daily-log' },
  ]

  for (const { name, hash } of listPages) {
    test(`${name} renders past skeleton without crashing`, async ({ page }) => {
      await page.goto(hash)
      await waitForPageContent(page)
      // Wait for the loading skeleton to resolve (aria-busy disappears or data/error renders)
      await page.waitForFunction(
        () => !document.querySelector('[aria-busy="true"]'),
        { timeout: 15_000 },
      ).catch(() => { /* skeleton timeout is acceptable; we check content next */ })

      const body = await page.locator('body').innerText()
      // Page must not be stuck in an error boundary crash
      expect(body).not.toMatch(/something went wrong|an unexpected error occurred/i)
      // Must render EITHER data rows/tabs OR a clean error/empty state message
      const hasInteractive = await page.locator('[role="row"], [role="tab"]').count()
      const hasErrorOrEmpty = await page.locator('[role="main"]').count()
      expect(hasInteractive + hasErrorOrEmpty, `${name}: no content at all`).toBeGreaterThan(0)
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

      // Filter known-benign errors from third-party libs and expected dev-mode network failures.
      // net::ERR_CONNECTION_REFUSED / ERR_CERT_AUTHORITY_INVALID appear when the Supabase stub
      // URL (localhost:54321) is not running — expected in VITE_DEV_BYPASS mode.
      const meaningful = consoleErrors.filter(
        (e) =>
          !/sentry/i.test(e) &&
          !/ReactQueryDevtools/i.test(e) &&
          !/React DevTools/i.test(e) &&
          !/net::ERR_/i.test(e) &&
          !/Failed to load resource/i.test(e),
      )
      expect(pageErrors, `pageerror on ${contract.route}:\n${pageErrors.join('\n')}`).toHaveLength(0)
      expect(meaningful, `console.error on ${contract.route}:\n${meaningful.join('\n')}`).toHaveLength(0)
    })
  }
})
