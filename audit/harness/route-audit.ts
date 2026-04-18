// Dynamic route smoke — Playwright test that visits every registered route
// and asserts no pageerror/console.error fires. Complements static-audit by
// catching runtime issues the AST scan can't see (null-deref in render,
// failed dynamic imports, ErrorBoundary fallback triggers).
//
// Requires a running dev server at playwright.config baseURL. In CI this is
// started by Playwright; locally run `npm run dev` first.

import { test, expect } from '@playwright/test'
import { PAGE_REGISTRY } from '../registry'

const SKIP_ROUTES = new Set<string>([
  '*', // wildcard — not a real navigation target
  '/login',
  '/signup',
  '/onboarding',
])

const ERROR_BOUNDARY_TEXT = /something went wrong|an unexpected error occurred/i

for (const contract of PAGE_REGISTRY) {
  if (SKIP_ROUTES.has(contract.route)) continue
  if (contract.status === 'stub') continue

  test(`route renders: ${contract.route}`, async ({ page }) => {
    const consoleErrors: string[] = []
    const pageErrors: string[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    page.on('pageerror', (err) => {
      pageErrors.push(err.message)
    })

    // HashRouter — route is everything after '#'
    await page.goto(`/#${contract.route}`)

    // Wait for the main landmark to mount
    await page.waitForSelector('[role="main"], main', { timeout: 10_000 })

    // Catch the "Something went wrong" ErrorBoundary fallback
    const body = await page.locator('body').innerText()
    expect(body, `ErrorBoundary on ${contract.route}: ${body.slice(0, 200)}`).not.toMatch(
      ERROR_BOUNDARY_TEXT,
    )

    // Filter benign errors (dev-only Sentry init, React Query dev warnings, etc.)
    const meaningfulConsole = consoleErrors.filter(
      (e) =>
        !/sentry/i.test(e) &&
        !/ReactQueryDevtools/i.test(e) &&
        !/Download the React DevTools/i.test(e),
    )
    expect(pageErrors, `pageerror on ${contract.route}:\n${pageErrors.join('\n')}`).toHaveLength(0)
    expect(
      meaningfulConsole,
      `console.error on ${contract.route}:\n${meaningfulConsole.join('\n')}`,
    ).toHaveLength(0)
  })
}
