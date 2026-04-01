import { supabase } from './supabase'
import type { WebhookEndpoint, WebhookPayload, WebhookDelivery } from '../types/webhooks'

// HMAC-SHA256 signature over the serialized payload.
// Header sent: X-SiteSync-Signature: sha256=<hex>
// Receivers verify by computing the same signature with their stored secret.
export async function signPayload(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder()
  const keyData = encoder.encode(secret)
  const msgData = encoder.encode(payload)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, msgData)
  const hex = Array.from(new Uint8Array(signature))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  return `sha256=${hex}`
}

// Exponential backoff schedule (ms): 30s, 5m, 30m, 2h, 8h
const RETRY_DELAYS_MS = [30_000, 300_000, 1_800_000, 7_200_000, 28_800_000]

export async function deliverWebhook(
  endpoint: WebhookEndpoint,
  payload: WebhookPayload,
): Promise<void> {
  const body = JSON.stringify(payload)
  const signature = await signPayload(body, endpoint.secret)

  // Insert a delivery record immediately so retries can reference it
  const { data: delivery, error: insertError } = await supabase
    .from('webhook_deliveries')
    .insert({
      endpoint_id: endpoint.id,
      event: payload.event,
      payload: payload as unknown as Record<string, unknown>,
      attempts: 1,
      status: 'pending',
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('[webhooks] Failed to create delivery record:', insertError.message)
    return
  }

  const deliveryId = delivery.id

  try {
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SiteSync-Signature': signature,
        'X-SiteSync-Event': payload.event,
        'X-SiteSync-Delivery': deliveryId,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    })

    const responseBody = await response.text().catch(() => '')

    await supabase
      .from('webhook_deliveries')
      .update({
        response_status: response.status,
        response_body: responseBody.slice(0, 4096),
        delivered_at: response.ok ? new Date().toISOString() : null,
        status: response.ok ? 'delivered' : 'failed',
        next_retry_at: response.ok ? null : computeNextRetry(1),
      })
      .eq('id', deliveryId)

    if (!response.ok) {
      console.warn(`[webhooks] Delivery ${deliveryId} got ${response.status} — scheduled for retry`)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await supabase
      .from('webhook_deliveries')
      .update({
        response_body: message.slice(0, 4096),
        status: 'failed',
        next_retry_at: computeNextRetry(1),
      })
      .eq('id', deliveryId)

    console.error('[webhooks] Delivery error:', message)
  }
}

export async function retryWebhook(deliveryId: string): Promise<void> {
  const { data: delivery, error } = await supabase
    .from('webhook_deliveries')
    .select('*, webhook_endpoints(*)')
    .eq('id', deliveryId)
    .single()

  if (error || !delivery) {
    console.error('[webhooks] Could not load delivery for retry:', deliveryId)
    return
  }

  const endpoint = (delivery as WebhookDelivery & { webhook_endpoints: WebhookEndpoint }).webhook_endpoints
  if (!endpoint?.active) return

  const attempts = (delivery.attempts ?? 0) + 1
  const payload = delivery.payload as unknown as WebhookPayload
  const body = JSON.stringify(payload)
  const signature = await signPayload(body, endpoint.secret)

  await supabase
    .from('webhook_deliveries')
    .update({ attempts, status: 'retrying', next_retry_at: null })
    .eq('id', deliveryId)

  try {
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-SiteSync-Signature': signature,
        'X-SiteSync-Event': payload.event,
        'X-SiteSync-Delivery': deliveryId,
        'X-SiteSync-Retry-Attempt': String(attempts),
      },
      body,
      signal: AbortSignal.timeout(10_000),
    })

    const responseBody = await response.text().catch(() => '')
    const maxRetriesReached = attempts >= RETRY_DELAYS_MS.length + 1

    await supabase
      .from('webhook_deliveries')
      .update({
        response_status: response.status,
        response_body: responseBody.slice(0, 4096),
        delivered_at: response.ok ? new Date().toISOString() : null,
        status: response.ok ? 'delivered' : (maxRetriesReached ? 'failed' : 'retrying'),
        next_retry_at: response.ok || maxRetriesReached ? null : computeNextRetry(attempts),
      })
      .eq('id', deliveryId)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const maxRetriesReached = attempts >= RETRY_DELAYS_MS.length + 1

    await supabase
      .from('webhook_deliveries')
      .update({
        response_body: message.slice(0, 4096),
        status: maxRetriesReached ? 'failed' : 'retrying',
        next_retry_at: maxRetriesReached ? null : computeNextRetry(attempts),
      })
      .eq('id', deliveryId)
  }
}

function computeNextRetry(attemptNumber: number): string {
  const delayMs = RETRY_DELAYS_MS[Math.min(attemptNumber - 1, RETRY_DELAYS_MS.length - 1)]
  return new Date(Date.now() + delayMs).toISOString()
}
