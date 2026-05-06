// inbound-email — receives forwarded replies from Resend's inbound webhook
// (or any compatible provider) and threads them onto the right RFI / Submittal /
// Change Order without forcing the sender to log in.
//
// The wedge against Procore: architects refuse to log into a portal. They
// just hit Reply on the email. We have to make Reply *work*.
//
// Threading priority (highest confidence first):
//   1. Reply-to plus-tag.   reply+rfi-<uuid>@reply.sitesync.app  (we set this on send)
//   2. In-Reply-To header.  matches the Message-ID we stamped on the original
//   3. Subject regex.       "RFI #123" / "Submittal #045" — last resort, low confidence
//
// What we do with the parsed reply:
//   - Insert a row into <entity>_responses (or generic comments table) with
//     the email body, the sender (resolved from directory_contacts by email),
//     the inbound_message_id (for future threading), and confidence band.
//   - If the reply contains an answer/approval keyword, suggest a status
//     transition (do NOT auto-apply for low confidence — surface as Iris
//     draft for the GC to approve).
//   - Resume any paused SLA clock if the reply was an OOO response.
//   - Mark any escalation as "resolved" so further reminders stop.
//
// We do NOT silently drop unmatched replies. They go into
// inbound_email_unmatched for manual triage.

import { serve } from 'https://deno.land/std@0.192.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Types ────────────────────────────────────────────────────────────────

type EntityType = 'rfi' | 'submittal' | 'change_order'

interface InboundPayload {
  // Resend's inbound webhook shape (subset we care about). Keep this
  // permissive — different providers use slightly different keys.
  from?: { email?: string; name?: string } | string
  to?: Array<{ email?: string; name?: string }> | string
  subject?: string
  text?: string
  html?: string
  headers?: Record<string, string>
  message_id?: string
  in_reply_to?: string
  references?: string
  // Some providers nest the above under `email` or `data`. We handle that.
  email?: InboundPayload
  data?: InboundPayload
}

interface ThreadingResult {
  entityType: EntityType | null
  entityId: string | null
  confidence: 'high' | 'medium' | 'low' | 'none'
  reason: string
}

// ── Threading logic (pure, testable) ──────────────────────────────────────

const PLUS_TAG_RE = /^reply\+(rfi|submittal|change_order|sub|co)-([0-9a-f-]{6,})@/i

const ENTITY_ALIAS: Record<string, EntityType> = {
  rfi: 'rfi',
  submittal: 'submittal',
  sub: 'submittal',
  change_order: 'change_order',
  co: 'change_order',
}

export function threadFromRecipient(addr: string): ThreadingResult {
  const m = addr.match(PLUS_TAG_RE)
  if (!m) return { entityType: null, entityId: null, confidence: 'none', reason: 'no plus-tag in recipient' }
  const aliasKey = m[1].toLowerCase()
  const entityType = ENTITY_ALIAS[aliasKey] ?? null
  if (!entityType) return { entityType: null, entityId: null, confidence: 'none', reason: `unknown alias ${aliasKey}` }
  return { entityType, entityId: m[2], confidence: 'high', reason: 'plus-tag matched' }
}

const SUBJECT_RE = /(?:RFI|Submittal|Sub|CO|Change\s*Order)\s*#?(\d+)/i
const SUBJECT_TYPE_RE = /(RFI|Submittal|Sub\b|CO\b|Change\s*Order)/i

export function threadFromSubject(subject: string): ThreadingResult {
  const num = subject.match(SUBJECT_RE)
  const ty = subject.match(SUBJECT_TYPE_RE)
  if (!num || !ty) return { entityType: null, entityId: null, confidence: 'none', reason: 'subject does not contain entity ref' }
  const t = ty[1].toLowerCase().replace(/\s+/g, '').replace('changeorder', 'change_order')
  const entityType = (ENTITY_ALIAS[t] ?? null) as EntityType | null
  if (!entityType) return { entityType: null, entityId: null, confidence: 'none', reason: `unknown type ${t} in subject` }
  // Subject only gives us a number, not a UUID. The caller has to map
  // (project_id, entity_type, number) -> entity_id by querying the DB.
  return { entityType, entityId: `:by-number:${num[1]}`, confidence: 'low', reason: 'subject regex match (low confidence — number only)' }
}

export function flatten(payload: InboundPayload): InboundPayload {
  // Some providers nest the data; others put it at top level. Walk one level.
  return payload.email ?? payload.data ?? payload
}

export function extractRecipients(payload: InboundPayload): string[] {
  const p = flatten(payload)
  if (typeof p.to === 'string') return [p.to]
  if (Array.isArray(p.to)) return p.to.map((t) => t.email ?? '').filter(Boolean)
  return []
}

export function extractSenderEmail(payload: InboundPayload): string | null {
  const p = flatten(payload)
  if (typeof p.from === 'string') return p.from
  return p.from?.email ?? null
}

export function extractInReplyTo(payload: InboundPayload): string | null {
  const p = flatten(payload)
  if (p.in_reply_to) return p.in_reply_to
  if (p.headers?.['in-reply-to']) return p.headers['in-reply-to']
  if (p.headers?.['In-Reply-To']) return p.headers['In-Reply-To']
  return null
}

export function isOOOReply(subject: string, body: string): boolean {
  const s = `${subject}\n${body}`.toLowerCase()
  return /\b(out of office|on vacation|on leave|away until|automatic reply|auto[\s-]?reply)\b/.test(s)
}

const APPROVAL_KEYWORDS = /\b(approved?|approve\s*as\s*noted|no\s*exceptions?\s*taken|accept(ed)?)\b/i
const REJECTION_KEYWORDS = /\b(rejected?|reject\s*and\s*resubmit|revise\s*and\s*resubmit|do\s*not\s*proceed)\b/i
const ANSWER_KEYWORDS = /\b(per\s*sketch|see\s*attached\s*detail|use\s*detail|confirmed|please\s*proceed)\b/i

export function suggestStatusTransition(body: string, entityType: EntityType): { suggested: string | null; confidence: 'high' | 'medium' | 'low' } {
  if (REJECTION_KEYWORDS.test(body)) return { suggested: 'rejected', confidence: 'medium' }
  if (APPROVAL_KEYWORDS.test(body)) {
    return entityType === 'submittal'
      ? { suggested: 'approved', confidence: 'medium' }
      : { suggested: 'answered', confidence: 'medium' }
  }
  if (entityType === 'rfi' && ANSWER_KEYWORDS.test(body)) return { suggested: 'answered', confidence: 'low' }
  return { suggested: null, confidence: 'low' }
}

// ── HTTP handler ──────────────────────────────────────────────────────────

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

async function resolveByPlusTag(t: ThreadingResult): Promise<{ entityType: EntityType; entityId: string } | null> {
  if (!t.entityType || !t.entityId) return null
  // entityId from plus-tag is the actual UUID
  return { entityType: t.entityType, entityId: t.entityId }
}

async function resolveByInReplyTo(messageId: string): Promise<{ entityType: EntityType; entityId: string } | null> {
  // We stamp every outbound email with a Message-ID we control and store
  // it in outbound_email_log along with the entity reference. Lookup is
  // by the cleaned <id@host> form.
  const cleaned = messageId.replace(/^<|>$/g, '').trim()
  const { data } = await sb
    .from('outbound_email_log')
    .select('entity_type, entity_id')
    .eq('message_id', cleaned)
    .maybeSingle()
  if (!data) return null
  return { entityType: data.entity_type as EntityType, entityId: data.entity_id as string }
}

async function resolveBySubject(subject: string, projectHint: string | null): Promise<{ entityType: EntityType; entityId: string } | null> {
  const t = threadFromSubject(subject)
  if (!t.entityType || !t.entityId?.startsWith(':by-number:')) return null
  const number = t.entityId.replace(':by-number:', '')
  const table = t.entityType === 'change_order' ? 'change_orders' : `${t.entityType}s`
  let q = sb.from(table).select('id, project_id').eq('number', Number(number)).limit(1)
  if (projectHint) q = q.eq('project_id', projectHint)
  const { data } = await q.maybeSingle()
  if (!data) return null
  return { entityType: t.entityType, entityId: data.id as string }
}

interface ResolutionContext {
  recipients: string[]
  inReplyTo: string | null
  subject: string
  projectHint: string | null
}

async function resolveEntity(ctx: ResolutionContext): Promise<{ entityType: EntityType; entityId: string; confidence: 'high' | 'medium' | 'low'; via: string } | null> {
  for (const r of ctx.recipients) {
    const t = threadFromRecipient(r)
    if (t.confidence === 'high') {
      const res = await resolveByPlusTag(t)
      if (res) return { ...res, confidence: 'high', via: 'plus-tag' }
    }
  }
  if (ctx.inReplyTo) {
    const res = await resolveByInReplyTo(ctx.inReplyTo)
    if (res) return { ...res, confidence: 'medium', via: 'in-reply-to' }
  }
  if (ctx.subject) {
    const res = await resolveBySubject(ctx.subject, ctx.projectHint)
    if (res) return { ...res, confidence: 'low', via: 'subject' }
  }
  return null
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })

  let payload: InboundPayload
  try {
    payload = await req.json()
  } catch {
    return new Response('invalid json', { status: 400 })
  }

  const flat = flatten(payload)
  const recipients = extractRecipients(payload)
  const sender = extractSenderEmail(payload)
  const inReplyTo = extractInReplyTo(payload)
  const subject = (flat.subject ?? '').slice(0, 500)
  const text = (flat.text ?? '').slice(0, 50000)
  const inboundMessageId = flat.message_id ?? null

  // Try to resolve project from sender's directory_contact (if we have
  // them in our address book, we know which project they belong to).
  let projectHint: string | null = null
  if (sender) {
    const { data } = await sb
      .from('directory_contacts')
      .select('project_id')
      .ilike('email', sender)
      .limit(1)
      .maybeSingle()
    projectHint = (data?.project_id as string | undefined) ?? null
  }

  const resolved = await resolveEntity({ recipients, inReplyTo, subject, projectHint })

  if (!resolved) {
    // Don't drop — park for triage.
    await sb.from('inbound_email_unmatched').insert({
      from_email: sender,
      to_emails: recipients,
      subject,
      body_text: text,
      message_id: inboundMessageId,
      in_reply_to: inReplyTo,
      received_at: new Date().toISOString(),
    })
    return new Response(JSON.stringify({ ok: true, matched: false }), {
      headers: { 'content-type': 'application/json' },
    })
  }

  // Detect OOO and pause SLA instead of inserting a real reply.
  if (isOOOReply(subject, text)) {
    await sb.from('rfi_clock_pauses').insert({
      entity_type: resolved.entityType,
      entity_id: resolved.entityId,
      paused_at: new Date().toISOString(),
      reason: `OOO auto-reply detected from ${sender ?? 'unknown sender'}`,
      paused_by_user: null,
    })
    return new Response(JSON.stringify({ ok: true, action: 'sla_paused_ooo' }), {
      headers: { 'content-type': 'application/json' },
    })
  }

  // Insert as a comment on the entity. Generic table — Tab A's
  // rfi_escalations is for outbound; this is inbound.
  await sb.from('inbound_email_replies').insert({
    entity_type: resolved.entityType,
    entity_id: resolved.entityId,
    from_email: sender,
    body_text: text,
    subject,
    message_id: inboundMessageId,
    in_reply_to: inReplyTo,
    threaded_via: resolved.via,
    threading_confidence: resolved.confidence,
    received_at: new Date().toISOString(),
  })

  // Suggest status transition. Only auto-apply at high confidence (plus-tag
  // route + clear approval/rejection keyword). Otherwise leave as Iris draft.
  const sug = suggestStatusTransition(text, resolved.entityType)
  if (sug.suggested && resolved.confidence === 'high' && sug.confidence === 'medium') {
    // Iris draft — not auto-apply. The page renders an approval gate.
    await sb.from('drafted_actions').insert({
      target_entity_type: resolved.entityType,
      target_entity_id: resolved.entityId,
      action_type: 'transition_status',
      action_payload: { to_status: sug.suggested },
      drafted_by: 'inbound-email',
      drafted_at: new Date().toISOString(),
      status: 'pending_approval',
      confidence: sug.confidence,
      citation_text: text.slice(0, 500),
    })
  }

  // Resolve any open escalation for this entity — the architect replied.
  await sb
    .from('rfi_escalations')
    .update({ resolved_at: new Date().toISOString(), resolution_reason: 'inbound reply received' })
    .is('resolved_at', null)
    .eq('entity_type', resolved.entityType)
    .eq('entity_id', resolved.entityId)

  return new Response(
    JSON.stringify({
      ok: true,
      matched: true,
      entity_type: resolved.entityType,
      entity_id: resolved.entityId,
      confidence: resolved.confidence,
      via: resolved.via,
      suggested_status: sug.suggested,
    }),
    { headers: { 'content-type': 'application/json' } },
  )
})
