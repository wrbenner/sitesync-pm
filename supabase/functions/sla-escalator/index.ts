// ── sla-escalator ───────────────────────────────────────────────────────────
// Idempotent SLA escalation engine for RFIs.
//
// Cron: invoke every hour (or every 15 min during business hours). The
// function queries "what should have escalated by now" — not "what's new
// since last run" — so missed cron runs catch up automatically.
//
// Ladder (business days, weekends + per-project holidays excluded):
//   • -2 days : `t_minus_2`     — soft nudge to assignee
//   •  0 days : `overdue_first` — first overdue email + in-app red rail
//   • +3 days : `cc_manager`    — CC the assignee's parent_contact
//   • +7 days : `delay_risk`    — flag on GC's Day view + draft CO narrative
//
// Each step writes one row to `rfi_escalations` (UNIQUE on rfi_id+stage so
// re-runs no-op) and enqueues a `notification_queue` row that the
// existing notification-processor will deliver. The escalator NEVER
// sends email itself — separation of concerns: this function decides
// "should we escalate?", the notification processor decides "did the
// email send?". Bounces and retries live in the queue.
//
// Skips:
//   • RFI is closed/answered/void                                    (terminal)
//   • RFI has sla_paused_at set                                      (manual pause)
//   • Recipient's directory_contacts.escalation_policy = 'silent'    (in-app only)
//   • Recipient's escalation_policy = 'gentle' AND stage != 'overdue_first'
//
// LAW 12: this runs as service role (cron-invoked, no user). It does not
// authenticate the caller because the caller is the platform itself.
// Anyone hitting it directly with the service role key gets the same
// idempotent behavior — no harm, no duplicate side effects.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleCors, getCorsHeaders, errorResponse } from '../shared/auth.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

type LadderStage = 't_minus_2' | 'overdue_first' | 'cc_manager' | 'delay_risk'

// ── Business-day math (mirror of src/lib/slaCalculator.ts) ────────
// Edge functions don't share TS imports with the SPA — duplicating the
// minimum needed here keeps the function self-contained.

function isWeekend(d: Date): boolean {
  const day = d.getUTCDay()
  return day === 0 || day === 6
}
function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
function businessDaysBetween(from: Date, to: Date, holidays: Set<string>): number {
  const sign = to.getTime() < from.getTime() ? -1 : 1
  const start = sign === 1 ? new Date(from) : new Date(to)
  const end = sign === 1 ? new Date(to) : new Date(from)
  start.setUTCHours(0, 0, 0, 0)
  end.setUTCHours(0, 0, 0, 0)
  let count = 0
  const cursor = new Date(start)
  while (cursor.getTime() < end.getTime()) {
    cursor.setUTCDate(cursor.getUTCDate() + 1)
    if (isWeekend(cursor)) continue
    if (holidays.has(toIsoDate(cursor))) continue
    count += 1
  }
  return sign === 1 ? count : -count
}

function ladderForRemaining(remaining: number): LadderStage | null {
  if (remaining >= 1) {
    // Within T-2 zone? (remaining is 1 or 2 business days)
    return remaining <= 2 ? 't_minus_2' : null
  }
  // remaining <= 0 means overdue
  const overdue = -remaining
  if (overdue <= 2) return 'overdue_first'
  if (overdue <= 6) return 'cc_manager'
  return 'delay_risk'
}

// ── Main ──────────────────────────────────────────────────────────

interface RfiCandidate {
  id: string
  project_id: string
  number: number
  title: string
  status: string
  ball_in_court: string | null
  assigned_to: string | null
  response_due_date: string | null
  due_date: string | null
  sla_paused_at: string | null
}

interface ContactPolicy {
  user_id: string
  email: string | null
  escalation_policy: 'gentle' | 'standard' | 'silent'
  parent_contact_id: string | null
  parent_email: string | null
}

interface EscalatorResult {
  scanned: number
  fired: number
  skipped: number
  errors: string[]
}

async function runEscalator(): Promise<EscalatorResult> {
  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const result: EscalatorResult = { scanned: 0, fired: 0, skipped: 0, errors: [] }

  // 1. Pull every open/under-review RFI with a due date.
  const { data: rfis, error: rfisErr } = await sb
    .from('rfis')
    .select(
      'id, project_id, number, title, status, ball_in_court, assigned_to, response_due_date, due_date, sla_paused_at',
    )
    .in('status', ['draft', 'open', 'under_review'])
    .or('response_due_date.not.is.null,due_date.not.is.null')
  if (rfisErr) {
    result.errors.push(`fetch rfis: ${rfisErr.message}`)
    return result
  }
  result.scanned = rfis?.length ?? 0
  if (!rfis || rfis.length === 0) return result

  // 2. Per project, fetch the holiday calendar once.
  const projectIds = Array.from(new Set(rfis.map((r) => r.project_id)))
  const { data: holidayRows } = await sb
    .from('project_holidays')
    .select('project_id, holiday_date')
    .or(`project_id.in.(${projectIds.join(',')}),project_id.is.null`)
  const holidaysByProject = new Map<string, Set<string>>()
  for (const row of holidayRows ?? []) {
    const pid = (row.project_id as string | null) ?? '*'
    if (!holidaysByProject.has(pid)) holidaysByProject.set(pid, new Set())
    holidaysByProject.get(pid)!.add(row.holiday_date as string)
  }
  const globalHolidays = holidaysByProject.get('*') ?? new Set<string>()

  // 3. Bulk-load existing escalation rows for these RFIs so we can answer
  //    "has this rfi already received this stage?" without N+1 queries.
  const rfiIds = rfis.map((r) => r.id)
  const { data: priorEscalations } = await sb
    .from('rfi_escalations')
    .select('rfi_id, stage')
    .in('rfi_id', rfiIds)
  const firedKey = new Set<string>()
  for (const e of priorEscalations ?? []) {
    firedKey.add(`${e.rfi_id}:${e.stage}`)
  }

  const now = new Date()

  // 4. Walk each RFI; decide whether a new ladder rung is due.
  for (const rfi of rfis as RfiCandidate[]) {
    if (rfi.sla_paused_at) {
      result.skipped += 1
      continue
    }
    const dueIso = rfi.response_due_date ?? rfi.due_date
    if (!dueIso) {
      result.skipped += 1
      continue
    }
    const due = new Date(dueIso)
    if (Number.isNaN(due.getTime())) {
      result.skipped += 1
      continue
    }

    const projHolidays = new Set<string>([
      ...globalHolidays,
      ...(holidaysByProject.get(rfi.project_id) ?? []),
    ])
    const remaining = businessDaysBetween(now, due, projHolidays)
    const stage = ladderForRemaining(remaining)
    if (!stage) {
      result.skipped += 1
      continue
    }

    // Idempotency: skip if this RFI already has this stage logged.
    if (firedKey.has(`${rfi.id}:${stage}`)) {
      result.skipped += 1
      continue
    }

    const policy = await resolvePolicy(sb, rfi)
    if (policy.escalation_policy === 'silent') {
      // In-app only; we still log the escalation so the audit trail is
      // intact, but we don't enqueue an email.
      await logEscalation(sb, rfi, stage, 'in_app', policy, null)
      result.fired += 1
      continue
    }
    if (policy.escalation_policy === 'gentle' && stage !== 'overdue_first') {
      // Gentle policy: only the first-overdue mail; no T-2 nudge,
      // no CC manager, no delay-risk flag.
      result.skipped += 1
      continue
    }

    // Enqueue the email; record the escalation row pointing to the queue id.
    try {
      const queueId = await enqueueEscalationEmail(sb, rfi, stage, policy)
      await logEscalation(sb, rfi, stage, 'email', policy, queueId)
      result.fired += 1
    } catch (err) {
      result.errors.push(`rfi ${rfi.id} stage ${stage}: ${(err as Error).message}`)
    }
  }

  return result
}

async function resolvePolicy(
  sb: ReturnType<typeof createClient>,
  rfi: RfiCandidate,
): Promise<ContactPolicy> {
  const userId = rfi.ball_in_court ?? rfi.assigned_to
  if (!userId) {
    return { user_id: '', email: null, escalation_policy: 'standard', parent_contact_id: null, parent_email: null }
  }
  // Try directory_contacts first (user-id lookup is by email match below).
  const { data: profile } = await sb
    .from('user_profiles')
    .select('id, email')
    .eq('id', userId)
    .maybeSingle()
  const email = (profile?.email as string | null) ?? null

  let policy: 'gentle' | 'standard' | 'silent' = 'standard'
  let parentContactId: string | null = null
  let parentEmail: string | null = null
  if (email) {
    const { data: contact } = await sb
      .from('directory_contacts')
      .select('id, escalation_policy, parent_contact_id')
      .eq('project_id', rfi.project_id)
      .eq('email', email)
      .maybeSingle()
    if (contact) {
      policy = (contact.escalation_policy as 'gentle' | 'standard' | 'silent') ?? 'standard'
      parentContactId = (contact.parent_contact_id as string | null) ?? null
      if (parentContactId) {
        const { data: parent } = await sb
          .from('directory_contacts')
          .select('email')
          .eq('id', parentContactId)
          .maybeSingle()
        parentEmail = (parent?.email as string | null) ?? null
      }
    }
  }
  return {
    user_id: userId,
    email,
    escalation_policy: policy,
    parent_contact_id: parentContactId,
    parent_email: parentEmail,
  }
}

async function enqueueEscalationEmail(
  sb: ReturnType<typeof createClient>,
  rfi: RfiCandidate,
  stage: LadderStage,
  policy: ContactPolicy,
): Promise<string | null> {
  if (!policy.email) return null

  // CC the parent contact for cc_manager and delay_risk stages.
  const ccParent = (stage === 'cc_manager' || stage === 'delay_risk') && policy.parent_email
    ? policy.parent_email
    : null

  const templateName = `rfi_escalation_${stage}`
  const subject =
    stage === 't_minus_2'   ? `Reminder: RFI #${rfi.number} response due in 2 days` :
    stage === 'overdue_first' ? `Overdue: RFI #${rfi.number} response is past due` :
    stage === 'cc_manager'    ? `Escalation: RFI #${rfi.number} 3+ days overdue (CC manager)` :
                                `Delay risk: RFI #${rfi.number} 7+ days overdue — schedule impact pending`

  const { data: queued, error } = await sb
    .from('notification_queue')
    .insert({
      project_id: rfi.project_id,
      recipient_email: policy.email,
      recipient_user_id: policy.user_id,
      template_name: templateName,
      template_data: {
        rfi_id: rfi.id,
        rfi_number: rfi.number,
        rfi_title: rfi.title,
        cc_parent_email: ccParent,
        subject,
      },
      entity_type: 'rfi',
      entity_id: rfi.id,
      status: 'pending',
      // Canonical column is `attempts` (see migration 20260402200000).
      // Earlier Tab A draft used retry_count which doesn't exist on the
      // current schema and would fail at runtime.
      attempts: 0,
    } as Record<string, unknown>)
    .select('id')
    .single()
  if (error) throw error
  return (queued?.id as string | null) ?? null
}

async function logEscalation(
  sb: ReturnType<typeof createClient>,
  rfi: RfiCandidate,
  stage: LadderStage,
  channel: 'email' | 'in_app',
  policy: ContactPolicy,
  queueId: string | null,
) {
  await sb.from('rfi_escalations').insert({
    rfi_id: rfi.id,
    project_id: rfi.project_id,
    stage,
    channel,
    recipient_email: policy.email,
    recipient_user_id: policy.user_id || null,
    notification_queue_id: queueId,
    metadata: {
      escalation_policy: policy.escalation_policy,
      parent_contact_id: policy.parent_contact_id,
    },
  } as Record<string, unknown>)
}

// ── Handler ─────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsResp = handleCors(req)
  if (corsResp) return corsResp

  try {
    const result = await runEscalator()
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...getCorsHeaders(req) },
    })
  } catch (err) {
    return errorResponse(err, getCorsHeaders(req))
  }
})
