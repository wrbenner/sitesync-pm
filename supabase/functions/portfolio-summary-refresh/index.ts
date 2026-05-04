// portfolio-summary-refresh: refreshes the project_health_summary
// materialized view. Intended to be called by pg_cron every 5 minutes.
//
// Also exposed as a manual endpoint for org admins so the dashboard
// can ask for fresh numbers on demand.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateRequest,
  errorResponse,
  HttpError,
  handleCors,
  getCorsHeaders,
} from '../shared/auth.ts'

Deno.serve(async (req: Request) => {
  const cors = handleCors(req)
  if (cors) return cors
  try {
    // Allow either authed admin or the cron secret bearer.
    const cronSecret = Deno.env.get('CRON_SECRET')
    const headerSecret = req.headers.get('X-Cron-Secret')
    let authedAsCron = false
    if (cronSecret && headerSecret && cronSecret === headerSecret) {
      authedAsCron = true
    }
    if (!authedAsCron) {
      await authenticateRequest(req)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { error } = await supabase.rpc('refresh_project_health_summary')
    if (error) {
      throw new HttpError(500, 'Refresh failed: ' + error.message)
    }
    return new Response(JSON.stringify({ ok: true, refreshed_at: new Date().toISOString() }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
    })
  } catch (e) {
    return errorResponse(e, getCorsHeaders(req))
  }
})
