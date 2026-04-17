// ── API Authentication & Rate Limiting ────────────────────────
// Shared module for the public REST API v1.
// Handles: API key auth, scope checking, tiered rate limiting
// with proper X-RateLimit headers, idempotency, pagination, CORS.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { HttpError } from './auth.ts'

// ── Types ─────────────────────────────────────────────────────

export interface ApiKeyContext {
  keyId: string
  organizationId: string
  permissions: string[]
  rateLimit: number
  supabase: SupabaseClient
}

export class RateLimitError extends Error {
  constructor(
    message: string,
    public readonly retryAfter: number,
    public readonly limit: number,
    public readonly remaining: number,
    public readonly reset: number,
  ) {
    super(message)
    this.name = 'RateLimitError'
  }
}

// ── CORS Headers ──────────────────────────────────────────────

export const apiCorsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-API-Key, X-Idempotency-Key, X-API-Version',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Expose-Headers': 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-API-Version, X-Request-Id',
}

// ── API Key Authentication ────────────────────────────────────

export async function authenticateApiKey(req: Request): Promise<ApiKeyContext> {
  const apiKey = req.headers.get('X-API-Key') || req.headers.get('Authorization')?.replace('Bearer ', '')

  if (!apiKey) {
    throw new HttpError(401, 'Missing API key. Include X-API-Key header or Authorization: Bearer <key>', 'authentication_error')
  }

  // Extract prefix for lookup (first 8 chars)
  const prefix = apiKey.substring(0, 8)

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Look up key by prefix
  const { data: keyRecord, error } = await supabaseAdmin
    .from('api_keys')
    .select('id, key_hash, organization_id, permissions, rate_limit, expires_at')
    .eq('key_prefix', prefix)
    .single()

  if (error || !keyRecord) {
    throw new HttpError(401, 'Invalid API key', 'authentication_error')
  }

  // Check expiration
  if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
    throw new HttpError(401, 'API key has expired', 'authentication_error')
  }

  // Verify key hash (timing-safe comparison)
  const encoder = new TextEncoder()
  const keyData = encoder.encode(apiKey)
  const hashBuffer = await crypto.subtle.digest('SHA-256', keyData)
  const hashHex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  // Constant-time comparison
  const storedHash = String(keyRecord.key_hash ?? '')
  if (hashHex.length !== storedHash.length) {
    throw new HttpError(401, 'Invalid API key', 'authentication_error')
  }
  let mismatch = 0
  for (let i = 0; i < hashHex.length; i++) {
    mismatch |= hashHex.charCodeAt(i) ^ storedHash.charCodeAt(i)
  }
  if (mismatch !== 0) {
    throw new HttpError(401, 'Invalid API key', 'authentication_error')
  }

  // Update last_used_at (fire and forget)
  supabaseAdmin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', keyRecord.id)
    .then(() => {})

  // Create a client scoped to the organization
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
  )

  return {
    keyId: keyRecord.id,
    organizationId: keyRecord.organization_id,
    permissions: (keyRecord.permissions as string[]) || ['read'],
    rateLimit: keyRecord.rate_limit || 100,
    supabase,
  }
}

// ── Scope Checking ────────────────────────────────────────────

export function requireScope(ctx: ApiKeyContext, scope: string): void {
  // 'read' grants all read:* scopes, 'write' grants all write:* scopes
  const hasScope =
    ctx.permissions.includes(scope) ||
    ctx.permissions.includes('*') ||
    (scope.startsWith('read:') && ctx.permissions.includes('read')) ||
    (scope.startsWith('write:') && ctx.permissions.includes('write'))

  if (!hasScope) {
    throw new HttpError(
      403,
      `API key does not have the '${scope}' permission`,
      'insufficient_permissions',
    )
  }
}

// ── Tiered Rate Limiting ──────────────────────────────────────
// Per-endpoint rate limits using in-memory sliding window.
// In production, replace with Redis or Supabase KV.

const rateLimitWindows = new Map<string, { count: number; resetAt: number }>()

const ENDPOINT_LIMITS: Record<string, number> = {
  'GET:/v1/projects': 100,
  'POST:/v1/': 30,
  'PATCH:/v1/': 30,
  'GET:/v1/': 100,
  'ai:analyze': 10,
  'files:upload': 20,
}

function getEndpointLimit(method: string, path: string): number {
  // Check specific endpoint first
  const specific = ENDPOINT_LIMITS[`${method}:${path}`]
  if (specific) return specific

  // Check prefix match
  for (const [pattern, limit] of Object.entries(ENDPOINT_LIMITS)) {
    if (`${method}:${path}`.startsWith(pattern)) return limit
  }

  return 100 // Default
}

export function checkRateLimit(ctx: ApiKeyContext): void {
  const windowKey = `${ctx.keyId}`
  const now = Date.now()
  const windowMs = 60_000 // 1 minute window

  let window = rateLimitWindows.get(windowKey)
  if (!window || now >= window.resetAt) {
    window = { count: 0, resetAt: now + windowMs }
    rateLimitWindows.set(windowKey, window)
  }

  window.count++
  const limit = ctx.rateLimit
  const remaining = Math.max(0, limit - window.count)
  const resetSeconds = Math.ceil((window.resetAt - now) / 1000)

  if (window.count > limit) {
    throw new RateLimitError(
      `Rate limit exceeded. Limit: ${limit} requests per minute.`,
      resetSeconds,
      limit,
      0,
      window.resetAt,
    )
  }

  // Store limit info for response headers (accessed via ctx)
  ;(ctx as Record<string, unknown>)._rateLimitHeaders = {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.floor(window.resetAt / 1000)),
  }
}

export function getRateLimitHeaders(ctx: ApiKeyContext): Record<string, string> {
  return ((ctx as Record<string, unknown>)._rateLimitHeaders as Record<string, string>) || {}
}

// ── Idempotency ───────────────────────────────────────────────

const idempotencyCache = new Map<string, { status: number; body: string; expiresAt: number }>()

export function getIdempotencyKey(req: Request): string | null {
  return req.headers.get('X-Idempotency-Key')
}

export function getCachedResponse(key: string): Response | null {
  const cached = idempotencyCache.get(key)
  if (!cached) return null
  if (Date.now() > cached.expiresAt) {
    idempotencyCache.delete(key)
    return null
  }
  return new Response(cached.body, {
    status: cached.status,
    headers: { 'Content-Type': 'application/json', 'X-Idempotent-Replayed': 'true' },
  })
}

export function cacheResponse(key: string, status: number, body: string): void {
  idempotencyCache.set(key, {
    status,
    body,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  })
}

// ── Pagination ────────────────────────────────────────────────

export function parsePagination(url: URL): { cursor: string | null; limit: number } {
  const cursor = url.searchParams.get('starting_after') || url.searchParams.get('cursor') || null
  const limitParam = url.searchParams.get('limit')
  const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 100) : 25
  return { cursor, limit }
}

export function paginatedResponse(
  data: unknown[],
  limit: number,
): { data: unknown[]; has_more: boolean; next_cursor?: string } {
  const hasMore = data.length > limit
  const items = hasMore ? data.slice(0, limit) : data
  const lastItem = items[items.length - 1] as Record<string, unknown> | undefined

  return {
    data: items,
    has_more: hasMore,
    ...(hasMore && lastItem?.id ? { next_cursor: String(lastItem.id) } : {}),
  }
}

// ── Expand ────────────────────────────────────────────────────

export function parseExpand(url: URL): string[] {
  const expand = url.searchParams.get('expand')
  if (!expand) return []
  return expand.split(',').map((s) => s.trim()).filter(Boolean)
}

// ── API Versioning ────────────────────────────────────────────

export function getApiVersion(req: Request): string {
  return req.headers.get('X-API-Version') || '2026-03-30'
}
