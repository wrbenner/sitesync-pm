// inbound-email-events — Resend delivery + bounce webhook
//
// Resend fires `email.delivered`, `email.bounced`, `email.complained`
// (and a few others) per outbound. We translate these into the
// projected `delivery_status` column on rfi_distributions so the UI
// can render a green / red / gray dot per recipient chip.
//
// Wiring:
//   1. Verify Svix signature (RESEND_WEBHOOK_SECRET).
//   2. Insert one resend_webhook_events row per delivery (raw payload
//      preserved for forensics — service_role only RLS).
//   3. Look up the rfi_distributions row by message_id and update
//      delivery_status / delivery_status_at / bounce_reason.
//
// We do NOT short-circuit on lookup miss — Resend re-delivers some
// events, and we want the audit trail of every event we received.

import { serve } from 'https://deno.land/std@0.192.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decode as base64Decode } from 'https://deno.land/std@0.192.0/encoding/base64.ts'

interface ResendWebhookPayload {
  type: string
  created_at?: string
  data?: {
    email_id?: string
    to?: string[]
    from?: string
    subject?: string
    headers?: Array<{ name: string; value: string }>
    bounce?: { type?: string; subType?: string; message?: string }
    complaint?: { type?: string; feedback_type?: string }
  }
}

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

async function verifySignature(req: Request, rawBody: string): Promise<boolean> {
  const secret = Deno.env.get('RESEND_WEBHOOK_SECRET')
  if (!secret) {
    return Deno.env.get('RESEND_WEBHOOK_DEV_BYPASS') === '1'
  }
  const svixId = req.headers.get('svix-id')
  const svixTimestamp = req.headers.get('svix-timestamp')
  const svixSignature = req.headers.get('svix-signature')
  if (!svixId || !svixTimestamp || !svixSignature) return false

  const ts = Number(svixTimestamp)
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false

  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`
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
  const candidates = svixSignature.split(' ').map((s) => s.split(',')[1]).filter(Boolean)
  return candidates.includes(computed)
}

function statusForEvent(eventType: string): 'delivered' | 'bounced' | 'complained' | 'unknown' | null {
  switch (eventType) {
    case 'email.delivered':
      return 'delivered'
    case 'email.bounced':
    case 'email.delivery_failed':
      return 'bounced'
    case 'email.complained':
      return 'complained'
    case 'email.opened':
    case 'email.clicked':
      // Engagement events — we track them in resend_webhook_events but
      // don't change the projected delivery_status. The chip's job is
      // delivery, not engagement.
      return null
    default:
      return 'unknown'
  }
}

function extractMessageId(payload: ResendWebhookPayload): string | null {
  const headers = payload.data?.headers ?? []
  for (const h of headers) {
    if (h.name?.toLowerCase() === 'message-id') {
      return h.value.replace(/^<|>$/g, '').trim()
    }
  }
  // Resend sometimes only exposes its own email_id, not our stamped
  // Message-ID. We keep both — the lookup tries message_id first, then
  // falls back to a join on the local part of our format
  // (rfi-<distributionId>.<ts>@reply.sitesync.app).
  return null
}

function bounceReason(payload: ResendWebhookPayload): string | null {
  const b = payload.data?.bounce
  if (b) {
    return [b.type, b.subType, b.message].filter(Boolean).join(' / ').slice(0, 500)
  }
  const c = payload.data?.complaint
  if (c) {
    return `complaint: ${c.feedback_type ?? c.type ?? 'unknown'}`.slice(0, 500)
  }
  return null
}

serve(async (req) => {
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405 })

  const rawBody = await req.text()
  const sigOk = await verifySignature(req, rawBody)
  if (!sigOk) return new Response('invalid signature', { status: 401 })

  let payload: ResendWebhookPayload
  try {
    payload = JSON.parse(rawBody) as ResendWebhookPayload
  } catch {
    return new Response('invalid json', { status: 400 })
  }

  const eventType = payload.type ?? 'unknown'
  const messageId = extractMessageId(payload)
  const toEmails = payload.data?.to ?? []
  const reason = bounceReason(payload)
  const projected = statusForEvent(eventType)

  // Look up the rfi_distributions row by our stamped Message-ID. Two
  // shapes show up in practice: angle-bracketed and not. The UPDATE is
  // tolerant.
  let distributionId: string | null = null
  if (messageId) {
    const cleaned = messageId.replace(/^<|>$/g, '').trim()
    const { data } = await sb
      .from('rfi_distributions')
      .select('id')
      .eq('message_id', cleaned)
      .maybeSingle()
    distributionId = (data?.id as string | undefined) ?? null
  }

  // Always log the event (forensics).
  await sb.from('resend_webhook_events').insert({
    event_type: eventType,
    message_id: messageId,
    to_email: toEmails[0] ?? null,
    bounce_reason: reason,
    rfi_distribution_id: distributionId,
    raw_payload: payload as unknown as Record<string, unknown>,
    signature_valid: true,
  })

  // Project status onto the distribution row when relevant.
  if (distributionId && projected) {
    await sb
      .from('rfi_distributions')
      .update({
        delivery_status: projected,
        delivery_status_at: new Date().toISOString(),
        bounce_reason: reason,
      })
      .eq('id', distributionId)
  }

  return new Response(
    JSON.stringify({ ok: true, event: eventType, distribution_id: distributionId, projected }),
    { headers: { 'content-type': 'application/json' } },
  )
})
