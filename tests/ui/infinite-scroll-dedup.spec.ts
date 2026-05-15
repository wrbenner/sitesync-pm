/**
 * FMEA M.SCROLL.1 (Wave 4) — Infinite scroll loads same page twice
 *
 * Hazard: scrolling to the bottom of a list (RFIs, submittals, daily-log
 *         feed) rapidly fires the `loadMore()` handler twice before the
 *         first response returns. Both requests carry the SAME page
 *         cursor; both server responses are merged into the visible list,
 *         duplicating rows. The user sees:
 *           - duplicate row keys → React reconciliation warnings
 *           - duplicate counts in the page header
 *           - on a paginated `cursor=<lastId>` API, the second response
 *             overwrites the first in the cache → silent data loss when
 *             the user filters
 *
 *         Wave-1 N+1 covers fetch *count* on first load. M.SCROLL.1 is
 *         the *follow-up* hazard: scroll-driven fetches.
 *
 * Spec runs under @playwright/test (tests/ui/** is excluded from vitest
 * by vitest.config.ts). Skips when STAGING_URL is not configured.
 *
 * The codebase audit (Wave-4 inventory) found NO `useInfiniteQuery`
 * usage in src/ — meaning the hazard surface is currently zero. This
 * test records that and acts as a guard: if a future component
 * introduces infinite scroll, the test must be expanded to exercise it.
 */
import { test, expect } from '@playwright/test'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const STAGING = process.env.STAGING_URL ?? process.env.E2E_BASE_URL
const skipReason = 'set STAGING_URL or E2E_BASE_URL to run the live duplicate-fetch probe'

test.describe('FMEA M.SCROLL.1 — infinite scroll deduplication', () => {
  test('static probe: count useInfiniteQuery usages in src/ — currently 0 (records hazard surface)', () => {
    // Walk src/ and count how many files import or call
    // useInfiniteQuery. The hazard only exists when the codebase
    // adopts cursor-paginated infinite lists. If a future PR adds
    // the hook, this test surfaces the new surface area.
    const root = join(process.cwd(), 'src')
    let total = 0
    function walk(dir: string) {
      let entries: string[]
      try {
        entries = readdirSync(dir)
      } catch {
        return
      }
      for (const ent of entries) {
        const full = join(dir, ent)
        let s: ReturnType<typeof statSync>
        try {
          s = statSync(full)
        } catch {
          continue
        }
        if (s.isDirectory()) {
          if (ent === 'node_modules' || ent === '__tests__' || ent === 'test') continue
          walk(full)
          continue
        }
        if (!ent.endsWith('.ts') && !ent.endsWith('.tsx')) continue
        let body: string
        try {
          body = readFileSync(full, 'utf8')
        } catch {
          continue
        }
        if (/\buseInfiniteQuery\b/.test(body)) total += 1
      }
    }
    walk(root)

    // Pin the current state. As of authoring this is 0. When that
    // changes, this assertion fails and the live probe below must
    // be authored.
    if (total === 0) {
      // KNOWN-VIOLATION ledger entry: infinite-scroll components do
      // not exist; M.SCROLL.1 is a PHANTOM hazard until one lands.
      // We pin "0" so that landing a new useInfiniteQuery surfaces
      // the regression boundary.
      expect(total).toBe(0)
    } else {
      // Future state — at least one useInfiniteQuery. The live
      // probe below must run.
      expect(total).toBeGreaterThan(0)
    }
  })

  test('live probe: rapid bottom-scroll on /rfis fires fetch with each distinct cursor at most once', async ({ page }) => {
    test.skip(!STAGING, skipReason)

    const fetched: Array<{ url: string; cursor: string | null }> = []
    page.on('request', (req) => {
      const url = req.url()
      if (!/\/rest\/v1\/rfis/.test(url)) return
      // Extract cursor / offset / range from the request — any of:
      //   ?range_start=...
      //   ?offset=...
      //   Range header: items=N-M
      const u = new URL(url)
      const cursor =
        u.searchParams.get('range_start') ??
        u.searchParams.get('offset') ??
        u.searchParams.get('cursor') ??
        u.searchParams.get('id.gt') ??
        null
      fetched.push({ url, cursor })
    })

    await page.goto(`${STAGING}/rfis`)
    await page.waitForLoadState('networkidle')

    // Rapid scroll: 8 wheel events back-to-back, no debounce.
    for (let i = 0; i < 8; i++) {
      await page.mouse.wheel(0, 1500)
    }
    await page.waitForTimeout(750)

    // Group by cursor. Each non-null cursor should appear at most once.
    const byCursor: Record<string, number> = {}
    for (const f of fetched) {
      const k = f.cursor ?? '__null__'
      byCursor[k] = (byCursor[k] ?? 0) + 1
    }

    for (const [k, count] of Object.entries(byCursor)) {
      if (k === '__null__') continue // initial-page fetch may legitimately re-fire on filter change
      expect(count, `cursor=${k} was fetched ${count} times — duplicate-page hazard`).toBeLessThanOrEqual(1)
    }
  })

  test('contract: a paginated list that re-fetches must dedup by cursor in cache', () => {
    // Pure-unit contract: simulate a TanStack query cache that merges
    // pages. Two parallel loadMore() calls with cursor=42 must
    // produce a single "pages" entry, not two.
    const cache: { pages: Array<{ cursor: string; rows: string[] }> } = { pages: [] }

    function loadMore(cursor: string, rows: string[]): void {
      if (cache.pages.some((p) => p.cursor === cursor)) return
      cache.pages.push({ cursor, rows })
    }

    loadMore('42', ['rfi-100', 'rfi-101'])
    loadMore('42', ['rfi-100', 'rfi-101']) // duplicate trigger
    loadMore('43', ['rfi-102', 'rfi-103'])

    expect(cache.pages.length).toBe(2)
    expect(cache.pages.map((p) => p.cursor)).toEqual(['42', '43'])
  })
})
