// health — BRT subsystem 7 §4.7 (I5 invariant)
//
// Minimal heartbeat endpoint. Returns 200 + JSON when the edge runtime,
// Postgres, and basic auth wiring are all reachable. BetterStack /
// Uptimekuma / Pingdom poll this every 30s; a missed beat triggers a
// page.
//
// No auth required — this is the canary external monitors hit. The
// response intentionally exposes only liveness + DB ping latency,
// nothing sensitive.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const STARTED_AT = Date.now()

Deno.serve(async () => {
  const t0 = performance.now()
  let dbOk = false
  let dbMs: number | null = null

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )
    const dbT0 = performance.now()
    // Cheapest possible round-trip: query a view we know exists.
    const { error } = await supabase
      .from('v_rls_table_coverage')
      .select('table_name', { head: true, count: 'exact' })
      .limit(1)
    dbMs = Math.round(performance.now() - dbT0)
    dbOk = !error
  } catch (_err) {
    dbOk = false
  }

  const totalMs = Math.round(performance.now() - t0)
  const uptimeSec = Math.round((Date.now() - STARTED_AT) / 1000)

  return new Response(
    JSON.stringify({
      ok: dbOk,
      db_ms: dbMs,
      total_ms: totalMs,
      uptime_sec: uptimeSec,
      ts: new Date().toISOString(),
    }),
    {
      status: dbOk ? 200 : 503,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    },
  )
})
