// healthz — BRT subsystem 7 §4.5
//
// Public uptime probe used by:
//   - BetterStack monitor every 60s from 3 regions (status.sitesyncai.com)
//   - Vercel deploy smoke test (scripts/smoke-test.sh)
//   - Internal dashboard
//
// Returns 200 + JSON when all critical dependencies respond.
// Returns 503 + JSON when any critical dependency is degraded.
//
// Dependencies checked (with timeout):
//   - Database (Postgres SELECT 1)
//   - Iris AI chokepoint (HEAD on iris-call OPTIONS)
//
// Auth: PUBLIC. Returns no sensitive info — just dependency liveness.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface ComponentStatus {
  name: string
  status: 'ok' | 'degraded' | 'down'
  latency_ms?: number
  detail?: string
}

interface HealthzResponse {
  status: 'ok' | 'degraded'
  components: ComponentStatus[]
  checked_at: string
  version?: string
}

const CHECK_TIMEOUT_MS = 3000

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  let to: number | undefined
  try {
    return await Promise.race([
      p,
      new Promise<null>((resolve) => {
        to = setTimeout(() => resolve(null), ms) as unknown as number
      }),
    ])
  } finally {
    if (to !== undefined) clearTimeout(to)
  }
}

async function checkDb(): Promise<ComponentStatus> {
  const start = performance.now()
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const result = await withTimeout(
      supabase.from('organizations').select('id', { count: 'exact', head: true }).limit(1),
      CHECK_TIMEOUT_MS,
    )
    const latency = Math.round(performance.now() - start)
    if (!result) return { name: 'database', status: 'down', detail: 'timeout', latency_ms: latency }
    if (result.error) return { name: 'database', status: 'down', detail: result.error.message, latency_ms: latency }
    return { name: 'database', status: 'ok', latency_ms: latency }
  } catch (err) {
    return { name: 'database', status: 'down', detail: err instanceof Error ? err.message : String(err) }
  }
}

async function checkIris(): Promise<ComponentStatus> {
  const start = performance.now()
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const result = await withTimeout(
      fetch(`${supabaseUrl}/functions/v1/iris-call`, { method: 'OPTIONS' }),
      CHECK_TIMEOUT_MS,
    )
    const latency = Math.round(performance.now() - start)
    if (!result) return { name: 'iris-call', status: 'down', detail: 'timeout', latency_ms: latency }
    if (!result.ok && result.status !== 204) {
      return { name: 'iris-call', status: 'degraded', detail: `OPTIONS ${result.status}`, latency_ms: latency }
    }
    return { name: 'iris-call', status: 'ok', latency_ms: latency }
  } catch (err) {
    return { name: 'iris-call', status: 'down', detail: err instanceof Error ? err.message : String(err) }
  }
}

Deno.serve(async (req: Request) => {
  // CORS for browser-based status pages.
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405 })
  }

  const [db, iris] = await Promise.all([checkDb(), checkIris()])
  const components = [db, iris]
  const overall: HealthzResponse['status'] = components.some((c) => c.status === 'down')
    ? 'degraded'
    : 'ok'

  const body: HealthzResponse = {
    status: overall,
    components,
    checked_at: new Date().toISOString(),
    version: Deno.env.get('APP_VERSION') ?? undefined,
  }

  return new Response(JSON.stringify(body), {
    status: overall === 'ok' ? 200 : 503,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, max-age=0',
      'Access-Control-Allow-Origin': '*',
    },
  })
})
