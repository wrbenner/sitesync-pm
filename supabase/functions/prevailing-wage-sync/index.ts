// =============================================================================
// prevailing-wage-sync — pull DOL Wage Determinations into our table
// =============================================================================
// Cron-driven (weekly). Hits the DOL public API (SAM.gov / WDOL), parses the
// active Davis-Bacon decisions, upserts into prevailing_wage_decisions.
//
// V1 stub: the actual DOL API integration ships when we wire the customer's
// SAM.gov key. The schema + cron slot land now so the data has a place to
// flow when the key arrives.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateRequest, handleCors, getCorsHeaders, errorResponse,
} from '../shared/auth.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req); if (cors) return cors
  try {
    const { supabaseUrl, serviceKey } = await authenticateRequest(req)
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Check the existing rows so we know what to refresh.
    const { count } = await supabase
      .from('prevailing_wage_decisions')
      .select('id', { count: 'exact', head: true })

    // V1: no-op. The DOL fetch happens here once the SAM.gov key is in env.
    // We confirm the table is reachable + report the row count back.
    return new Response(
      JSON.stringify({
        status: 'ok',
        rows_in_table: count,
        note: 'Real DOL sync ships when WAGE_DOL_API_KEY is configured. Schema and cron slot in place.',
      }),
      { status: 200, headers: { ...getCorsHeaders(req), 'content-type': 'application/json' } },
    )
  } catch (err) {
    return errorResponse(err, req)
  }
})
