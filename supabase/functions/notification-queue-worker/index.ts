// notification-queue-worker — polls notification_queue, sends via Resend,
// logs to outbound_email_log so inbound replies thread back.
//
// This closes the loop between Tab A's sla-escalator (enqueues) and the
// inbound-email function (consumes Reply-To plus-tag + In-Reply-To).
// Without this worker the queue rows would just accumulate and no email
// would ever leave.
//
// Trigger: cron every minute, or manual POST.
// Idempotency: status transitions ('pending' → 'sending' → 'sent' /
//   'failed') with a row-level lock via WHERE status='pending'.
// Retry: failed rows go back to 'pending' with retry_count + 1, until
//   max_retries (default 5). After that they move to 'dead' for triage.

import { serve } from 'https://deno.land/std@0.192.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Threading helpers (kept in sync with src/lib/emailThreading.ts) ──────
// Edge functions can't import from src/, so we copy the small helpers
// here. If src/lib/emailThreading.ts changes, change them here too.
//
// The helpers are pure and dependency-free — there's nothing to drift
// other than the literal address shape.

type ThreadableEntityType = 'rfi' | 'submittal' | 'change_order'

const ALIAS: Record<ThreadableEntityType, string> = {
  rfi: 'rfi',
  submittal: 'sub',
  change_order: 'co',
}

const REPLY_DOMAIN = Deno.env.get('REPLY_DOMAIN') ?? 'reply.sitesync.app'
const MESSAGE_ID_DOMAIN = Deno.env.get('MESSAGE_ID_DOMAIN') ?? 'mail.sitesync.app'
const FROM_ADDRESS = Deno.env.get('RESEND_FROM_ADDRESS') ?? 'SiteSync PM <noreply@sitesync.app>'
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? ''
// `max_attempts` is per-row on the queue (default 3 from the table
// definition). Batch size is the only worker-level tunable here.
const BATCH_SIZE = Number(Deno.env.get('NOTIFICATION_BATCH_SIZE') ?? '20')

function buildReplyToAddress(entityType: ThreadableEntityType, entityId: string): string {
  const alias = ALIAS[entityType]
  return `reply+${alias}-${entityId}@${REPLY_DOMAIN}`
}

function buildMessageId(entityType: ThreadableEntityType, entityId: string): string {
  const random = randomHex(12)
  const alias = ALIAS[entityType]
  return `<${alias}-${entityId}-${random}@${MESSAGE_ID_DOMAIN}>`
}

function buildSubjectWithThreadHint(
  entityType: ThreadableEntityType,
  number: number | string,
  base: string,
): string {
  const label = entityType === 'change_order' ? 'CO' : entityType === 'submittal' ? 'Submittal' : 'RFI'
  return `${label} #${number} — ${base}`
}

function stripAngleBrackets(messageId: string): string {
  return messageId.replace(/^<|>$/g, '').trim()
}

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('')
}

// ── Templates ─────────────────────────────────────────────────────────────
// Minimal text-mode templates for the four SLA stages. Tab A enqueues with
// `template_name = rfi_escalation_<stage>` and `template_data` containing
// at least { rfi_number, rfi_title, cc_parent_email, subject }.
//
// HTML templates can ship later via the existing send-email/templates.ts;
// for the SLA path, plain text is friendlier to architects' enterprise
// mail filters and easier to parse on reply.

interface TemplateData {
  rfi_number?: number | string
  rfi_title?: string
  cc_parent_email?: string | null
  subject?: string
  [k: string]: unknown
}

function renderEscalationBody(stage: string, data: TemplateData): string {
  const num = data.rfi_number ?? '?'
  const title = data.rfi_title ?? '(untitled)'
  const lead = (() => {
    if (stage === 't_minus_2') {
      return `RFI #${num} — "${title}" — is due in 2 business days. A timely response keeps the schedule on track.`
    }
    if (stage === 'overdue_first') {
      return `RFI #${num} — "${title}" — has passed its contractual response window. The clock is being recorded for any future schedule extension claim.`
    }
    if (stage === 'cc_manager') {
      return `RFI #${num} — "${title}" — has been outstanding for more than 3 business days past its due date. We are looping in your team's manager so this can be prioritized.`
    }
    if (stage === 'delay_risk') {
      return `RFI #${num} — "${title}" — has been outstanding for more than 7 business days past its due date. This now constitutes a documented schedule delay risk; a change-order narrative is being drafted for review.`
    }
    return `RFI #${num} requires your attention.`
  })()

  return [
    lead,
    '',
    `Reply directly to this email — your reply will thread automatically onto the RFI in SiteSync.`,
    '',
    `— SiteSync PM`,
  ].join('\n')
}

// ── Resend send ───────────────────────────────────────────────────────────

interface ResendPayload {
  from: string
  to: string[]
  cc?: string[]
  reply_to?: string
  subject: string
  text: string
  headers?: Record<string, string>
}

async function sendViaResend(payload: ResendPayload): Promise<{ ok: boolean; provider_id?: string; error?: string }> {
  if (!RESEND_KEY) {
    return { ok: false, error: 'RESEND_API_KEY not configured' }
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const text = await res.text()
      return { ok: false, error: `resend ${res.status}: ${text}` }
    }
    const json = await res.json()
    return { ok: true, provider_id: json?.id }
  } catch (err) {
    return { ok: false, error: (err as Error).message }
  }
}

// ── Worker loop ───────────────────────────────────────────────────────────

interface QueueRow {
  id: string
  project_id: string
  recipient_email: string
  recipient_user_id: string | null
  template_name: string
  template_data: TemplateData
  entity_type: string | null
  entity_id: string | null
  status: string
  attempts: number
  max_attempts: number
}

const sb = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
)

async function processOne(row: QueueRow): Promise<{ ok: boolean; error?: string }> {
  const stage = row.template_name.replace(/^rfi_escalation_/, '')
  const subject = (row.template_data.subject as string | undefined) ?? `RFI #${row.template_data.rfi_number ?? ''}`
  const body = renderEscalationBody(stage, row.template_data)

  // Build threading metadata when we have an entity reference.
  let replyTo: string | undefined
  let messageId: string | undefined
  let stampedSubject = subject
  if (row.entity_type === 'rfi' || row.entity_type === 'submittal' || row.entity_type === 'change_order') {
    if (row.entity_id) {
      replyTo = buildReplyToAddress(row.entity_type, row.entity_id)
      messageId = buildMessageId(row.entity_type, row.entity_id)
      const num = row.template_data.rfi_number ?? row.entity_id.slice(0, 6)
      stampedSubject = buildSubjectWithThreadHint(
        row.entity_type,
        num as number | string,
        (row.template_data.rfi_title as string) ?? subject,
      )
    }
  }

  const cc = row.template_data.cc_parent_email
    ? [String(row.template_data.cc_parent_email)]
    : undefined

  const result = await sendViaResend({
    from: FROM_ADDRESS,
    to: [row.recipient_email],
    cc,
    reply_to: replyTo,
    subject: stampedSubject,
    text: body,
    headers: messageId ? { 'Message-ID': messageId } : undefined,
  })

  if (!result.ok) return { ok: false, error: result.error }

  // Log to outbound_email_log so inbound-email can match In-Reply-To.
  if (messageId && (row.entity_type === 'rfi' || row.entity_type === 'submittal' || row.entity_type === 'change_order') && row.entity_id) {
    await sb.from('outbound_email_log').insert({
      message_id: stripAngleBrackets(messageId),
      entity_type: row.entity_type,
      entity_id: row.entity_id,
      to_emails: [row.recipient_email, ...(cc ?? [])],
      subject: stampedSubject,
    })
  }

  return { ok: true }
}

serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('method not allowed', { status: 405 })
  }

  // Claim a batch of pending rows. Two-step claim avoids double-send when
  // multiple invocations land within the same minute. The canonical schema
  // uses status='processing' (not 'sending') and attempts/max_attempts
  // (not retry_count/MAX_RETRIES) — see migration 20260402200000.
  const { data: claimed, error: claimErr } = await sb
    .from('notification_queue')
    .update({ status: 'processing', updated_at: new Date().toISOString() })
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE)
    .select('id, project_id, recipient_email, recipient_user_id, template_name, template_data, entity_type, entity_id, status, attempts, max_attempts')

  if (claimErr) {
    return new Response(JSON.stringify({ ok: false, error: claimErr.message }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }

  const rows = (claimed ?? []) as QueueRow[]
  const summary = { claimed: rows.length, sent: 0, failed: 0, dead: 0 }

  for (const row of rows) {
    const r = await processOne(row)
    if (r.ok) {
      await sb
        .from('notification_queue')
        .update({ status: 'sent', sent_at: new Date().toISOString(), error: null, updated_at: new Date().toISOString() })
        .eq('id', row.id)
      summary.sent += 1
    } else {
      const nextAttempts = row.attempts + 1
      const dead = nextAttempts >= row.max_attempts
      await sb
        .from('notification_queue')
        .update({
          // 'failed' is a terminal state in the existing CHECK constraint;
          // 'pending' lets the next worker tick retry. We bounce back to
          // 'pending' until attempts >= max_attempts, then mark 'failed'.
          status: dead ? 'failed' : 'pending',
          attempts: nextAttempts,
          error: r.error?.slice(0, 1000) ?? 'unknown error',
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id)
      if (dead) summary.dead += 1
      else summary.failed += 1
    }
  }

  return new Response(JSON.stringify({ ok: true, ...summary }), {
    headers: { 'content-type': 'application/json' },
  })
})
