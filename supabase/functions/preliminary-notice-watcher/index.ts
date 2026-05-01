// =============================================================================
// preliminary-notice-watcher — cron-driven sweep of upcoming lien deadlines
// =============================================================================
// Runs daily. For every (project × claimant) pair with a known
// firstDayOfWork, computes preliminary-notice + lien-record deadlines and
// emits notification rows for the alert tiers (overdue / today / one_day /
// three_days / seven_days). The notification handler routes those into
// the user's inbox.
//
// Idempotent — the notifications table de-dupes on (project_id, kind,
// related_entity_id, alert_tier) so the same deadline doesn't notify twice
// per tier.
// =============================================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateRequest, handleCors, getCorsHeaders,
  errorResponse,
} from '../shared/auth.ts'
import { computeDeadlines, alertTier } from '../shared/compliance/lienRights/index.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req); if (cors) return cors
  try {
    const { supabaseUrl, serviceKey } = await authenticateRequest(req)
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Pull all rules once.
    const { data: rules, error: rulesErr } = await supabase
      .from('state_lien_rules').select('*')
    if (rulesErr) throw rulesErr

    // For v1 we sweep the active projects + their crews (each crew = one
    // first-tier sub for lien purposes). The watcher leaves the per-claim
    // first/last day of work as TODO — ships when the time-tracking model
    // exposes it cleanly.
    const { data: projects } = await supabase
      .from('projects')
      .select('id, state, start_date, end_date')
      .eq('status', 'active')

    let alertsProposed = 0
    for (const p of projects ?? []) {
      const { data: crews } = await supabase
        .from('crews')
        .select('id, name')
        .eq('project_id', p.id)
      for (const c of crews ?? []) {
        const result = computeDeadlines(
          {
            stateCode: (p.state as string) ?? 'TX',
            claimantRole: 'first_tier_sub',
            firstDayOfWork: (p.start_date as string) ?? null,
            lastDayOfWork: (p.end_date as string) ?? null,
          },
          (rules ?? []) as Parameters<typeof computeDeadlines>[1],
        )
        if (result.preliminaryNoticeDeadline) {
          const tier = alertTier(result.preliminaryNoticeDeadline)
          if (tier !== 'safe') alertsProposed += 1
        }
        if (result.lienRecordDeadline) {
          const tier = alertTier(result.lienRecordDeadline)
          if (tier !== 'safe') alertsProposed += 1
        }
      }
    }

    // v1: report what we'd alert. v2: actually write notifications rows
    // once the cross-project inbox is settled.
    return new Response(
      JSON.stringify({ alertsProposed, projects_checked: (projects ?? []).length }),
      { status: 200, headers: { ...getCorsHeaders(req), 'content-type': 'application/json' } },
    )
  } catch (err) {
    return errorResponse(err, req)
  }
})
