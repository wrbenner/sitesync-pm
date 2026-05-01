// closeout-package-generator — composes RFI/submittal/CO/punch/inspection
// logs into a closeout document. Snapshot taken at run time.

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
    const { data: runRow } = await supabase
      .from('document_gen_runs')
      .insert({
        project_id,
        kind: 'closeout_package',
        snapshot_at: snapshotAt.toISOString(),
        triggered_by: user.id,
      })
      .select('id')
      .single()

    const [{ data: rfis = [] }, { data: subs = [] }, { data: cos = [] }, { data: punch = [] }, { data: insp = [] }, { data: project }] = await Promise.all([
      supabase.from('rfis').select('id, number, title, status, sent_at, responded_at').eq('project_id', project_id),
      supabase.from('submittals').select('id, number, title, status').eq('project_id', project_id),
      supabase.from('change_orders').select('id, number, title, status, cost_impact').eq('project_id', project_id),
      supabase.from('punch_items').select('id, title, status, severity, trade').eq('project_id', project_id),
      supabase.from('inspections').select('id, inspection_type, date, result, deficiencies_count').eq('project_id', project_id),
      supabase.from('projects').select('name').eq('id', project_id).maybeSingle(),
    ])

    const sections: Array<{ heading: string; body?: string; kpis?: Array<{ label: string; value: string | number }>; rows?: Array<Record<string, unknown>> }> = []

    sections.push({
      heading: 'Project summary',
      body: `Closeout package for ${project?.name ?? project_id}.`,
      kpis: [
        { label: 'Total RFIs', value: (rfis ?? []).length },
        { label: 'Total submittals', value: (subs ?? []).length },
        { label: 'Total COs', value: (cos ?? []).length },
        { label: 'Punch items', value: (punch ?? []).length },
      ],
    })

    if ((punch ?? []).length > 0) {
      const open = (punch as Array<{ title: string; status: string; severity: string; trade: string | null }>).filter((p) => p.status !== 'closed' && p.status !== 'verified')
      sections.push({
        heading: 'Punch list (open)',
        rows: open.map((p) => ({ Title: p.title, Trade: p.trade ?? '—', Severity: p.severity, Status: p.status })),
      })
    }

    const doc = { title: `Closeout package — ${project?.name ?? project_id}`, as_of: snapshotAt.toISOString(), sections }
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
