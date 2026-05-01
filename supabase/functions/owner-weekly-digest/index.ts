// owner-weekly-digest — generated weekly via cron + on-demand.

import {
  authenticateRequest,
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  errorResponse,
  verifyProjectMembership,
  requireUuid,
} from '../shared/auth.ts'

interface GenerateRequest {
  project_id: string
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors
  try {
    const { user, supabase } = await authenticateRequest(req)
    const body = await parseJsonBody<GenerateRequest>(req)
    const project_id = requireUuid(body.project_id, 'project_id')
    await verifyProjectMembership(supabase, user.id, project_id)

    const snapshotAt = new Date()
    const periodEnd = snapshotAt
    const periodStart = new Date(snapshotAt.getTime() - 7 * 86400_000)

    const { data: runRow } = await supabase
      .from('document_gen_runs')
      .insert({
        project_id,
        kind: 'owner_weekly_digest',
        snapshot_at: snapshotAt.toISOString(),
        triggered_by: user.id,
      })
      .select('id')
      .single()

    const [{ data: rfis = [] }, { data: cos = [] }, { data: insp = [] }] = await Promise.all([
      supabase.from('rfis').select('id, sent_at, status').eq('project_id', project_id).gte('created_at', periodStart.toISOString()),
      supabase.from('change_orders').select('id, number, title, status, cost_impact').eq('project_id', project_id).gte('created_at', periodStart.toISOString()),
      supabase.from('inspections').select('id, result').eq('project_id', project_id).gte('date', periodStart.toISOString()),
    ])

    const overdueRfis = (rfis ?? []).filter((r: { sent_at: string | null; status: string }) => r.sent_at && r.status !== 'answered' && (Date.now() - new Date(r.sent_at).getTime()) / 86400_000 > 7).length
    const failedInsp = (insp ?? []).filter((i: { result: string }) => i.result === 'fail').length
    const totalCo = (cos ?? []).reduce((s: number, c: { cost_impact: number }) => s + (c.cost_impact || 0), 0)

    const doc = {
      title: 'Weekly digest',
      as_of: snapshotAt.toISOString(),
      sections: [
        {
          heading: 'This week',
          bullets: [
            `${(rfis ?? []).length} new RFIs`,
            `${overdueRfis} RFIs overdue (>7 days)`,
            `${failedInsp} failed inspections`,
            `${(cos ?? []).length} new change orders ($${totalCo.toLocaleString()} total)`,
          ],
        },
      ],
    }

    const enc = new TextEncoder()
    const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(JSON.stringify(doc)))
    const contentHash = Array.from(new Uint8Array(hashBuf)).map((b) => b.toString(16).padStart(2, '0')).join('')

    await supabase
      .from('document_gen_runs')
      .update({ completed_at: new Date().toISOString(), content_hash: contentHash })
      .eq('id', runRow?.id)

    return new Response(JSON.stringify({ run_id: runRow?.id, document: doc }), {
      headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return errorResponse(req, e)
  }
})
