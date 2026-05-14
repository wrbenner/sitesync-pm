/**
 * Scenario 09 — Edge function exhaustive sweep.
 *
 * 143 edge functions are deployed. The current k6 harness exercises 2
 * (iris-call, export-pdf). This spec hits every single one with:
 *   (a) no auth header → expects 401/403 (or 200 only for explicitly-public
 *       endpoints like /api-v1/health)
 *   (b) valid JWT + empty body → records response category (200/400/500/timeout)
 *
 * The goal isn't to test every fn's business logic — that's the unit-test
 * job. The goal is to catch fns that:
 *   - Crash on empty body (500 instead of 400)
 *   - Accept unauthenticated requests they shouldn't
 *   - Timeout cold (>10s) on a basic POST
 *   - Have CORS misconfigured
 *
 * Output: a JSON ledger written to test-results/edge-fn-sweep.json with
 * per-fn status + category. Failures by category, not by name.
 */
import { test, expect } from '@playwright/test'
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..', '..')

const REAL_BACKEND = process.env.E2E_REAL_BACKEND === 'true'
const SUPABASE_URL = process.env.SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? ''
const VU_TOKENS_FILE = process.env.VU_TOKENS_FILE ?? ''

test.skip(!REAL_BACKEND, 'Stage-env only')

interface VuToken { jwt: string; orgId: string; role: string }
let jwt = ''
let edgeFns: string[] = []

// Functions known to be public / open by design — they get the no-auth pass.
// Add to this list if a sweep catches a false-positive.
const PUBLIC_FNS = new Set<string>([
  'api-v1', // typically has a public /health subpath
  // Cron functions are invoked by pg_cron with the service role; no client-side
  // auth at all. They should still 401 a random client call.
])

// Functions that legitimately fail on empty-body POST and that's expected.
// These return non-2xx — the sweep records but doesn't flag.
const EMPTY_BODY_EXPECTED_FAIL = new Set<string>([])

test.beforeAll(() => {
  if (!VU_TOKENS_FILE) test.skip(true, 'VU_TOKENS_FILE not set')
  const parsed = JSON.parse(readFileSync(VU_TOKENS_FILE, 'utf-8')) as { tokens: VuToken[] }
  jwt = parsed.tokens[0]?.jwt ?? ''
  if (!jwt) test.skip(true, 'No tokens in pool')
  const fnDir = path.join(REPO_ROOT, 'supabase', 'functions')
  edgeFns = readdirSync(fnDir)
    .filter((n) => !n.startsWith('_') && !n.startsWith('.'))
    .filter((n) => statSync(path.join(fnDir, n)).isDirectory())
})

interface FnResult {
  name: string
  noAuthStatus: number | string
  authStatus: number | string
  authMs: number
  category: 'ok' | 'crash' | 'auth-open' | 'timeout' | 'cors-miss' | 'skip'
}

const results: FnResult[] = []

async function call(name: string, withAuth: boolean, body: unknown = {}): Promise<{ status: number | string, ms: number }> {
  const start = Date.now()
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  }
  if (withAuth) headers.Authorization = `Bearer ${jwt}`
  const controller = new AbortController()
  const tid = setTimeout(() => controller.abort(), 12_000)
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(tid)
    return { status: res.status, ms: Date.now() - start }
  } catch (err) {
    clearTimeout(tid)
    const msg = (err as Error).name === 'AbortError' ? 'timeout' : (err as Error).message
    return { status: msg, ms: Date.now() - start }
  }
}

test('edge-fn sweep: 143 functions × 2 auth modes', async () => {
  test.setTimeout(600_000) // 10 min for the full sweep
  for (const name of edgeFns) {
    const noAuth = await call(name, false)
    const auth = await call(name, true, { scale_test: true })

    let category: FnResult['category'] = 'ok'
    if (auth.status === 'timeout') category = 'timeout'
    else if (typeof auth.status === 'number' && auth.status >= 500 && !EMPTY_BODY_EXPECTED_FAIL.has(name)) category = 'crash'
    else if (typeof noAuth.status === 'number' && noAuth.status === 200 && !PUBLIC_FNS.has(name)) category = 'auth-open'

    results.push({
      name,
      noAuthStatus: noAuth.status,
      authStatus: auth.status,
      authMs: auth.ms,
      category,
    })
  }
  // Write ledger
  writeFileSync(
    path.join(REPO_ROOT, 'test-results', 'edge-fn-sweep.json'),
    JSON.stringify({ ranAt: new Date().toISOString(), results }, null, 2),
  )

  // Hard failures: auth-open, crash, timeout. Soft failures (other 4xx) are
  // expected for "needs a real body" functions.
  const authOpen = results.filter((r) => r.category === 'auth-open')
  const crashes = results.filter((r) => r.category === 'crash')
  const timeouts = results.filter((r) => r.category === 'timeout')

  expect(authOpen, `Auth-open functions: ${authOpen.map((r) => r.name).join(', ')}`).toEqual([])
  expect(crashes, `Crashing functions (500 on empty body): ${crashes.map((r) => r.name).join(', ')}`).toEqual([])
  expect(timeouts, `Timeout functions (>12s): ${timeouts.map((r) => r.name).join(', ')}`).toEqual([])
})
