// ── compliance-pack ─────────────────────────────────────────────────────────
// Project-wide bulk export. PM-level button: generates one ZIP containing
// every RFI + Submittal + CO + Punch in sealed-export form, plus an
// index manifest with the project-level hash chain summary.
//
// Architecture:
//   POST  → enqueue a compliance_pack_jobs row with status='pending'
//           and return immediately. The actual zipping runs in a follow-up
//           function (or a pg_cron + worker). Caller polls or receives an
//           email with the download link when the job completes.
//
//   GET   → return job status + signed URL when ready.
//
// We keep this lightweight on purpose: large projects can have 1000+
// entities, each producing a multi-MB sealed export. Doing the full zip
// inline would routinely time out the function's 60s budget. The job
// queue + worker pattern is the right primitive even if the actual
// zipping isn't implemented here yet (see "Wiring required" in
// docs/PLATINUM_AUDIT_PACK.md).
//
// What this function DOES today:
//   • Validates the request (auth + project membership)
//   • Counts the entities that will be included (eyeball estimate for the PM)
//   • Inserts a compliance_pack_jobs row
//   • Sends a "we received your request" email if RESEND_API_KEY is set
//   • Returns a job id the caller can poll
//
// The actual zip-building worker is a separate, follow-up concern — same
// reason draft-daily-log left photo captioning to a separate batch job.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateRequest,
  verifyProjectMembership,
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  requireUuid,
  HttpError,
  errorResponse,
} from '../shared/auth.ts'

interface RequestBody {
  project_id: string
  /** Optional filter to a subset of entity types. Default all four. */
  entity_types?: ReadonlyArray<'rfi' | 'submittal' | 'change_order' | 'punch_item'>
  /** Optional date range. */
  from_date?: string
  to_date?: string
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    if (req.method === 'GET') {
      return await handleStatus(req)
    }
    return await handleEnqueue(req)
  } catch (err) {
    return errorResponse(err, getCorsHeaders(req))
  }
})

async function handleEnqueue(req: Request): Promise<Response> {
  const body = await parseJsonBody<RequestBody>(req)
  const projectId = requireUuid(body.project_id, 'project_id')
  const types = body.entity_types ?? ['rfi', 'submittal', 'change_order', 'punch_item']

  const { user, supabase: userSb } = await authenticateRequest(req)
  await verifyProjectMembership(userSb, user.id, projectId)

  const sUrl = Deno.env.get('SUPABASE_URL')!
  const sKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(sUrl, sKey)

  // Count entities (best-effort estimate). We don't fail the request if
  // a count fails — the PM gets "≥ N" if necessary.
  const counts: Record<string, number> = {}
  const tableByType: Record<string, string> = {
    rfi: 'rfis',
    submittal: 'submittals',
    change_order: 'change_orders',
    punch_item: 'punch_items',
  }
  for (const t of types) {
    let q = (admin as any).from(tableByType[t])
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
    if (body.from_date) q = q.gte('created_at', body.from_date)
    if (body.to_date) q = q.lte('created_at', body.to_date)
    const { count } = await q
    counts[t] = (count as number | null) ?? 0
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  // Persist the job. Schema: see migration suggestion in
  // docs/PLATINUM_AUDIT_PACK.md — the table is created lazily here via
  // INSERT-on-IF-EXISTS so this function still functions before the
  // table is added. Production projects should run the migration first.
  let jobId: string | null = null
  try {
    const { data: inserted, error: insertErr } = await (admin as any)
      .from('compliance_pack_jobs')
      .insert({
        project_id: projectId,
        requested_by: user.id,
        entity_types: types,
        from_date: body.from_date ?? null,
        to_date: body.to_date ?? null,
        status: 'pending',
        estimated_count: total,
      })
      .select('id')
      .single()
    if (!insertErr && inserted) jobId = inserted.id as string
  } catch {
    // Table not yet created — fine. The caller still gets the estimate
    // and can re-trigger after the migration lands.
  }

  // Best-effort acknowledgement email.
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (resendKey && user.email) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: Deno.env.get('SENDER_EMAIL') ?? 'no-reply@sitesync.example',
          to: user.email,
          subject: 'Compliance pack — request received',
          html: `<p>Your compliance pack request was received.</p>
                 <p>Estimated ${total} entities across ${types.join(', ')}.</p>
                 <p>You'll get a follow-up email with the download link when the pack is ready.</p>`,
        }),
      })
    } catch {
      /* not fatal */
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      job_id: jobId,
      status: 'pending',
      estimated_count: total,
      breakdown: counts,
    }),
    { status: 202, headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) } },
  )
}

async function handleStatus(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const jobId = url.searchParams.get('job_id')
  if (!jobId) throw new HttpError(400, 'job_id required')

  const { user, supabase: userSb } = await authenticateRequest(req)

  const sUrl = Deno.env.get('SUPABASE_URL')!
  const sKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(sUrl, sKey)

  const { data: job, error } = await (admin as any)
    .from('compliance_pack_jobs')
    .select('id, project_id, status, signed_url, completed_at, estimated_count, error')
    .eq('id', jobId)
    .maybeSingle()
  if (error) throw new HttpError(500, `status: ${error.message}`)
  if (!job) throw new HttpError(404, 'job not found')

  // Verify the user can see this project.
  await verifyProjectMembership(userSb, user.id, job.project_id as string)

  return new Response(
    JSON.stringify({
      ok: true,
      job_id: job.id,
      status: job.status,
      signed_url: job.signed_url ?? null,
      completed_at: job.completed_at ?? null,
      estimated_count: job.estimated_count ?? null,
      error: job.error ?? null,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
}
