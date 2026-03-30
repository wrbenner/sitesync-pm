// Token-bucket rate limiter for external API calls.
// Respects per-provider rate limits to avoid 429s and account bans.

// ── Provider Rate Limits ────────────────────────────────

const PROVIDER_LIMITS: Record<string, { maxTokens: number; refillPerSecond: number }> = {
  quickbooks:       { maxTokens: 500, refillPerSecond: 500 / 60 },       // 500/min
  procore_import:   { maxTokens: 3600, refillPerSecond: 3600 / 3600 },   // 3600/hr
  autodesk_bim360:  { maxTokens: 300, refillPerSecond: 300 / 60 },       // 300/min
  google_drive:     { maxTokens: 12000, refillPerSecond: 12000 / 60 },   // 12000/min (Drive API)
  sharepoint:       { maxTokens: 600, refillPerSecond: 600 / 60 },       // Generous estimate
  slack:            { maxTokens: 50, refillPerSecond: 50 / 60 },         // Tier 2: ~50/min
  teams:            { maxTokens: 60, refillPerSecond: 1 },               // ~60/min
  sage:             { maxTokens: 100, refillPerSecond: 100 / 60 },       // Conservative
  email_resend:     { maxTokens: 10, refillPerSecond: 10 / 60 },         // 10/min free tier
}

const DEFAULT_LIMIT = { maxTokens: 100, refillPerSecond: 100 / 60 }

// ── Token Bucket ────────────────────────────────────────

interface Bucket {
  tokens: number
  lastRefill: number
  maxTokens: number
  refillPerSecond: number
}

const buckets = new Map<string, Bucket>()

function getBucket(provider: string): Bucket {
  const existing = buckets.get(provider)
  if (existing) return existing

  const limits = PROVIDER_LIMITS[provider] ?? DEFAULT_LIMIT
  const bucket: Bucket = {
    tokens: limits.maxTokens,
    lastRefill: Date.now(),
    maxTokens: limits.maxTokens,
    refillPerSecond: limits.refillPerSecond,
  }
  buckets.set(provider, bucket)
  return bucket
}

function refill(bucket: Bucket): void {
  const now = Date.now()
  const elapsed = (now - bucket.lastRefill) / 1000
  bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + elapsed * bucket.refillPerSecond)
  bucket.lastRefill = now
}

// ── Public API ──────────────────────────────────────────

/**
 * Acquire a rate limit token for the given provider.
 * Returns immediately if tokens available.
 * Waits up to `timeoutMs` if bucket is empty.
 * Throws if the wait would exceed the timeout.
 */
export async function acquireToken(provider: string, timeoutMs = 30_000): Promise<void> {
  const bucket = getBucket(provider)
  refill(bucket)

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1
    return
  }

  // Calculate wait time for next token
  const waitSeconds = (1 - bucket.tokens) / bucket.refillPerSecond
  const waitMs = waitSeconds * 1000

  if (waitMs > timeoutMs) {
    throw new Error(`Rate limit exceeded for ${provider}. Retry in ${Math.ceil(waitSeconds)}s.`)
  }

  await new Promise((resolve) => setTimeout(resolve, waitMs))
  refill(bucket)

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1
    return
  }

  throw new Error(`Rate limit exceeded for ${provider} after waiting.`)
}

/**
 * Check if a request can be made without waiting.
 */
export function canRequest(provider: string): boolean {
  const bucket = getBucket(provider)
  refill(bucket)
  return bucket.tokens >= 1
}

/**
 * Get remaining tokens for a provider (useful for UI display).
 */
export function getRemainingTokens(provider: string): number {
  const bucket = getBucket(provider)
  refill(bucket)
  return Math.floor(bucket.tokens)
}

/**
 * Wrap a fetch call with rate limiting.
 * Acquires a token before executing, respects provider limits.
 */
export async function rateLimitedFetch(
  provider: string,
  url: string,
  options?: RequestInit,
): Promise<Response> {
  await acquireToken(provider)

  const response = await fetch(url, options)

  // If we get a 429 Too Many Requests, drain the bucket and retry once after delay
  if (response.status === 429) {
    const bucket = getBucket(provider)
    bucket.tokens = 0

    const retryAfter = parseInt(response.headers.get('Retry-After') ?? '5', 10)
    await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000))

    await acquireToken(provider)
    return fetch(url, options)
  }

  return response
}
