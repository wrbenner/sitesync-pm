// webhook-receiver: Receives inbound webhooks from third-party integrations.
// LAW 12: Webhook endpoint — verify signature, validate payload, rate limit.
// Uses SERVICE_ROLE_KEY (appropriate: webhook is system-to-system, not user-initiated).


import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  handleCors,
  getCorsHeaders,
  isValidUuid,
  HttpError,
  errorResponse,
} from '../shared/auth.ts'

// ── HMAC Signature Verification ──────────────────────────────

async function verifySignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): Promise<void> {
  if (!signatureHeader) {
    throw new HttpError(401, 'Missing x-webhook-signature header')
  }

  // Parse "t=<timestamp>,v1=<signature>" format
  const parts: Record<string, string> = {}
  for (const segment of signatureHeader.split(',')) {
    const [key, ...rest] = segment.trim().split('=')
    if (key && rest.length) parts[key] = rest.join('=')
  }

  const timestamp = parts.t
  const providedSig = parts.v1
  if (!timestamp || !providedSig) {
    throw new HttpError(401, 'Invalid signature format (expected t=...,v1=...)')
  }

  // Replay attack protection: reject signatures older than 5 minutes
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10)
  if (Number.isNaN(age) || age < 0 || age > 300) {
    throw new HttpError(401, 'Webhook signature timestamp outside acceptable window')
  }

  // Compute expected HMAC-SHA256
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signed = await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${rawBody}`))
  const expected = Array.from(new Uint8Array(signed))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  // Constant-time comparison
  if (expected.length !== providedSig.length) {
    throw new HttpError(401, 'Invalid webhook signature')
  }
  let mismatch = 0
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ providedSig.charCodeAt(i)
  }
  if (mismatch !== 0) {
    throw new HttpError(401, 'Invalid webhook signature')
  }
}

// ── Rate Limiting (in-memory per-instance) ───────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 1000
const RATE_WINDOW_MS = 60_000

function checkRateLimit(integrationId: string): void {
  const now = Date.now()
  const entry = rateLimitMap.get(integrationId)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(integrationId, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return
  }

  entry.count++
  if (entry.count > RATE_LIMIT) {
    throw new HttpError(429, 'Webhook rate limit exceeded')
  }
}

// ── Max Payload Size ─────────────────────────────────────────

const MAX_PAYLOAD_BYTES = 1024 * 1024 // 1 MB

// ── Handler ──────────────────────────────────────────────────

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const cors = getCorsHeaders(req)

  try {
    // 1. Extract and validate integration_id
    const url = new URL(req.url)
    const integrationId = url.searchParams.get('integration_id')
    if (!integrationId || !isValidUuid(integrationId)) {
      throw new HttpError(400, 'Missing or invalid integration_id parameter')
    }

    // 2. Read raw body (needed for signature verification before parsing)
    const rawBody = await req.text()
    if (rawBody.length > MAX_PAYLOAD_BYTES) {
      throw new HttpError(413, `Payload too large (max ${MAX_PAYLOAD_BYTES / 1024}KB)`)
    }

    // 3. Rate limit per integration
    checkRateLimit(integrationId)

    // 4. Service role client (appropriate: system-to-system webhook, not user-initiated)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 5. Verify integration exists and is active
    const { data: integration, error: intError } = await supabase
      .from('integrations')
      .select('id, type, status, config, webhook_secret')
      .eq('id', integrationId)
      .single()

    if (intError || !integration) {
      throw new HttpError(404, 'Integration not found')
    }
    if (integration.status !== 'connected') {
      throw new HttpError(422, 'Integration is not active')
    }

    // 6. Verify webhook signature (if secret is configured)
    const webhookSecret = (integration as Record<string, unknown>).webhook_secret as string | null
    if (webhookSecret) {
      const sigHeader = req.headers.get('x-webhook-signature')
      await verifySignature(rawBody, sigHeader, webhookSecret)
    }

    // 7. Parse JSON payload
    let payload: Record<string, unknown>
    try {
      payload = JSON.parse(rawBody)
      if (typeof payload !== 'object' || payload === null) {
        throw new Error('not an object')
      }
    } catch {
      throw new HttpError(400, 'Invalid JSON payload')
    }

    const event = String(payload.event || url.searchParams.get('event') || 'unknown')

    // 8. Log webhook delivery
    await supabase.from('webhook_deliveries').insert({
      webhook_id: integrationId,
      event,
      payload,
      response_status: 200,
      verified: !!webhookSecret,
    }).then(({ error }) => {
      if (error) console.error('Webhook log failed:', error.message)
    })

    // 9. Enqueue async processing (don't block the webhook response)
    const jobType = `process_${integration.type}_webhook`
    await supabase.from('async_jobs').insert({
      type: jobType,
      integration_id: integrationId,
      payload: { event, data: payload },
      status: 'pending',
    }).then(({ error }) => {
      if (error) console.error('Job enqueue failed:', error.message)
    })

    // 10. Update integration last sync timestamp
    await supabase
      .from('integrations')
      .update({ last_sync: new Date().toISOString() })
      .eq('id', integrationId)

    return new Response(
      JSON.stringify({ received: true, event, verified: !!webhookSecret }),
      { headers: { ...cors, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return errorResponse(error, cors)
  }
})
