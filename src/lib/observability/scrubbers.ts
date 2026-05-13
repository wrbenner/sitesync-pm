// src/lib/observability/scrubbers.ts — BRT subsystem 7 §4.5 (I4 invariant)
//
// Centralized PII scrubber. Every event payload that crosses an
// observability boundary (Sentry, PostHog, Slack) MUST pass through
// scrubEvent() first to strip sensitive fields.
//
// Strategy: drop-not-mask. A redacted "[REDACTED]" string still leaks
// the shape of the original ("we saw a token here") — we drop the key
// entirely. The cost: harder to debug a field that's intermittently
// missing. The benefit: zero accidental data exfiltration via observability.

const SENSITIVE_KEYS = new Set([
  // Auth + secrets
  'password',
  'passwordHash',
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'api_key',
  'apiKey',
  'session',
  'jwt',
  'authorization',
  'cookie',
  // Customer content that may contain PII or trade secrets
  'draft_text',
  'rfi_body',
  'rfi_question',
  'submittal_body',
  'daily_log_body',
  'daily_log_summary',
  'meeting_notes',
  // Billing
  'card_number',
  'cardNumber',
  'cvc',
  'cvv',
  'stripe_secret',
  'webhook_secret',
])

// Keys whose value should be hash-truncated (e.g. user_id is useful for
// joins but the full UUID is PII when paired with other fields).
const HASH_KEYS = new Set<string>([])

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Returns a new object with sensitive keys removed.
 * - Drops any key whose lowercase name is in SENSITIVE_KEYS.
 * - Recurses into nested objects + arrays.
 * - Leaves primitives untouched.
 * - Handles cycles via a WeakSet (returns '[Circular]' on a self-reference).
 */
export function scrubEvent<T>(value: T, seen: WeakSet<object> = new WeakSet()): T {
  if (Array.isArray(value)) {
    if (seen.has(value)) return '[Circular]' as unknown as T
    seen.add(value)
    return value.map((v) => scrubEvent(v, seen)) as unknown as T
  }
  if (isPlainObject(value)) {
    if (seen.has(value)) return '[Circular]' as unknown as T
    seen.add(value)
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) continue
      if (HASH_KEYS.has(k.toLowerCase())) {
        out[k] = '[HASHED]'
        continue
      }
      out[k] = scrubEvent(v, seen)
    }
    return out as unknown as T
  }
  return value
}

/**
 * Sentry `beforeSend` hook: receives the Sentry event payload, returns
 * a scrubbed copy (or null to drop the event).
 *
 * The Sentry SDK passes an `Event` object — we scrub:
 *   - request.headers (auth tokens)
 *   - request.cookies
 *   - extra (arbitrary user data attached via setExtra)
 *   - contexts (Sentry context objects)
 *   - breadcrumbs[].data (arbitrary user data on each breadcrumb)
 */
export function sentryBeforeSend<T extends Record<string, unknown>>(event: T): T {
  return scrubEvent(event)
}

/**
 * Test-only export of the sensitive-key set. Use this to assert that
 * specific keys are scrubbed without hard-coding the string in tests.
 */
export function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEYS.has(key.toLowerCase())
}
