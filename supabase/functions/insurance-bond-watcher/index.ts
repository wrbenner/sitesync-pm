// =============================================================================
// insurance-bond-watcher — cross-project COI + bond expiration sweep
// =============================================================================
// A sub on N projects whose COI/bond expires affects N projects. This
// watcher rolls up every active certificate + bond by company so the
// compliance dashboard can show "ABC Plumbing's GL expires in 12 days —
// affects 4 active projects" once instead of four times.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateRequest, handleCors, getCorsHeaders, errorResponse,
} from '../shared/auth.ts'
import { aggregateByCompany } from '../shared/compliance/bonds/index.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req); if (cors) return cors
  try {
    const { supabaseUrl, serviceKey } = await authenticateRequest(req)
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const [{ data: bonds }, { data: cois }] = await Promise.all([
      supabase.from('bonds').select('id, project_id, bond_type, company, bond_amount, effective_date, expiration_date, status').eq('status', 'active'),
      supabase.from('insurance_certificates').select('id, project_id, company, policy_type, expiration_date, verified').not('expiration_date', 'is', null),
    ])

    const bondAgg = aggregateByCompany(
      ((bonds ?? []) as Parameters<typeof aggregateByCompany>[0]),
    )
    // CoIs use a similar tier model — re-shape into the same structure for
    // the dashboard. (Re-using aggregateByCompany would need the COI rows
    // mapped into BondRow shape; we leave that to a thin client adapter.)

    return new Response(
      JSON.stringify({
        bonds_by_company: bondAgg,
        coi_count: (cois ?? []).length,
        // The frontend dashboard pulls cois directly + applies its own tiering.
      }),
      { status: 200, headers: { ...getCorsHeaders(req), 'content-type': 'application/json' } },
    )
  } catch (err) {
    return errorResponse(err, req)
  }
})
