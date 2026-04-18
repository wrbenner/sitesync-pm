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
  const navItems = [
    { label: 'Command Center', route: /#\/dashboard/ },
    { label: 'RFIs',           route: /#\/rfis/ },
    { label: 'Submittals',     route: /#\/submittals/ },
    { label: 'Schedule',       route: /#\/schedule/ },
    { label: 'Budget',         route: /#\/budget/ },
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

// ── 3. Dashboard metric cards render ─────────────────────────────────────────

test.describe('Dashboard metric cards', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('#/dashboard')
    await waitForPageContent(page)
  })

  test('renders project heading', async ({ page }) => {
    // Dashboard shows the project name as an h1
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10_000 })
  })

  test('renders at least 4 labeled metric cards', async ({ page }) => {
    const expectedLabels = [
      'Schedule Health',
      'Budget Used',
      'Open RFIs',
      'Safety Score',
    ]
    for (const label of expectedLabels) {
      await expect(page.getByText(label)).toBeVisible({ timeout: 10_000 })
    }
  })
})

// ── 4. AI Copilot chat interface ──────────────────────────────────────────────

test.describe('AI Copilot', () => {
  test('loads with a chat input', async ({ page }) => {
    await page.goto('#/copilot')
    await page.waitForSelector('textarea', { timeout: 10_000 })
    const input = page.locator('textarea').first()
    await expect(input).toBeVisible()
    await expect(input).toHaveAttribute('placeholder', /Ask your AI team/)
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
      // Pages use role="row" (Primitives table rows) or role="tab" (filter tabs).
      // Either indicates content loaded past the skeleton.
      const interactive = page.locator('[role="row"], [role="tab"]')
      await expect(interactive.first()).toBeVisible({ timeout: 10_000 })
      expect(await interactive.count()).toBeGreaterThan(0)
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

      // Filter known-benign errors from third-party libs
      const meaningful = consoleErrors.filter(
        (e) => !/sentry/i.test(e) && !/ReactQueryDevtools/i.test(e) && !/React DevTools/i.test(e),
      )
      expect(pageErrors, `pageerror on ${contract.route}:\n${pageErrors.join('\n')}`).toHaveLength(0)
      expect(meaningful, `console.error on ${contract.route}:\n${meaningful.join('\n')}`).toHaveLength(0)
    })
  }
})
