// ── webhooks — pure helpers ────────────────────────────────────────────────
// HMAC-SHA256 payload signing, exponential-backoff schedule, event-filter
// match logic. The webhook-dispatch edge function uses these helpers; the
// admin UI uses `matchSubscription` to preview which subscriptions would
// fire for a hypothetical event.

export interface WebhookSubscription {
  id: string
  url: string
  secret_hint: string  // SHA-256(secret); the actual secret comes from Vault
  event_types: ReadonlyArray<string>
  project_ids: ReadonlyArray<string> | null
  status_filter: { from?: ReadonlyArray<string>; to?: ReadonlyArray<string> }
  paused: boolean
  active: boolean
}

export interface WebhookEvent {
  type: string                 // 'rfi.status_changed'
  entity_type: string          // 'rfi'
  entity_id: string
  project_id: string
  status_from?: string
  status_to?: string
  payload: Record<string, unknown>
  /** Stable id (UUID) so retries can dedupe at the receiver. */
  event_id: string
  created_at: string
}

const eventTypeMatches = (sub: ReadonlyArray<string>, event: string): boolean => {
  if (sub.includes('*')) return true
  if (sub.includes(event)) return true
  // wildcard: 'rfi.*' matches 'rfi.status_changed'
  return sub.some((s) => s.endsWith('.*') && event.startsWith(s.slice(0, -1)))
}

/**
 * Decide whether a subscription should fire for this event.
 * Returns true if all filters match.
 */
export function matchSubscription(sub: WebhookSubscription, event: WebhookEvent): boolean {
  if (!sub.active || sub.paused) return false
  if (!eventTypeMatches(sub.event_types, event.type)) return false
  if (sub.project_ids && sub.project_ids.length > 0 && !sub.project_ids.includes(event.project_id)) {
    return false
  }
  if (sub.status_filter.from && event.status_from &&
      !sub.status_filter.from.includes(event.status_from)) {
    return false
  }
  if (sub.status_filter.to && event.status_to &&
      !sub.status_filter.to.includes(event.status_to)) {
    return false
  }
  return true
}

/** HMAC-SHA256 signature over the JSON-serialized payload. The receiver
 *  recomputes the same signature using the shared secret to verify the
 *  delivery wasn't tampered with in transit. */
export async function signPayload(secret: string, payload: unknown): Promise<{ body: string; signature: string }> {
  const body = JSON.stringify(payload)
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return { body, signature: `sha256=${hex}` }
}

/**
 * Exponential-backoff schedule for retrying a failed delivery. Returns
 * the seconds-from-now to attempt the next retry. After 7 days
 * cumulative we move the delivery to dead_letter status.
 *
 *   attempt 1 →   30s
 *   attempt 2 →    5m
 *   attempt 3 →   30m
 *   attempt 4 →    2h
 *   attempt 5 →   12h
 *   attempt 6 →   24h
 *   attempt 7+ →  72h (caps; dead-letter after 7d total)
 */
export function nextRetryDelaySeconds(attempt: number): number | null {
  const ladder = [30, 300, 1800, 7200, 43200, 86400, 259200]
  if (attempt < 0) return ladder[0]
  return ladder[Math.min(attempt, ladder.length - 1)] ?? null
}

export function shouldDeadLetter(firstAttemptAt: string, now: Date = new Date()): boolean {
  const SEVEN_DAYS_MS = 7 * 24 * 3_600_000
  return now.getTime() - new Date(firstAttemptAt).getTime() >= SEVEN_DAYS_MS
}

/** Map a Postgres trigger payload (entity row + before/after) into a
 *  canonical WebhookEvent. The dispatcher reads from a `webhook_events`
 *  staging table; this fn shapes that row for delivery. */
export function eventFromTrigger(input: {
  entity_type: string
  entity_id: string
  project_id: string
  action: string  // 'create' | 'update' | …
  before?: { status?: string }
  after?: Record<string, unknown> & { status?: string }
}): WebhookEvent {
  const status_from = input.before?.status ?? undefined
  const status_to = (input.after?.status as string | undefined) ?? undefined
  // Event type: 'rfi.created', 'rfi.updated', or 'rfi.status_changed' when
  // the status field actually moved.
  let type = `${input.entity_type}.${input.action}`
  if (input.action === 'update' && status_from && status_to && status_from !== status_to) {
    type = `${input.entity_type}.status_changed`
  }
  if (input.action === 'create') type = `${input.entity_type}.created`
  return {
    type,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    project_id: input.project_id,
    status_from,
    status_to,
    payload: input.after ?? {},
    event_id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`,
    created_at: new Date().toISOString(),
  }
}
