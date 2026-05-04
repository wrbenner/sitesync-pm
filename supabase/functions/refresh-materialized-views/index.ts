// =============================================================================
// refresh-materialized-views — cron-driven 5-minute refresh
// =============================================================================
// Calls REFRESH MATERIALIZED VIEW CONCURRENTLY for each tracked view, records
// metadata in view_refresh_metadata so the UI's stale-data banner has
// something to read.
//
// Refresh runs concurrently with reads — readers see the prior snapshot
// until the new one commits. The unique index on each view's project_id
// is what makes CONCURRENTLY work; the migration sets those up.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { authenticateRequest, handleCors, getCorsHeaders, errorResponse } from '../shared/auth.ts'

const VIEWS = [
  'project_health_summary',
  'rfi_kpi_rollup',
  'punch_list_status_rollup',
  'pay_app_status_summary',
] as const

Deno.serve(async (req) => {
  const cors = handleCors(req); if (cors) return cors
  try {
    const { supabaseUrl, serviceKey } = await authenticateRequest(req)
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const results: Array<{ view: string; durationMs: number; status: string; error?: string }> = []

    for (const view of VIEWS) {
      const startedAt = new Date().toISOString()
      // Mark refresh started so the freshness reporter shows 'running'
      await supabase.from('view_refresh_metadata').update({
        last_refresh_started_at: startedAt,
        last_refresh_status: 'running',
        updated_at: startedAt,
      }).eq('view_name', view)

      const t0 = Date.now()
      // Use the SQL RPC pathway since supabase-js can't call REFRESH directly.
      // We require the project to expose an `admin_refresh_view(text)` RPC for
      // this; absent that, use raw fetch against the Postgrest /rpc endpoint.
      let status = 'success'
      let errorMsg: string | undefined
      try {
        const rpc = await fetch(`${supabaseUrl}/rest/v1/rpc/admin_refresh_view`, {
          method: 'POST',
          headers: {
            apikey: serviceKey,
            authorization: `Bearer ${serviceKey}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ view_name: view }),
        })
        if (!rpc.ok) {
          status = 'failed'
          errorMsg = `${rpc.status} ${await rpc.text()}`
        }
      } catch (e) {
        status = 'failed'
        errorMsg = e instanceof Error ? e.message : String(e)
      }
      const durationMs = Date.now() - t0

      await supabase.from('view_refresh_metadata').update({
        last_refresh_completed_at: new Date().toISOString(),
        last_refresh_status: status,
        last_refresh_duration_ms: durationMs,
        last_error: errorMsg ?? null,
        updated_at: new Date().toISOString(),
      }).eq('view_name', view)

      results.push({ view, durationMs, status, error: errorMsg })
    }

    return new Response(
      JSON.stringify({ results }),
      { status: 200, headers: { ...getCorsHeaders(req), 'content-type': 'application/json' } },
    )
  } catch (err) {
    return errorResponse(err, req)
  }
})
