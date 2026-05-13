// rls-policy-drift — BRT subsystem 1 §4.4
//
// Nightly cron that checks the live RLS policy matrix against the Day-4
// baseline locked in docs/audits/RLS_POLICY_MATRIX_2026-05-14.md. Drift
// detection is count-based on three invariants:
//
//   1. Every org-scoped table has RLS enabled (count must be 0).
//   2. Unprotected org-table count must equal 13 (documented exemptions).
//   3. Every non-exempt writable-org-table has 3 restrictive policies
//      (incomplete count must be 0).
//
// On any drift → posts a Slack alert to #brt-alerts AND writes a row to
// audit_incidents with category='rls_leak' so the P0 paging trigger
// (20261009000010) fires.
//
// Auth: cron-secret-gated. Cron schedule: register in Supabase dashboard
// (Database → Cron Jobs → daily 03:00 UTC).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { authenticateCron, errorResponse, HttpError } from '../shared/auth.ts'
import { postSlackAlert } from '../_shared/slackAlert.ts'

const BASELINE = {
  // Sourced from docs/audits/RLS_POLICY_MATRIX_2026-05-14.md (Day 4 lock).
  rls_disabled_org_count: 0,
  unprotected_count: 13,
  writable_restrictive_incomplete: 0,
} as const

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed')
    authenticateCron(req)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const ranAt = new Date().toISOString()

    // Invariant 1: every org-scoped table has RLS enabled.
    const { count: rlsDisabledOrgCount, error: e1 } = await supabase
      .from('v_rls_table_coverage')
      .select('*', { count: 'exact', head: true })
      .eq('has_org_id_column', true)
      .eq('rls_enabled', false)
    if (e1) throw new HttpError(502, `v_rls_table_coverage query failed: ${e1.message}`)

    // Invariant 2: unprotected count matches baseline.
    const { data: unprotected, error: e2 } = await supabase.rpc('find_unprotected_tables')
    if (e2) throw new HttpError(502, `find_unprotected_tables failed: ${e2.message}`)
    const unprotectedCount = Array.isArray(unprotected) ? unprotected.length : 0

    // Invariant 3: writable-restrictive coverage.
    const { count: writableIncomplete, error: e3 } = await supabase
      .from('v_writable_restrictive_coverage')
      .select('*', { count: 'exact', head: true })
      .eq('is_exempt', false)
      .lt('restrictive_policies', 3)
    if (e3) throw new HttpError(502, `v_writable_restrictive_coverage query failed: ${e3.message}`)

    const drift: string[] = []
    if ((rlsDisabledOrgCount ?? 0) !== BASELINE.rls_disabled_org_count) {
      drift.push(`org-scoped tables without RLS: live=${rlsDisabledOrgCount} baseline=${BASELINE.rls_disabled_org_count}`)
    }
    if (unprotectedCount !== BASELINE.unprotected_count) {
      drift.push(`find_unprotected_tables(): live=${unprotectedCount} baseline=${BASELINE.unprotected_count}`)
    }
    if ((writableIncomplete ?? 0) !== BASELINE.writable_restrictive_incomplete) {
      drift.push(`writable-restrictive incomplete: live=${writableIncomplete} baseline=${BASELINE.writable_restrictive_incomplete}`)
    }

    if (drift.length > 0) {
      const summary = drift.join('\n')

      const { error: incErr } = await supabase.rpc('write_audit_incident', {
        p_category: 'rls_leak',
        p_severity: 'high',
        p_metadata: { drift, baseline: BASELINE, ran_at: ranAt },
      })
      if (incErr) console.error('[rls-drift] write_audit_incident failed:', incErr)

      await postSlackAlert({
        severity: 'alert',
        title: 'RLS policy drift detected',
        body: '```\n' + summary + '\n```\n\nRun `npx tsx scripts/rls-matrix-audit.ts --check` locally to reproduce + diff against baseline.',
        context: {
          ran_at: ranAt,
          baseline_source: 'docs/audits/RLS_POLICY_MATRIX_2026-05-14.md',
        },
      })
    }

    return new Response(
      JSON.stringify({
        ok: true,
        ran_at: ranAt,
        baseline: BASELINE,
        live: {
          rls_disabled_org_count: rlsDisabledOrgCount ?? 0,
          unprotected_count: unprotectedCount,
          writable_restrictive_incomplete: writableIncomplete ?? 0,
        },
        drift_count: drift.length,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return errorResponse(err)
  }
})
