// cron-error-rate-alert — BRT subsystem 7 §4.4
//
// Hourly sweep that checks the audit_log for elevated error rates and
// audit_incidents for any P0 entries. Fires:
//
//   - alert  if 5xx-equivalent count > 1% of writes in the last hour
//   - page   if any audit_incidents row in last hour with category in
//            (rls_leak, chain_break, key_leak)
//
// Auth: cron-secret-gated.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { authenticateCron, errorResponse, HttpError } from '../shared/auth.ts'
import { postSlackAlert, pageAuditIncident } from '../_shared/slackAlert.ts'

interface IncidentRow {
  id: string
  category: string
  severity: string
  created_at: string
  metadata: Record<string, unknown> | null
}

const PAGE_CATEGORIES = new Set(['rls_leak', 'chain_break', 'key_leak'])

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed')
    authenticateCron(req)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const ranAt = new Date().toISOString()

    // P0 audit incidents
    const { data: incidents } = await supabase
      .from('audit_incidents')
      .select('id, category, severity, created_at, metadata')
      .gte('created_at', oneHourAgo)

    let pagedCount = 0
    for (const inc of (incidents ?? []) as IncidentRow[]) {
      if (PAGE_CATEGORIES.has(inc.category)) {
        await pageAuditIncident(
          inc.category,
          `Severity: ${inc.severity}\nIncident id: ${inc.id}\n${JSON.stringify(inc.metadata ?? {}, null, 2).slice(0, 500)}`,
        )
        pagedCount++
      }
    }

    // 5xx-equivalent rate proxy: count audit_log rows where action='delete'
    // is unusually high (placeholder until edge fns directly write a
    // dedicated error_log table). For Beta the safer signal is the
    // audit_incidents above; this section is a low-confidence heuristic
    // we'll tighten once a proper error_log table ships.
    const { count: writesLastHour } = await supabase
      .from('audit_log')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo)

    const incidentRate = writesLastHour && writesLastHour > 0
      ? ((incidents?.length ?? 0) / writesLastHour) * 100
      : 0

    if (incidentRate > 1.0 && (writesLastHour ?? 0) > 50) {
      await postSlackAlert({
        severity: 'alert',
        title: `Audit incident rate elevated: ${incidentRate.toFixed(2)}% (last hour)`,
        body: `${incidents?.length ?? 0} incidents over ${writesLastHour} writes. Threshold: 1.0% on ≥50 writes.`,
        link: { text: 'View audit_incidents', url: 'https://supabase.com/dashboard/project/_/editor' },
      })
    }

    return new Response(
      JSON.stringify({
        ran_at: ranAt,
        writes_last_hour: writesLastHour ?? 0,
        incidents_last_hour: incidents?.length ?? 0,
        paged_p0: pagedCount,
        incident_rate_pct: incidentRate.toFixed(2),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return errorResponse(err)
  }
})
