// ── webhook-dispatch ────────────────────────────────────────────────────────
// Dispatcher for outbound webhooks. Two invocation paths:
//   1. POST  /webhook-dispatch  (admin "test fire" — sends a synthetic
//      event to a single subscription so the receiver team can verify
//      the contract).
//   2. Cron  ticks every minute, drains webhook_deliveries WHERE
//      status='pending' AND next_attempt_at <= now() up to a small
//      batch.
//
// Each delivery sends:
//   • POST <url>
//   • Headers: Content-Type, X-SiteSync-Event, X-SiteSync-Delivery,
//     X-SiteSync-Signature: sha256=<hex>
//   • Body: JSON.stringify(event_payload)
//
// Receiver semantics: any 2xx = success; anything else = failure.
// Retries follow the exponential ladder mirrored from src/lib/webhooks.
// After 7 days the delivery becomes dead_letter and the subscription's
// consecutive_failures counter is bumped.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { handleCors, getCorsHeaders, errorResponse, HttpError } from '../shared/auth.ts'

const RETRY_LADDER_SECONDS = [30, 300, 1800, 7200, 43200, 86400, 259200]
const DEAD_LETTER_AFTER_DAYS = 7
const BATCH_SIZE = 50

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  try {
    if (req.method === 'POST') {
      return await handleTestFire(req)
    }
    return await drainQueue()
  } catch (err) {
    return errorResponse(err, getCorsHeaders(req))
  }
})

async function handleTestFire(req: Request): Promise<Response> {
  const sUrl = Deno.env.get('SUPABASE_URL')
  const sKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!sUrl || !sKey) throw new HttpError(500, 'Service role not configured')
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.includes(sKey.slice(0, 8))) throw new HttpError(401, 'Service role required for test fire')

  const body = await req.json() as { webhook_id: string }
  const admin = createClient(sUrl, sKey)
  const { data: sub } = await (admin as any)
    .from('outbound_webhooks')
    .select('id, organization_id, url, event_types')
    .eq('id', body.webhook_id)
    .maybeSingle()
  if (!sub) throw new HttpError(404, 'subscription not found')

  const event = {
    event_id: crypto.randomUUID(),
    event_type: 'test.ping',
    organization_id: sub.organization_id,
    created_at: new Date().toISOString(),
    payload: { source: 'webhook-dispatch test fire' },
  }
  const { error } = await (admin as any).from('webhook_deliveries').insert({
    webhook_id: sub.id,
    organization_id: sub.organization_id,
    event_type: event.event_type,
    payload: event,
    status: 'pending',
    next_attempt_at: new Date().toISOString(),
  })
  if (error) throw new HttpError(500, error.message)
  return new Response(JSON.stringify({ ok: true }), {
    status: 202,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function drainQueue(): Promise<Response> {
  const sUrl = Deno.env.get('SUPABASE_URL')!
  const sKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(sUrl, sKey)

  const nowIso = new Date().toISOString()
  const { data: dueRows } = await (admin as any)
    .from('webhook_deliveries')
    .select('id, webhook_id, organization_id, event_type, payload, attempt_count, created_at')
    .eq('status', 'pending')
    .lte('next_attempt_at', nowIso)
    .order('next_attempt_at', { ascending: true })
    .limit(BATCH_SIZE)

  const summary = { attempted: 0, succeeded: 0, retried: 0, dead_lettered: 0 }
  for (const d of (dueRows as any[] | null) ?? []) {
    summary.attempted += 1
    const { data: sub } = await (admin as any)
      .from('outbound_webhooks')
      .select('id, url, paused, active, consecutive_failures')
      .eq('id', d.webhook_id)
      .maybeSingle()
    if (!sub || !sub.active || sub.paused) {
      await (admin as any)
        .from('webhook_deliveries')
        .update({ next_attempt_at: new Date(Date.now() + 3_600_000).toISOString() })
        .eq('id', d.id)
      continue
    }
    const secret = Deno.env.get('WEBHOOK_DEFAULT_SECRET') ?? 'dev-webhook-secret'
    const { body, signature } = await signPayload(secret, d.payload)

    let success = false
    let respStatus = 0
    let respBody = ''
    try {
      const resp = await fetch(sub.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-SiteSync-Event': String(d.event_type),
          'X-SiteSync-Delivery': String(d.id),
          'X-SiteSync-Signature': signature,
        },
        body,
      })
      respStatus = resp.status
      respBody = (await resp.text()).slice(0, 1024)
      success = resp.ok
    } catch (err) {
      respBody = (err as Error).message.slice(0, 1024)
    }

    if (success) {
      await (admin as any)
        .from('webhook_deliveries')
        .update({
          status: 'succeeded',
          attempt_count: d.attempt_count + 1,
          last_attempt_at: new Date().toISOString(),
          last_response_status: respStatus,
          last_response_body: respBody,
          succeeded_at: new Date().toISOString(),
        })
        .eq('id', d.id)
      await (admin as any)
        .from('outbound_webhooks')
        .update({ last_success_at: new Date().toISOString(), consecutive_failures: 0 })
        .eq('id', sub.id)
      summary.succeeded += 1
      continue
    }

    const startMs = new Date(d.created_at).getTime()
    const elapsedDays = (Date.now() - startMs) / 86_400_000
    if (elapsedDays >= DEAD_LETTER_AFTER_DAYS) {
      await (admin as any)
        .from('webhook_deliveries')
        .update({
          status: 'dead_letter',
          attempt_count: d.attempt_count + 1,
          last_attempt_at: new Date().toISOString(),
          last_response_status: respStatus,
          last_response_body: respBody,
        })
        .eq('id', d.id)
      summary.dead_lettered += 1
    } else {
      const delay = RETRY_LADDER_SECONDS[Math.min(d.attempt_count, RETRY_LADDER_SECONDS.length - 1)]
      await (admin as any)
        .from('webhook_deliveries')
        .update({
          attempt_count: d.attempt_count + 1,
          last_attempt_at: new Date().toISOString(),
          last_response_status: respStatus,
          last_response_body: respBody,
          next_attempt_at: new Date(Date.now() + delay * 1000).toISOString(),
        })
        .eq('id', d.id)
      summary.retried += 1
    }
    await (admin as any)
      .from('outbound_webhooks')
      .update({
        last_failure_at: new Date().toISOString(),
        consecutive_failures: (sub.consecutive_failures as number ?? 0) + 1,
      })
      .eq('id', sub.id)
  }

  return new Response(JSON.stringify({ ok: true, ...summary }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

async function signPayload(secret: string, payload: unknown): Promise<{ body: string; signature: string }> {
  const body = JSON.stringify(payload)
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')
  return { body, signature: `sha256=${hex}` }
}
