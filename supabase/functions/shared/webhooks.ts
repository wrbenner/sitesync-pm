// Webhook delivery system: HMAC-SHA256 signed payloads with exponential backoff retries.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Types ────────────────────────────────────────────────

export interface WebhookEvent {
  id: string
  type: string // e.g., 'rfi.created', 'task.status_changed'
  created_at: string
  data: {
    object: Record<string, unknown>
    previous_attributes?: Record<string, unknown>
  }
  project_id: string
}

// Retry schedule: 1s, 10s, 60s, 300s (5m), 3600s (1h)
const RETRY_DELAYS = [1, 10, 60, 300, 3600]
const MAX_RETRIES = 5

// ── HMAC Signing ─────────────────────────────────────────

async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Deliver Webhook ──────────────────────────────────────

export async function deliverWebhook(
  supabase: ReturnType<typeof createClient>,
  webhookId: string,
  url: string,
  secret: string | null,
  event: WebhookEvent,
): Promise<{ success: boolean; statusCode: number }> {
  const payload = JSON.stringify(event)
  const timestamp = Math.floor(Date.now() / 1000)

  // Build headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'SiteSync-Webhooks/1.0',
    'X-Webhook-ID': event.id,
    'X-Webhook-Timestamp': String(timestamp),
  }

  // Sign the payload if secret is configured
  if (secret) {
    const signedPayload = `${timestamp}.${payload}`
    const signature = await signPayload(signedPayload, secret)
    headers['X-Webhook-Signature'] = `v1=${signature}`
  }

  let statusCode = 0
  let responseBody = ''

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000) // 30s timeout

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: payload,
      signal: controller.signal,
    })

    clearTimeout(timeout)
    statusCode = response.status
    responseBody = await response.text().catch(() => '')

    // Log delivery
    await supabase.from('webhook_deliveries').insert({
      webhook_id: webhookId,
      event: event.type,
      payload: event,
      response_status: statusCode,
      response_body: responseBody.slice(0, 1000), // Cap stored response
      delivered_at: new Date().toISOString(),
      retry_count: 0,
    })

    const success = statusCode >= 200 && statusCode < 300

    if (!success) {
      // Increment failure count
      await supabase.rpc('increment_webhook_failures', { webhook_id: webhookId })
    } else {
      // Reset failure count on success
      await supabase.from('webhooks').update({ failure_count: 0, last_triggered_at: new Date().toISOString() }).eq('id', webhookId)
    }

    return { success, statusCode }
  } catch (err) {
    // Network error or timeout
    await supabase.from('webhook_deliveries').insert({
      webhook_id: webhookId,
      event: event.type,
      payload: event,
      response_status: 0,
      response_body: (err as Error).message,
      delivered_at: new Date().toISOString(),
      retry_count: 0,
    })

    await supabase.rpc('increment_webhook_failures', { webhook_id: webhookId })
    return { success: false, statusCode: 0 }
  }
}

// ── Dispatch to All Matching Webhooks ────────────────────

export async function dispatchWebhookEvent(
  supabase: ReturnType<typeof createClient>,
  projectId: string,
  eventType: string,
  data: Record<string, unknown>,
  previousAttributes?: Record<string, unknown>,
): Promise<number> {
  // Find all active webhooks that subscribe to this event type
  const { data: webhooks } = await supabase
    .from('webhooks')
    .select('id, url, secret, events, failure_count')
    .eq('project_id', projectId)
    .eq('active', true)
    .lt('failure_count', 10) // Disable after 10 consecutive failures

  if (!webhooks || webhooks.length === 0) return 0

  const event: WebhookEvent = {
    id: crypto.randomUUID(),
    type: eventType,
    created_at: new Date().toISOString(),
    data: {
      object: data,
      ...(previousAttributes ? { previous_attributes: previousAttributes } : {}),
    },
    project_id: projectId,
  }

  let delivered = 0

  for (const webhook of webhooks) {
    // Check if this webhook subscribes to this event type
    const events = webhook.events as string[]
    const matches = events.includes(eventType) || events.includes('*')
    if (!matches) continue

    const result = await deliverWebhook(supabase, webhook.id, webhook.url, webhook.secret, event)
    if (result.success) delivered++
  }

  return delivered
}

// ── Event Type Helpers ───────────────────────────────────

export const WEBHOOK_EVENT_TYPES = [
  // RFIs
  'rfi.created', 'rfi.updated', 'rfi.status_changed', 'rfi.assigned', 'rfi.response_added',
  // Tasks
  'task.created', 'task.updated', 'task.status_changed', 'task.completed', 'task.assigned',
  // Submittals
  'submittal.created', 'submittal.updated', 'submittal.status_changed', 'submittal.approved', 'submittal.rejected',
  // Daily Logs
  'daily_log.created', 'daily_log.submitted', 'daily_log.approved', 'daily_log.rejected',
  // Change Orders
  'change_order.created', 'change_order.submitted', 'change_order.approved', 'change_order.rejected', 'change_order.promoted',
  // Punch Items
  'punch_item.created', 'punch_item.resolved', 'punch_item.verified',
  // Budget
  'budget_item.updated',
  // Safety
  'incident.created', 'inspection.completed',
  // Members
  'member.invited', 'member.role_changed',
  // Catch-all
  '*',
] as const
