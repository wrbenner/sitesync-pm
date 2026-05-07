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
import { decode as base64Decode } from 'https://deno.land/std@0.192.0/encoding/base64.ts'

// ── Resend webhook signature verification ───────────────────────────────
// Resend signs every webhook request with a secret. Reject any request
// whose signature doesn't validate before reading any state from it.
async function verifyResendSignature(req: Request, rawBody: string): Promise<boolean> {
  const secret = Deno.env.get('RESEND_WEBHOOK_SECRET')
  if (!secret) {
    // Unconfigured — fail closed in production. For local dev, set
    // RESEND_WEBHOOK_DEV_BYPASS=1 to skip verification.
    return Deno.env.get('RESEND_WEBHOOK_DEV_BYPASS') === '1'
  }

  // Resend sends headers svix-id, svix-timestamp, svix-signature in the
  // Svix format: "v1,<base64sig> v1,<base64sig> ...". Spec at
  // https://docs.svix.com/receiving/verifying-payloads/how-manual.
  const svixId = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')
  if (!svixId || !svixTimestamp || !svixSignature) return false

  // Reject replays older than 5 minutes (Svix recommendation).
  const ts = Number(svixTimestamp)
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false

  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`
  // The secret is "whsec_<base64>" — strip prefix, base64-decode.
  const secretBytes = secret.startsWith('whsec_')
    ? base64Decode(secret.slice('whsec_'.length))
    : new TextEncoder().encode(secret)
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedContent))
  const computed = btoa(String.fromCharCode(...new Uint8Array(sigBuf)))

  // svix-signature format: "v1,<sig> v1,<sig2> ..." — match any.
  const candidates = svixSignature.split(' ').map((s) => s.split(',')[1]).filter(Boolean)
  return candidates.includes(computed)
}

// ── Types ────────────────────────────────────────────────────────────────

type EntityType = 'rfi' | 'submittal' | 'change_order'

interface InboundAttachment {
  filename?: string
  // Either a URL the provider hosts the file at, or inline base64
  // content. Resend currently sends URLs.
  url?: string
  content?: string  // base64
  content_type?: string
  size?: number
}

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
  attachments?: InboundAttachment[]
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

// ── Attachment extraction (P1c) ─────────────────────────────────────────
// Resend's inbound payload includes attachments as either inline base64
// or hosted URLs. Walk the array, upload each into the project bucket,
// and insert one rfi_attachments row per file with source='email_inbound'.
async function persistAttachments(opts: {
  attachments: InboundAttachment[]
  projectId: string
  rfiId: string
  responseId: string
}): Promise<{ persisted: number; failed: number }> {
  let persisted = 0
  let failed = 0
  for (const att of opts.attachments) {
    try {
      const filename = (att.filename ?? `attachment-${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_')
      const ts = Date.now()
      const storagePath = `${opts.projectId}/rfis/${opts.rfiId}/responses/${opts.responseId}/${ts}-${filename}`

      let bytes: Uint8Array | null = null
      let contentType = att.content_type ?? 'application/octet-stream'
      if (att.content) {
        bytes = base64Decode(att.content)
      } else if (att.url) {
        const res = await fetch(att.url)
        if (!res.ok) throw new Error(`fetch ${res.status}`)
        bytes = new Uint8Array(await res.arrayBuffer())
        contentType = res.headers.get('content-type') ?? contentType
      }
      if (!bytes) {
        failed++
        continue
      }

      const { error: uploadErr } = await sb.storage
        .from('project-files')
        .upload(storagePath, bytes, { cacheControl: '3600', upsert: false, contentType })
      if (uploadErr) throw uploadErr

      const { error: insertErr } = await sb.from('rfi_attachments').insert({
        rfi_id: opts.rfiId,
        response_id: opts.responseId,
        storage_path: storagePath,
        filename: att.filename ?? filename,
        content_type: contentType,
        size_bytes: att.size ?? bytes.byteLength,
        source: 'email_inbound',
        position: 0,
      })
      if (insertErr) throw insertErr
      persisted++
    } catch {
      failed++
    }
  }
  return { persisted, failed }
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })

  // Read raw body once so we can both verify signature and JSON-parse.
  const rawBody = await req.text()

  const sigOk = await verifyResendSignature(req, rawBody)
  if (!sigOk) return new Response('invalid signature', { status: 401 })

  let payload: InboundPayload
  try {
    payload = JSON.parse(rawBody) as InboundPayload
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
  const attachments = flat.attachments ?? payload.attachments ?? []

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

  // Always log to inbound_email_replies — that's the legal record.
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

  // P1c — for RFI matches, also insert into rfi_responses so the reply
  // shows up in the live thread on the detail page. Confidence drives
  // the persistence path:
  //   high   → real response, source='email_inbound'
  //   medium → real response, source='email_inbound' (verified via
  //            In-Reply-To which is high-fidelity in practice)
  //   low    → drafted_actions only — Iris asks the GC to confirm
  //            before adding to the legal record.
  let insertedResponseId: string | null = null
  let attachmentSummary: { persisted: number; failed: number } | null = null
  let projectIdForResponse: string | null = null

  if (resolved.entityType === 'rfi' && (resolved.confidence === 'high' || resolved.confidence === 'medium')) {
    const { data: rfiRow } = await sb
      .from('rfis')
      .select('project_id')
      .eq('id', resolved.entityId)
      .maybeSingle()
    projectIdForResponse = (rfiRow?.project_id as string | undefined) ?? null

    const { data: responseRow, error: responseErr } = await sb
      .from('rfi_responses')
      .insert({
        rfi_id: resolved.entityId,
        author_id: null,
        content: text || subject || '(empty reply)',
        response_type: 'answered',
        is_official: false,
        is_internal: false,
        source: 'email_inbound',
        source_email: sender,
        inbound_message_id: inboundMessageId,
      })
      .select('id')
      .single()
    if (!responseErr && responseRow) {
      insertedResponseId = (responseRow as { id: string }).id

      // Attachments — best-effort; failures don't break the response insert.
      if (projectIdForResponse && attachments.length > 0 && insertedResponseId) {
        attachmentSummary = await persistAttachments({
          attachments,
          projectId: projectIdForResponse,
          rfiId: resolved.entityId,
          responseId: insertedResponseId,
        })
      }

      // Audit row — Chain Audit Prep Check 5.
      if (projectIdForResponse) {
        await sb.from('audit_log').insert({
          project_id: projectIdForResponse,
          user_id: null,
          user_email: sender,
          user_name: sender,
          entity_type: 'rfi',
          entity_id: resolved.entityId,
          action: 'update',
          before_state: null,
          after_state: {
            response_id: insertedResponseId,
            source: 'email_inbound',
            inbound_message_id: inboundMessageId,
          },
          changed_fields: ['response'],
          metadata: {
            kind: 'rfi_response_email_inbound',
            via: resolved.via,
            confidence: resolved.confidence,
            attachments_persisted: attachmentSummary?.persisted ?? 0,
            attachments_failed: attachmentSummary?.failed ?? 0,
          },
        })
      }
    }
  } else if (resolved.entityType === 'rfi' && resolved.confidence === 'low') {
    // Low-confidence subject-only match — surface to Iris instead of
    // inserting straight into the thread. The detail page renders a
    // yellow "Iris received an email…" banner with Accept / Reject.
    // Resolve the project_id off the RFI for drafted_actions FK.
    const { data: rfiRow } = await sb
      .from('rfis')
      .select('project_id')
      .eq('id', resolved.entityId)
      .maybeSingle()
    const projectIdForDraft = (rfiRow?.project_id as string | undefined) ?? null
    if (projectIdForDraft) {
      await sb.from('drafted_actions').insert({
        project_id: projectIdForDraft,
        action_type: 'rfi.email_inbound_review',
        title: `Email may belong to RFI: ${subject.slice(0, 80)}`,
        summary: text.slice(0, 200),
        payload: {
          rfi_id: resolved.entityId,
          body: text,
          subject,
          from_email: sender,
          inbound_message_id: inboundMessageId,
          source: 'email_inbound_iris_review',
          via: resolved.via,
        },
        citations: [{ kind: 'rfi_reference', text: subject.slice(0, 200) }],
        confidence: 0.4,
        status: 'pending',
        drafted_by: 'inbound-email',
        draft_reason: 'low-confidence subject-only match',
        related_resource_type: 'rfi',
        related_resource_id: resolved.entityId,
      })
    }
  }

  // Status-transition Iris draft (separate from response surfacing).
  // Only at high confidence + clear keyword. Surface via approval gate.
  const sug = suggestStatusTransition(text, resolved.entityType)
  if (sug.suggested && resolved.confidence === 'high' && sug.confidence === 'medium' && projectIdForResponse) {
    await sb.from('drafted_actions').insert({
      project_id: projectIdForResponse,
      action_type: `${resolved.entityType}.transition_status`,
      title: `Suggested ${resolved.entityType} status: ${sug.suggested}`,
      summary: `Architect reply suggests "${sug.suggested}" — confirm before applying.`,
      payload: {
        entity_id: resolved.entityId,
        to_status: sug.suggested,
        excerpt: text.slice(0, 500),
      },
      citations: [{ kind: 'rfi_reference', text: text.slice(0, 200) }],
      confidence: 0.6,
      status: 'pending',
      drafted_by: 'inbound-email',
      draft_reason: 'inbound reply approval/rejection keyword',
      related_resource_type: resolved.entityType,
      related_resource_id: resolved.entityId,
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
      response_id: insertedResponseId,
      attachments: attachmentSummary,
      suggested_status: sug.suggested,
    }),
    { headers: { 'content-type': 'application/json' } },
  )
})
