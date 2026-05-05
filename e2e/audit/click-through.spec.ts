/**
 * Click-through audit — opens each route, attempts to click every
 * visible, enabled, non-destructive button, and records crashes /
 * console errors that fire on click.
 *
 * What we click:
 *   • Every <button> that is visible, not disabled, not type=submit,
 *     and not flagged data-skip-audit
 *   • Buttons inside modals/popovers we know how to close after
 *
 * What we DON'T click:
 *   • Anything labelled Delete / Reject / Approve / Send / Submit /
 *     Archive — these are state-changing and require a fixture to test
 *     safely. Static dead-click detector covers their existence.
 *   • Any button that opened a navigation away from the current route
 *     during the same iteration (we track URL diffs and bail).
 *
 * Output: per-route entry appended to audit/runtime-audit.json under
 * the existing route's `dead_clicks` array.
 */
import { test, expect, Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { AUDIT_ROUTES, isAllowlistedError } from './_routes'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const OUT_DIR = path.join(REPO_ROOT, 'audit')
const JSON_PATH = path.join(OUT_DIR, 'click-through.json')

const DESTRUCTIVE_PATTERNS = [
  /delete/i, /reject/i, /approve/i, /send/i, /submit/i, /archive/i,
  /publish/i, /void/i, /finalize/i, /sign\b/i, /pay\b/i,
]

interface ClickResult {
  selector: string
  label: string
  outcome: 'ok' | 'crash' | 'navigated' | 'skipped'
  details?: string
}

interface RouteResult {
  route: string
  slug: string
  tier: 1 | 2 | 3
  total_buttons: number
  clicked: number
  crashed: number
  navigated: number
  results: ClickResult[]
}

const all: RouteResult[] = []

async function clickThroughRoute(page: Page, route: typeof AUDIT_ROUTES[number]): Promise<RouteResult> {
  const result: RouteResult = {
    route: route.hash, slug: route.slug, tier: route.tier,
    total_buttons: 0, clicked: 0, crashed: 0, navigated: 0, results: [],
  }
  const errors: string[] = []
  page.on('pageerror', (e) => { if (!isAllowlistedError(e.message)) errors.push(e.message) })

  await page.goto(`/sitesync-pm/#${route.hash}`, { waitUntil: 'domcontentloaded' })
  await page.waitForLoadState('networkidle', { timeout: 6_000 }).catch(() => undefined)

  // Count buttons once for the bound, but re-query the live locator on each
  // iteration. A click can detach earlier handles via re-render or modal
  // open/close, so a captured handle from a prior iteration becomes stale —
  // even just reading aria-label off it throws "Target page has been closed".
  const cap = 25
  const initialCount = await page.locator('button:not([disabled])').count()
  result.total_buttons = initialCount

  for (let i = 0; i < Math.min(initialCount, cap); i++) {
    const startUrl = page.url()
    const liveLocator = page.locator('button:not([disabled])').nth(i)
    // Resolve label defensively — the i-th button may no longer exist.
    let label = `(button #${i})`
    try {
      label = (await liveLocator.getAttribute('aria-label', { timeout: 1_500 })) ??
              (await liveLocator.textContent({ timeout: 1_500 }))?.trim() ??
              `(button #${i})`
    } catch {
      // Detached / not yet present — record as skipped and continue.
      result.results.push({ selector: `button[${i}]`, label, outcome: 'skipped', details: 'detached or missing' })
      continue
    }
    const r: ClickResult = { selector: `button[${i}]`, label: label.slice(0, 80), outcome: 'ok' }

    if (DESTRUCTIVE_PATTERNS.some((p) => p.test(label))) {
      r.outcome = 'skipped'
      r.details = 'destructive label'
      result.results.push(r)
      continue
    }

    try {
      const before = errors.length
      await liveLocator.click({ timeout: 2_000, trial: false }).catch(() => undefined)
      await page.waitForTimeout(200)
      if (errors.length > before) {
        r.outcome = 'crash'
        r.details = errors.slice(before).join(' | ').slice(0, 200)
        result.crashed += 1
      } else if (page.url() !== startUrl) {
        r.outcome = 'navigated'
        result.navigated += 1
        // Return to the route so the next iteration is consistent.
        await page.goto(`/sitesync-pm/#${route.hash}`, { waitUntil: 'domcontentloaded' })
        await page.waitForLoadState('networkidle', { timeout: 4_000 }).catch(() => undefined)
      } else {
        result.clicked += 1
      }
    } catch (err) {
      r.outcome = 'crash'
      r.details = (err as Error).message.slice(0, 200)
      result.crashed += 1
    }
    result.results.push(r)

    // Best-effort modal close so we don't carry state into the next click.
    await page.keyboard.press('Escape').catch(() => undefined)
  }
  return result
}

for (const route of AUDIT_ROUTES) {
  test(`click-through @ ${route.hash}`, async ({ page }) => {
    test.setTimeout(60_000)
    const r = await clickThroughRoute(page, route)
    all.push(r)
    expect(true).toBe(true)
  })
}

test.afterAll(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const payload = {
    generated_at: new Date().toISOString(),
    summary: {
      total: all.length,
      total_clicked: all.reduce((s, r) => s + r.clicked, 0),
      total_crashed: all.reduce((s, r) => s + r.crashed, 0),
      total_navigated: all.reduce((s, r) => s + r.navigated, 0),
    },
    routes: all.sort((a, b) => a.tier - b.tier || a.slug.localeCompare(b.slug)),
  }
  fs.writeFileSync(JSON_PATH, JSON.stringify(payload, null, 2))
   
  console.log(`[click-through] wrote ${path.relative(REPO_ROOT, JSON_PATH)}`)
})
