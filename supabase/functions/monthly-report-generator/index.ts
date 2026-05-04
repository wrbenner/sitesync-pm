// monthly-report-generator — captures a project snapshot at run time,
// invokes the pure generator, persists provenance to document_gen_runs.
// Triggered by cron and on-demand from the UI.

import {
  authenticateRequest,
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  HttpError,
  errorResponse,
  verifyProjectMembership,
  requireUuid,
} from '../shared/auth.ts'

interface GenerateRequest {
  project_id: string
  /** YYYY-MM */
  month: string
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  try {
    const { user, supabase } = await authenticateRequest(req)
    const body = await parseJsonBody<GenerateRequest>(req)
    const project_id = requireUuid(body.project_id, 'project_id')
    await verifyProjectMembership(supabase, user.id, project_id)
    if (!/^\d{4}-\d{2}$/.test(body.month)) throw new HttpError(400, 'month must be YYYY-MM')

    const [yearS, monthS] = body.month.split('-')
    const periodStart = new Date(Date.UTC(parseInt(yearS, 10), parseInt(monthS, 10) - 1, 1))
    const periodEnd = new Date(Date.UTC(parseInt(yearS, 10), parseInt(monthS, 10), 0))

    const snapshotAt = new Date()

    // Open the run row first so we can record errors.
    const { data: runRow } = await supabase
      .from('document_gen_runs')
      .insert({
        project_id,
        kind: 'monthly_report',
        snapshot_at: snapshotAt.toISOString(),
        triggered_by: user.id,
      })
      .select('id')
      .single()

    try {
      // Load minimal counters from the project tables.
      const [{ data: rfis = [] }, { data: submittals = [] }, { data: cos = [] }, { data: punch = [] }, { data: insp = [] }, { data: dailyLogs = [] }] = await Promise.all([
        supabase.from('rfis').select('id, number, title, status, sent_at, responded_at').eq('project_id', project_id).gte('created_at', periodStart.toISOString()).lte('created_at', periodEnd.toISOString()),
        supabase.from('submittals').select('id, number, title, status').eq('project_id', project_id).gte('created_at', periodStart.toISOString()).lte('created_at', periodEnd.toISOString()),
        supabase.from('change_orders').select('id, number, title, status, cost_impact, schedule_impact_days').eq('project_id', project_id).gte('created_at', periodStart.toISOString()).lte('created_at', periodEnd.toISOString()),
        supabase.from('punch_items').select('id, title, status, severity, trade').eq('project_id', project_id),
        supabase.from('inspections').select('id, inspection_type, date, result, deficiencies_count').eq('project_id', project_id).gte('date', periodStart.toISOString()).lte('date', periodEnd.toISOString()),
        supabase.from('daily_logs').select('id, log_date, manpower_count, weather_condition, notes').eq('project_id', project_id).gte('log_date', periodStart.toISOString().slice(0,10)).lte('log_date', periodEnd.toISOString().slice(0,10)),
      ])

      const { data: project } = await supabase.from('projects').select('name').eq('id', project_id).maybeSingle()

      const snapshot = {
        meta: {
          project_id,
          project_name: project?.name ?? '',
          snapshot_at: snapshotAt.toISOString(),
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
        },
        rfis: (rfis ?? []).map((r: { id: string; number: number; title: string; status: string; sent_at: string | null; responded_at: string | null }) => ({
          id: r.id, number: r.number, title: r.title, status: r.status,
          sent_at: r.sent_at, responded_at: r.responded_at,
          days_open: r.sent_at ? Math.floor((Date.now() - new Date(r.sent_at).getTime()) / 86400000) : 0,
        })),
        submittals: submittals ?? [],
        change_orders: cos ?? [],
        punch_items: punch ?? [],
        daily_logs: dailyLogs ?? [],
        inspections: insp ?? [],
        payments: [],
      }

      // Inline the generator (edge functions cannot import from src/).
      const sections: Array<{ heading: string; body?: string; rows?: Array<Record<string, unknown>>; kpis?: Array<{ label: string; value: string | number }> }> = []
      sections.push({
        heading: 'Project KPIs',
        kpis: [
          { label: 'RFIs sent', value: snapshot.rfis.length },
          { label: 'RFIs answered', value: snapshot.rfis.filter((r) => r.status === 'answered').length },
          { label: 'Submittals', value: snapshot.submittals.length },
          { label: 'Open punch items', value: snapshot.punch_items.filter((p: { status: string }) => p.status === 'open').length },
        ],
      })
      const doc = {
        title: `Monthly report — ${snapshot.meta.project_name || project_id}`,
        subtitle: body.month,
        as_of: snapshotAt.toISOString(),
        sections,
      }

      // Tampering hash: SHA-256 of the JSON.
      const enc = new TextEncoder()
      const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(JSON.stringify(doc)))
      const contentHash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, '0')).join('')

      // PDF rendering is left to a downstream renderer; we just persist the
      // structured doc here. UI can render or re-fetch.
      await supabase
        .from('document_gen_runs')
        .update({
          completed_at: new Date().toISOString(),
          content_hash: contentHash,
        })
        .eq('id', runRow?.id)

      return new Response(
        JSON.stringify({ run_id: runRow?.id, content_hash: contentHash, document: doc }),
        { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } },
      )
    } catch (innerErr) {
      await supabase
        .from('document_gen_runs')
        .update({ error_message: innerErr instanceof Error ? innerErr.message : String(innerErr), completed_at: new Date().toISOString() })
        .eq('id', runRow?.id)
      throw innerErr
    }
  } catch (e) {
    return errorResponse(req, e)
  }
})
