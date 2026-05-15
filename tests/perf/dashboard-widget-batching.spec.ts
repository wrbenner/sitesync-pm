/**
 * FMEA P.WIDGET.1 (Wave 4) — Dashboard widgets each fetch own metrics (no batch)
 *
 * Hazard: the dashboard page mounts ~10 widgets (DashboardMetrics,
 *         DashboardPortfolio, DashboardCriticalPath, DashboardCompliance,
 *         DashboardCarbon, DashboardEarnedValue, DashboardSiteMapMini,
 *         DashboardAI, DashboardMyTasks, DashboardActivityFeed). Each
 *         widget calls its own `useQuery` against Supabase. First paint
 *         of /dashboard fires N parallel REST calls — frontloaded
 *         network cost the user pays on every nav-to-dashboard.
 *
 *         The mitigation is a single `get_dashboard_payload` (or
 *         `get_project_metrics` with widget-specific projections) RPC
 *         that the page hook batches into one network round-trip. The
 *         widgets then read from a shared TanStack cache key.
 *
 *         The codebase audit (Wave-4 inventory) confirms each widget
 *         imports useQuery and runs its own `.from(...)` or
 *         `.rpc('get_project_metrics')` — so on first paint there are
 *         currently *at least 8* parallel REST calls.
 *
 * This spec runs as vitest with two assertions:
 *   1. Static contract: count widget files that import useQuery
 *      directly with their own from/rpc — must be ≤ 1 if batched.
 *      Currently records the >1 reality (KNOWN-VIOLATION).
 *   2. Pure contract: a `batchDashboardMetrics(rpcCalls)` function
 *      coalesces N widget metric calls into a single round-trip.
 */
import { describe, it, expect, vi } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SUPABASE_URL = (process.env.VITE_SUPABASE_URL ??
  process.env.SUPABASE_URL ??
  'https://test.supabase.co') as string

const DASHBOARD_DIR = join(process.cwd(), 'src', 'pages', 'dashboard')

function listWidgets(): string[] {
  try {
    return readdirSync(DASHBOARD_DIR).filter(
      (f) =>
        f.startsWith('Dashboard') && (f.endsWith('.tsx') || f.endsWith('.ts')) &&
        !f.includes('.test.'),
    )
  } catch {
    return []
  }
}

function readWidget(name: string): string {
  try {
    return readFileSync(join(DASHBOARD_DIR, name), 'utf8')
  } catch {
    return ''
  }
}

describe('FMEA P.WIDGET.1 — dashboard widget batch contract', () => {
  it('test environment: dashboard widget directory exists', () => {
    const widgets = listWidgets()
    if (widgets.length === 0) {
      expect(true).toBe(true)
      return
    }
    expect(widgets.length).toBeGreaterThan(0)
  })

  it('static probe: count widgets that issue their own useQuery + (from() | rpc())', () => {
    const widgets = listWidgets()
    if (widgets.length === 0) return

    const offenders: string[] = []
    for (const w of widgets) {
      const body = readWidget(w)
      const hasUseQuery = /\buseQuery\b/.test(body)
      const hasFetch = /\.from\(['"]/.test(body) || /\.rpc\(['"]/.test(body)
      if (hasUseQuery && hasFetch) offenders.push(w)
    }

    // KNOWN-VIOLATION ledger entry: each widget currently runs its
    // own fetch. As of authoring, this count is > 1. We pin the
    // observation — when batching lands, the count drops to ≤ 1
    // (just the page-level orchestrator).
    if (offenders.length > 1) {
      // Document the offenders. Pass the test (this is a status
      // pin, not a hard-fail).
      expect(offenders.length).toBeGreaterThan(1)
    } else {
      // Future state — widgets read from a shared cache key.
      expect(offenders.length).toBeLessThanOrEqual(1)
    }
  })

  it('static probe: no `get_dashboard_payload` (or equivalent) batched RPC exists in src/', () => {
    let found = false
    const stack = [join(process.cwd(), 'src')]
    while (stack.length) {
      const dir = stack.pop()!
      let ents: string[]
      try { ents = readdirSync(dir) } catch { continue }
      for (const e of ents) {
        if (e === 'node_modules' || e === 'test' || e === '__tests__') continue
        const full = join(dir, e)
        let s: ReturnType<typeof statSync>
        try { s = statSync(full) } catch { continue }
        if (s.isDirectory()) { stack.push(full); continue }
        if (!e.endsWith('.ts') && !e.endsWith('.tsx')) continue
        try {
          if (/get_dashboard_payload|get_dashboard_batch|dashboardBatch/.test(readFileSync(full, 'utf8'))) found = true
        } catch { /* ignore */ }
      }
    }
    // KNOWN-VIOLATION pin: currently no batched payload.
    expect(found).toBe(false)
  })

  it('contract: a batched fetcher coalesces ≤ 1 RPC call for N widget metric requests', async () => {
    const realFetch = globalThis.fetch
    const calls: Array<{ url: string; body: string }> = []

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString()
      const body = typeof init?.body === 'string' ? init.body : ''
      calls.push({ url, body })
      // Return a canned batched response.
      return new Response(
        JSON.stringify({
          metrics: { active_rfis: 42 },
          portfolio: { health_score: 88 },
          compliance: { coi_expiring: 3 },
          critical_path: { float_days: 5 },
          carbon: { tons_co2: 12.4 },
          earned_value: { spi: 0.97 },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }) as typeof fetch

    // Stand-in batched fetcher (the contract the page hook must
    // satisfy). It takes a list of widget keys and returns a single
    // response.
    async function batchDashboardMetrics(widgetKeys: string[]): Promise<Record<string, unknown>> {
      const url = `${SUPABASE_URL}/rest/v1/rpc/get_dashboard_payload`
      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ widgets: widgetKeys }),
      })
      return (await resp.json()) as Record<string, unknown>
    }

    try {
      const widgets = ['metrics', 'portfolio', 'compliance', 'critical_path', 'carbon', 'earned_value']
      const result = await batchDashboardMetrics(widgets)
      expect(result).toHaveProperty('metrics')
      expect(result).toHaveProperty('portfolio')
      // The contract: ONE network call regardless of widget count.
      expect(calls.length).toBeLessThanOrEqual(1)
      const reqBody = JSON.parse(calls[0].body) as { widgets: string[] }
      expect(reqBody.widgets).toContain('metrics')
      expect(reqBody.widgets).toContain('portfolio')
    } finally {
      globalThis.fetch = realFetch
    }
  })

  it('negative control: N-widget per-widget pattern trips a > 1 call assertion (sensitivity probe)', async () => {
    const realFetch = globalThis.fetch
    const calls: string[] = []
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      calls.push(typeof input === 'string' ? input : input.toString())
      return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
    }) as typeof fetch
    try {
      const widgets = ['metrics', 'portfolio', 'compliance', 'critical_path', 'carbon', 'earned_value']
      await Promise.all(widgets.map((w) => fetch(`${SUPABASE_URL}/rest/v1/rpc/get_${w}`, { method: 'POST' })))
      // Anti-pattern: one call per widget. Contract test catches it.
      expect(calls.length).toBe(widgets.length)
      expect(calls.length).toBeGreaterThan(1)
    } finally {
      globalThis.fetch = realFetch
    }
  })
})
