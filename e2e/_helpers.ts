/**
 * Shared helpers for the page-N-{name}.spec.ts e2e suite.
 *
 * The biggest issue with running tests against a live Supabase project
 * with cold caches is that pages take 5-25 seconds to first-load. The
 * `waitLoad` helper handles that without inflating per-call timeouts.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { Page } from '@playwright/test'

// Native-JS hard cap that bypasses Playwright's internal state machine.
// In acceptance mode, page.waitForLoadState('networkidle') can hang
// indefinitely because Playwright waits for the current load cycle to
// complete before starting the idle countdown — and some routes never
// complete their load cycle (continuous failing Supabase requests reset
// the timer). Promise.race + hardCap guarantees we always move on.
const hardCap = (ms: number) => new Promise<void>(r => setTimeout(r, ms))

export async function settle(page: Page, ms = 250) {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }`,
  }).catch(() => undefined)
  await Promise.race([
    page.waitForLoadState('networkidle').catch(() => undefined),
    hardCap(2_500),
  ])
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
      // Guard: if the body is empty the React app hasn't mounted yet
      // (cold Vite server still compiling modules). Keep waiting rather
      // than incorrectly declaring the page "done loading".
      if (text.trim().length === 0) return false
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
    null,
    { timeout: timeoutMs },
  ).catch(() => undefined)
  // One more brief network-idle sip so any in-flight queries can resolve
  // and the page paints the resolved state before we capture.
  await Promise.race([
    page.waitForLoadState('networkidle').catch(() => undefined),
    hardCap(2_500),
  ])
}

export async function signIn(page: Page, user: string, pass: string) {
  // Detect devBypass mode: navigate to a ProtectedRoute page and wait for it
  // to settle. When VITE_DEV_BYPASS=true + no real Supabase URL, the page
  // renders its content unconditionally (no redirect to /login).
  await page.goto('#/day', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3_000)
  if (!page.url().includes('login')) {
    await settle(page, 500)
    return
  }
  // Normal auth flow against a live Supabase instance.
  await page.goto('#/login', { waitUntil: 'domcontentloaded' })
  const pwdBtn = page.getByRole('button', { name: /sign in with password/i })
  if (await pwdBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
    await pwdBtn.click()
  }
  await page.getByRole('textbox', { name: 'Email' }).fill(user)
  await page.getByRole('textbox', { name: 'Password' }).fill(pass)
  await page.locator('button[type="submit"]').first().click()
  await page.waitForURL(/#\/(dashboard|onboarding|profile|$)/, { timeout: 20_000 })
  await settle(page, 1500)
}

/**
 * Write a named screenshot into outDir, creating the directory if needed.
 * Swallows all errors so a missing dir or failed capture never fails a test.
 * Shared by all page-N-*.spec.ts files so they can drop the boilerplate.
 */
export async function shot(
  page: Page,
  outDir: string,
  viewport: string,
  n: number,
  name: string,
) {
  const filename = `${viewport}-${String(n).padStart(2, '0')}-${name}.png`
  fs.mkdirSync(outDir, { recursive: true })
  await page.screenshot({ path: path.join(outDir, filename), fullPage: true }).catch(() => undefined)
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
