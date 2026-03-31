// ── Webhook Fan-out System ─────────────────────────────────────
// SNS-style event delivery to multiple webhook endpoints.
// Features: HMAC-SHA256 signing, event filtering, retry with
// exponential backoff, dead letter queue, delivery logging.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Types ─────────────────────────────────────────────────────

export interface WebhookEndpoint {
  id: string
  url: string
  secret: string
  events: string[] // Event types this endpoint subscribes to ('*' = all)
  active: boolean
  failureCount: number
  organizationId?: string
  projectId?: string
}

export interface WebhookEvent {
  id: string
  type: string         // e.g., 'rfi.created', 'task.updated', 'payment.completed'
  data: Record<string, unknown>
  projectId?: string
  organizationId?: string
  timestamp: string
}

export interface DeliveryResult {
  webhookId: string
  success: boolean
  statusCode: number
  responseBody?: string
  error?: string
  durationMs: number
  attempt: number
}

// ── Event Types ───────────────────────────────────────────────

export const WEBHOOK_EVENT_TYPES = [
  'rfi.created', 'rfi.updated', 'rfi.responded',
  'task.created', 'task.updated', 'task.completed',
  'submittal.created', 'submittal.updated', 'submittal.approved',
  'change_order.created', 'change_order.approved',
  'daily_log.created', 'daily_log.submitted',
  'punch_item.created', 'punch_item.resolved',
  'payment.submitted', 'payment.approved', 'payment.completed',
  'incident.reported', 'inspection.completed',
  'document.uploaded', 'drawing.revised',
] as const

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number] | string

// ── HMAC-SHA256 Signature ─────────────────────────────────────

export async function signPayload(
  payload: string,
  secret: string,
  timestamp: number,
): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signatureInput = `${timestamp}.${payload}`
  const signatureBuffer = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(signatureInput),
  )

  return Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function verifySignature(
  payload: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds = 300, // 5 minute tolerance
): Promise<boolean> {
  // Parse header format: t=timestamp,v1=signature
  const parts: Record<string, string> = {}
  for (const part of signatureHeader.split(',')) {
    const [key, value] = part.split('=', 2)
    if (key && value) parts[key.trim()] = value.trim()
  }

  const timestamp = parseInt(parts.t || '0', 10)
  const receivedSig = parts.v1

  if (!timestamp || !receivedSig) return false

  // Check timestamp tolerance (prevent replay attacks)
  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - timestamp) > toleranceSeconds) return false

  // Compute expected signature
  const expectedSig = await signPayload(payload, secret, timestamp)

  // Constant-time comparison
  if (expectedSig.length !== receivedSig.length) return false
  let mismatch = 0
  for (let i = 0; i < expectedSig.length; i++) {
    mismatch |= expectedSig.charCodeAt(i) ^ receivedSig.charCodeAt(i)
  }
  return mismatch === 0
}

// ── Fan-out Delivery ──────────────────────────────────────────

const MAX_RETRIES = 3
const RETRY_BASE_DELAY_MS = 1000
const DELIVERY_TIMEOUT_MS = 10_000
const MAX_FAILURE_COUNT = 10 // Disable endpoint after this many consecutive failures

export async function fanoutEvent(
  event: WebhookEvent,
  supabase: SupabaseClient,
): Promise<DeliveryResult[]> {
  // Fetch all matching webhook endpoints
  let query = supabase
    .from('webhooks')
    .select('id, url, secret, events, active, failure_count, organization_id, project_id')
    .eq('active', true)

  // Scope by organization or project
  if (event.organizationId) {
    query = query.or(`organization_id.eq.${event.organizationId},project_id.eq.${event.projectId}`)
  }

  const { data: endpoints, error } = await query
  if (error || !endpoints) return []

  // Filter endpoints by event type subscription
  const matchingEndpoints = (endpoints as unknown as WebhookEndpoint[]).filter((ep) => {
    if (ep.failureCount >= MAX_FAILURE_COUNT) return false // Dead endpoint
    if (ep.events.includes('*')) return true
    return ep.events.includes(event.type)
  })

  // Deliver to all matching endpoints in parallel
  const results = await Promise.all(
    matchingEndpoints.map((ep) => deliverWithRetry(event, ep, supabase)),
  )

  return results
}

async function deliverWithRetry(
  event: WebhookEvent,
  endpoint: WebhookEndpoint,
  supabase: SupabaseClient,
): Promise<DeliveryResult> {
  let lastResult: DeliveryResult | null = null

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    lastResult = await deliverOnce(event, endpoint, attempt)

    // Log delivery
    await supabase.from('webhook_deliveries').insert({
      webhook_id: endpoint.id,
      event: event.type,
      payload: event.data,
      response_status: lastResult.statusCode,
      response_body: lastResult.responseBody?.substring(0, 1000),
      duration_ms: lastResult.durationMs,
      attempt,
      success: lastResult.success,
    }).then(() => {}) // Fire and forget

    if (lastResult.success) {
      // Reset failure count on success
      if (endpoint.failureCount > 0) {
        await supabase
          .from('webhooks')
          .update({ failure_count: 0, last_triggered_at: new Date().toISOString() })
          .eq('id', endpoint.id)
      } else {
        await supabase
          .from('webhooks')
          .update({ last_triggered_at: new Date().toISOString() })
          .eq('id', endpoint.id)
      }
      return lastResult
    }

    // Wait with exponential backoff before retry
    if (attempt < MAX_RETRIES) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1) + Math.random() * 500
      await new Promise((r) => setTimeout(r, delay))
    }
  }

  // All retries failed — increment failure count (dead letter queue)
  await supabase
    .from('webhooks')
    .update({
      failure_count: endpoint.failureCount + 1,
      last_triggered_at: new Date().toISOString(),
    })
    .eq('id', endpoint.id)

  // If failure count exceeds threshold, disable endpoint
  if (endpoint.failureCount + 1 >= MAX_FAILURE_COUNT) {
    await supabase
      .from('webhooks')
      .update({ active: false })
      .eq('id', endpoint.id)
  }

  return lastResult!
}

async function deliverOnce(
  event: WebhookEvent,
  endpoint: WebhookEndpoint,
  attempt: number,
): Promise<DeliveryResult> {
  const startTime = Date.now()
  const payload = JSON.stringify({
    id: event.id,
    type: event.type,
    data: event.data,
    created_at: event.timestamp,
  })

  const timestamp = Math.floor(Date.now() / 1000)
  const signature = await signPayload(payload, endpoint.secret, timestamp)

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS)

    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SiteSync-Signature': `t=${timestamp},v1=${signature}`,
        'X-SiteSync-Event': event.type,
        'X-SiteSync-Delivery': event.id,
        'X-SiteSync-Attempt': String(attempt),
        'User-Agent': 'SiteSync-Webhooks/1.0',
      },
      body: payload,
      signal: controller.signal,
    })

    clearTimeout(timeout)

    const responseBody = await response.text().catch(() => '')
    const success = response.status >= 200 && response.status < 300

    return {
      webhookId: endpoint.id,
      success,
      statusCode: response.status,
      responseBody: responseBody.substring(0, 1000),
      durationMs: Date.now() - startTime,
      attempt,
    }
  } catch (err) {
    return {
      webhookId: endpoint.id,
      success: false,
      statusCode: 0,
      error: (err as Error).message,
      durationMs: Date.now() - startTime,
      attempt,
    }
  }
}

// ── Helper: Emit Event ────────────────────────────────────────
// Call this from any edge function after a mutation to trigger webhooks.

export async function emitWebhookEvent(
  type: WebhookEventType,
  data: Record<string, unknown>,
  context: { projectId?: string; organizationId?: string },
): Promise<void> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const event: WebhookEvent = {
    id: `evt_${Date.now()}_${crypto.randomUUID().substring(0, 8)}`,
    type,
    data,
    projectId: context.projectId,
    organizationId: context.organizationId,
    timestamp: new Date().toISOString(),
  }

  // Run fan-out (don't await — fire and forget for non-blocking mutations)
  fanoutEvent(event, supabase).catch((err) => {
    console.error('Webhook fan-out error:', err)
  })
}
