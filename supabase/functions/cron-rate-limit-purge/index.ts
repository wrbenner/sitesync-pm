// cron-rate-limit-purge — BRT subsystem 8 §4.1
//
// Daily cron that purges rate_limit_buckets rows older than 7 days. Returns
// the row count purged so the caller (or the cron infrastructure) can log
// telemetry and detect runaway bucket growth.
//
// Schedule: invoke from supabase pg_cron OR an external scheduler at ~03:00 UTC.
//
// Auth: requires CRON_SECRET (existing pattern in supabase/functions/shared/auth.ts).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { authenticateCron, errorResponse, HttpError } from '../shared/auth.ts'

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') {
      throw new HttpError(405, 'Method not allowed')
    }
    authenticateCron(req)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const { data, error } = await supabase.rpc('purge_rate_limit_buckets')
    if (error) {
      throw new HttpError(500, `purge_rate_limit_buckets failed: ${error.message}`)
    }

    return new Response(
      JSON.stringify({ purged: data ?? 0, ran_at: new Date().toISOString() }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return errorResponse(err)
  }
})
