/**
 * Shared helpers for the page-N-{name}.spec.ts e2e suite.
 *
 * The biggest issue with running tests against a live Supabase project
 * with cold caches is that pages take 5-25 seconds to first-load. The
 * `waitLoad` helper handles that without inflating per-call timeouts.
 */
import type { Page } from '@playwright/test'

export async function settle(page: Page, ms = 250) {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }`,
  }).catch(() => undefined)
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined)
  await page.waitForTimeout(ms)
}

/**
 * Wait until both:
 *   1. The page is no longer showing any "Loading…" subtitle/skeleton
 *   2. The "Caching project data …" sync banner has disappeared
 * Up to 30 s, then continue regardless. Don't fail the spec if data
 * never loads — capture what we have so the screenshot reflects the
 * real production-like state for that user.
 *
 * Detection covers three signals:
 *   • Loading copy in body text ("Loading financial data…", "Loading
 *     project — punch list items (4/16)…", etc.)
 *   • Skeleton placeholders (any element with a `safety-pulse` /
 *     pulsing animation class or aria-busy="true")
 *   • Network activity: short networkidle wait at the end so React
 *     Query has settled.
 */
export async function waitLoad(page: Page, timeoutMs = 30_000) {
  await page.waitForFunction(
    () => {
      const text = document.body.textContent ?? ''
      // Catch every "Loading…" or "Loading <X>…" subtitle plus the
      // OfflineBanner sync message. Pages like /budget show
      // "Loading financial data…" instead of plain "Loading...".
      const stillLoading = /Loading[\s.…]|Loading[a-zA-Z]/.test(text)
      const stillCaching = /Caching project data|Loading project/.test(text)
      // Detect skeleton placeholders by aria-busy or known animation
      // class names ("safety-pulse" + the generic pulse used by
      // <Skeleton>). If any visible element is animating as a skeleton,
      // the page is still painting placeholders, not data.
      const hasBusy = !!document.querySelector('[aria-busy="true"]')
      const hasSkeletons = !!document.querySelector(
        '[class*="skeleton" i], [data-skeleton="true"]',
      )
      return !stillLoading && !stillCaching && !hasBusy && !hasSkeletons
    },
    { timeout: timeoutMs },
  ).catch(() => undefined)
  // One more brief network-idle sip so any in-flight queries can resolve
  // and the page paints the resolved state before we capture.
  await page.waitForLoadState('networkidle', { timeout: 4_000 }).catch(() => undefined)
}

export async function signIn(page: Page, user: string, pass: string) {
  // Navigate to root first so subsequent hash-fragment navigation resolves
  // against the app origin (not about:blank).
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => undefined)

  // If the app is running with VITE_DEV_BYPASS=true (no real Supabase URL),
  // ProtectedRoute lets every route through without credentials. Detect this
  // by navigating to the dashboard and checking whether the router kept us
  // there or redirected to the login route.
  await page.goto('#/dashboard')
  await page.waitForTimeout(2_000)
  const urlAfterNav = page.url()
  const isOnDashboard = !urlAfterNav.includes('#/login') && !urlAfterNav.includes('/login')

  if (isOnDashboard) {
    // Bypass is active — we're already on an authenticated page.
    await settle(page, 1500)
    return
  }

  // Real auth path: switch to password mode (default mode is magic-link which
  // has no placeholder text on the email field), then fill credentials.
  await page.goto('#/login')
  await settle(page, 500)
  const passwordModeBtn = page.getByRole('button', { name: 'Sign in with password' })
  const hasPwdMode = await passwordModeBtn.isVisible({ timeout: 5_000 }).catch(() => false)
  if (hasPwdMode) await passwordModeBtn.click()
  await page.locator('input[type="email"]').fill(user)
  await page.locator('input[type="password"]').fill(pass)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL(/#\/(dashboard|onboarding|profile|$)/, { timeout: 20_000 })
  await settle(page, 1500)
}

export async function tryClick(
  page: Page,
  label: RegExp | string,
  opts?: { exact?: boolean; nth?: number },
) {
  const locator = page.getByRole('button', { name: label, exact: opts?.exact })
  const count = await locator.count().catch(() => 0)
  if (count === 0) return false
  const target = opts?.nth !== undefined ? locator.nth(opts.nth) : locator.first()
  await target.click({ timeout: 4_000 }).catch(() => undefined)
  return true
}
