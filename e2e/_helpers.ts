/**
 * Shared helpers for the page-N-{name}.spec.ts e2e suite.
 *
 * The biggest issue with running tests against a live Supabase project
 * with cold caches is that pages take 5-25 seconds to first-load. The
 * `waitLoad` helper handles that without inflating per-call timeouts.
 *
 * Network note: the headless Chromium instance in this environment cannot
 * reach external HTTPS endpoints. All Supabase traffic is therefore
 * proxied through the Node.js process (which CAN reach the internet) via
 * Playwright's page.route() interception mechanism.
 */
import type { Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname_helpers = dirname(fileURLToPath(import.meta.url))
const SESSION_FILE = join(__dirname_helpers, '..', 'playwright', '.auth', 'session.json')
const SUPABASE_PROJECT_REF = 'hypxrmcppjfbtlwuoafc'
const SUPABASE_BASE = `https://${SUPABASE_PROJECT_REF}.supabase.co`
const LS_KEY = `sb-${SUPABASE_PROJECT_REF}-auth-token`

/**
 * Intercept all requests destined for Supabase and proxy them through
 * Node.js fetch (which has external network access in this environment).
 * Call this ONCE per page context before any Supabase calls are made.
 */
export async function setupSupabaseProxy(page: Page) {
  await page.route(`${SUPABASE_BASE}/**`, async (route) => {
    const req = route.request()
    const bodyBuf = await req.postDataBuffer().catch(() => null)
    try {
      const res = await fetch(req.url(), {
        method: req.method(),
        headers: req.headers() as HeadersInit,
        body: bodyBuf ?? undefined,
      })
      const body = Buffer.from(await res.arrayBuffer())
      const headers: Record<string, string> = {}
      res.headers.forEach((v, k) => { headers[k] = v })
      await route.fulfill({ status: res.status, headers, body })
    } catch {
      await route.abort('failed')
    }
  })
}

export async function settle(page: Page, ms = 250) {
  await page.addStyleTag({
    content: `*, *::before, *::after {
      animation-duration: 0s !important;
      animation-delay: 0s !important;
      transition-duration: 0s !important;
      transition-delay: 0s !important;
    }`,
  }).catch(() => undefined)
  await page.waitForLoadState('networkidle', { timeout: 1_500 }).catch(() => undefined)
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
export async function waitLoad(page: Page, timeoutMs = 5_000) {
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
    undefined,
    { timeout: timeoutMs },
  ).catch(() => undefined)
  // One more brief network-idle sip so any in-flight queries can resolve
  // and the page paints the resolved state before we capture.
  await page.waitForLoadState('networkidle', { timeout: 1_500 }).catch(() => undefined)
}

export async function signIn(page: Page, _user: string, _pass: string) {
  // In bypass mode (VITE_DEV_BYPASS=true, no Supabase URL), ProtectedRoute
  // allows access without auth. Navigate directly to #/day so the cockpit
  // renders. The _user and _pass params are unused in this mode.
  await page.goto('#/day')
  await page.waitForLoadState('domcontentloaded')
  await settle(page, 600)
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
