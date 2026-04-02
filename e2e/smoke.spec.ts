import { test, expect } from '@playwright/test'

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
    { label: 'Command Center', route: /\#\/dashboard/ },
    { label: 'RFIs',           route: /\#\/rfis/ },
    { label: 'Submittals',     route: /\#\/submittals/ },
    { label: 'Schedule',       route: /\#\/schedule/ },
    { label: 'Budget',         route: /\#\/budget/ },
    { label: 'Daily Log',      route: /\#\/daily-log/ },
    { label: 'Punch List',     route: /\#\/punch-list/ },
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
