/**
 * Runtime audit — the harness that walks every route, captures console
 * errors + failed network requests + missing-data signals, and writes
 * one entry per route to audit/runtime-audit.json.
 *
 * Auth: reuses the storage state produced by polish-audit.setup.ts.
 * Run as a separate Playwright project so the main suite stays fast.
 *
 * Outputs:
 *   audit/runtime-audit.json — { generated_at, routes: [ … per-route entries ] }
 *
 * Each entry shape:
 *   {
 *     route: '/rfis',
 *     slug: '04-rfis',
 *     tier: 1,
 *     console_errors: [{ text, source }],
 *     failed_requests: [{ url, status }],
 *     missing_data: ['table is empty without empty-state hint'],
 *     dead_clicks: [{ selector }],
 *     screenshot: 'audit/screenshots/04-rfis.png',
 *   }
 *
 * The audit does NOT fail the test on findings — it records them. CI
 * reads the JSON and decides whether to block (e.g. tier-1 console
 * errors block the merge; tier-3 ones don't).
 */
import { test, expect, Page } from '@playwright/test'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { AUDIT_ROUTES, isAllowlistedError } from './_routes'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..', '..')
const OUT_DIR = path.join(REPO_ROOT, 'audit')
const JSON_PATH = path.join(OUT_DIR, 'runtime-audit.json')
const SHOTS_DIR = path.join(OUT_DIR, 'screenshots')

interface RouteEntry {
  route: string
  slug: string
  tier: 1 | 2 | 3
  console_errors: Array<{ text: string; source?: string }>
  failed_requests: Array<{ url: string; status: number }>
  dead_clicks: Array<{ selector: string }>
  missing_data: string[]
  screenshot: string | null
  /** Whether the route ever rendered at all (didn't time out). */
  rendered: boolean
}

const allEntries: RouteEntry[] = []

async function settle(page: Page) {
  await page.waitForLoadState('networkidle', { timeout: 8_000 }).catch(() => undefined)
  await page
    .waitForFunction(
      () => document.querySelectorAll('[data-skeleton="true"]').length === 0,
      { timeout: 6_000, polling: 200 },
    )
    .catch(() => undefined)
  await page.waitForTimeout(150)
}

async function findDeadClicks(page: Page): Promise<RouteEntry['dead_clicks']> {
  // Buttons explicitly tagged as broken by the team.
  return page.evaluate(() => {
    const out: Array<{ selector: string }> = []
    document.querySelectorAll('[data-test-broken]').forEach((el) => {
      const id = (el as HTMLElement).id || (el as HTMLElement).getAttribute('aria-label') || el.tagName
      out.push({ selector: id })
    })
    return out
  })
}

async function findMissingData(page: Page): Promise<string[]> {
  // A minimal heuristic: any <table> with zero rows AND no [data-empty]
  // sibling. Pages that render an empty state via EmptyCard / EmptyState
  // mark it with data-empty so we know it's intentional.
  return page.evaluate(() => {
    const issues: string[] = []
    document.querySelectorAll('table').forEach((t) => {
      const rows = t.querySelectorAll('tbody tr').length
      if (rows > 0) return
      const parent = t.closest('[data-empty]')
      if (parent) return
      const hasEmptySibling = !!t.parentElement?.querySelector('[data-empty]')
      if (!hasEmptySibling) {
        issues.push('table has zero rows and no [data-empty] hint nearby')
      }
    })
    return issues
  })
}

for (const route of AUDIT_ROUTES) {
  test(`runtime-audit @ ${route.hash}`, async ({ page }) => {
    test.setTimeout(45_000)

    const entry: RouteEntry = {
      route: route.hash,
      slug: route.slug,
      tier: route.tier,
      console_errors: [],
      failed_requests: [],
      dead_clicks: [],
      missing_data: [],
      screenshot: null,
      rendered: false,
    }

    page.on('console', (msg) => {
      if (msg.type() !== 'error') return
      const text = msg.text()
      if (isAllowlistedError(text)) return
      entry.console_errors.push({ text, source: msg.location().url })
    })
    page.on('pageerror', (err) => {
      const text = err.message
      if (isAllowlistedError(text)) return
      entry.console_errors.push({ text, source: 'pageerror' })
    })
    page.on('requestfailed', (req) => {
      const url = req.url()
      // Ignore HMR / dev-server URLs.
      if (url.includes('/@vite/') || url.includes('?import')) return
      entry.failed_requests.push({ url, status: 0 })
    })
    page.on('response', async (resp) => {
      const url = resp.url()
      if (url.includes('/@vite/') || url.includes('?import')) return
      if (resp.status() >= 500) {
        entry.failed_requests.push({ url, status: resp.status() })
      }
    })

    try {
      await page.goto(`/sitesync-pm/#${route.hash}`, { waitUntil: 'domcontentloaded' })
      await settle(page)
      entry.rendered = true

      entry.dead_clicks = await findDeadClicks(page)
      entry.missing_data = await findMissingData(page)

      fs.mkdirSync(SHOTS_DIR, { recursive: true })
      const shotPath = path.join(SHOTS_DIR, `${route.slug}.png`)
      await page.screenshot({ path: shotPath, fullPage: false }).catch(() => undefined)
      entry.screenshot = path.relative(REPO_ROOT, shotPath)
    } catch (err) {
      entry.console_errors.push({ text: `[harness] ${(err as Error).message}`, source: 'harness' })
    } finally {
      allEntries.push(entry)
    }

    // The audit never fails on findings — it just records them. CI reads
    // the JSON and decides which severity blocks the merge.
    expect(true).toBe(true)
  })
}

test.afterAll(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const payload = {
    generated_at: new Date().toISOString(),
    routes: allEntries.sort((a, b) => a.tier - b.tier || a.slug.localeCompare(b.slug)),
  }
  fs.writeFileSync(JSON_PATH, JSON.stringify(payload, null, 2))
  // eslint-disable-next-line no-console
  console.log(`[runtime-audit] wrote ${path.relative(REPO_ROOT, JSON_PATH)} with ${allEntries.length} route(s)`)
})
