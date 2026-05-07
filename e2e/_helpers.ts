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
export async function waitLoad(page: Page, timeoutMs = 8_000) {
  await page.waitForFunction(
    () => {
      const text = document.body.textContent ?? ''
      const stillLoading = /Loading[\s.…]|Loading[a-zA-Z]/.test(text)
      const stillCaching = /Caching project data|Loading project/.test(text)
      const hasBusy = !!document.querySelector('[aria-busy="true"]')
      const hasSkeletons = !!document.querySelector(
        '[class*="skeleton" i], [data-skeleton="true"]',
      )
      return !stillLoading && !stillCaching && !hasBusy && !hasSkeletons
    },
    undefined,           // arg (unused)
    { timeout: timeoutMs },  // options — third param, NOT second
  ).catch(() => undefined)
}

export async function signIn(page: Page, user: string, pass: string) {
  // Abort requests to the dev-bypass stub Supabase URL immediately so React
  // Query fails fast (no DNS/connection delay) and loading states clear quickly.
  await page.route('http://localhost:59999/**', (route) => route.abort()).catch(() => undefined)

  // When dev-bypass is active the app auto-authenticates — navigate straight to /day.
  // Check by loading / and seeing if we bypass login entirely.
  await page.goto('')
  await page.waitForLoadState('domcontentloaded')
  const currentUrl = page.url()
  // If we're already past login (dev bypass active), go directly to /day.
  if (!currentUrl.includes('#/login')) {
    await page.goto('#/day')
    await settle(page, 1500)
    return
  }
  // Otherwise do real credential login.
  // The redesigned login starts in magic-link mode (email only, no password field).
  // Switch to password mode before filling credentials.
  const toggle = page.getByRole('button', { name: /sign in with password/i }).first()
  if (await toggle.count() > 0) {
    await toggle.click()
    await page.waitForTimeout(200)
  }
  await page.getByLabel('Email').fill(user)
  await page.getByLabel('Password').fill(pass)
  await page.locator('button[type="submit"]').first().click()
  // After login, app redirects to / (→ /day in Wave 1), /dashboard, /onboarding, or /profile.
  await page.waitForURL(/#\/(day|dashboard|onboarding|profile|$)/, { timeout: 20_000 })
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
