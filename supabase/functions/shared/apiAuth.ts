// API key authentication for the public REST API.
// Follows Stripe's pattern: Bearer sk_live_xxx in Authorization header.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { HttpError } from './auth.ts'

// ── Types ────────────────────────────────────────────────

export interface ApiKeyContext {
  keyId: string
  organizationId: string
  permissions: string[]
  rateLimit: number
  supabase: ReturnType<typeof createClient>
}

// ── API Key Validation ───────────────────────────────────

export async function authenticateApiKey(req: Request): Promise<ApiKeyContext> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer sk_')) {
    throw new HttpError(401, 'Missing or invalid API key. Use: Authorization: Bearer sk_xxx')
  }

  const apiKey = authHeader.slice(7) // Remove "Bearer "
  const keyPrefix = apiKey.slice(0, 10)

  // Hash the key for lookup (in production, use crypto.subtle.digest)
  const keyHash = await hashApiKey(apiKey)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  // Look up the API key
  const { data: keyRecord, error } = await supabase
    .from('api_keys')
    .select('id, organization_id, permissions, rate_limit, expires_at')
    .eq('key_hash', keyHash)
    .single()

  if (error || !keyRecord) {
    throw new HttpError(401, 'Invalid API key')
  }

  // Check expiration
  if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
    throw new HttpError(401, 'API key has expired')
  }

  // Update last_used_at (fire and forget)
  supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', keyRecord.id).then(() => {})

  return {
    keyId: keyRecord.id,
    organizationId: keyRecord.organization_id,
    permissions: (keyRecord.permissions as string[]) || ['read'],
    rateLimit: keyRecord.rate_limit || 100,
    supabase,
  }
}

// ── Scope Checking ───────────────────────────────────────

export function requireScope(context: ApiKeyContext, scope: string): void {
  // "admin" scope grants everything
  if (context.permissions.includes('admin')) return
  // Check specific scope
  if (!context.permissions.includes(scope)) {
    throw new HttpError(403, `API key lacks required scope: ${scope}`)
  }
}

// ── Rate Limiting ────────────────────────────────────────

const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

export function checkRateLimit(context: ApiKeyContext): void {
  const now = Date.now()
  const windowMs = 60_000 // 1 minute window
  const key = context.keyId

  let entry = rateLimitStore.get(key)
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs }
    rateLimitStore.set(key, entry)
  }

  entry.count++
  if (entry.count > context.rateLimit) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000)
    throw new RateLimitError(retryAfter)
  }
}

export class RateLimitError extends HttpError {
  retryAfter: number
  constructor(retryAfter: number) {
    super(429, `Rate limit exceeded. Retry after ${retryAfter} seconds.`)
    this.retryAfter = retryAfter
  }
}

// ── Idempotency ──────────────────────────────────────────

const idempotencyCache = new Map<string, { status: number; body: string; expiresAt: number }>()

export function getIdempotencyKey(req: Request): string | null {
  return req.headers.get('Idempotency-Key')
}

export function getCachedResponse(idempotencyKey: string): Response | null {
  const cached = idempotencyCache.get(idempotencyKey)
  if (cached && cached.expiresAt > Date.now()) {
    return new Response(cached.body, {
      status: cached.status,
      headers: { 'Content-Type': 'application/json', 'Idempotent-Replayed': 'true' },
    })
  }
  return null
}

export function cacheResponse(idempotencyKey: string, status: number, body: string): void {
  idempotencyCache.set(idempotencyKey, {
    status,
    body,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
  })
}

// ── Pagination ───────────────────────────────────────────

export interface PaginationParams {
  cursor?: string
  limit: number
}

export function parsePagination(url: URL): PaginationParams {
  const cursor = url.searchParams.get('starting_after') ?? undefined
  const limit = Math.min(Math.max(parseInt(url.searchParams.get('limit') ?? '25', 10), 1), 100)
  return { cursor, limit }
}

export function paginatedResponse<T extends { id: string }>(items: T[], limit: number) {
  const hasMore = items.length > limit
  const data = hasMore ? items.slice(0, limit) : items
  return {
    object: 'list',
    data,
    has_more: hasMore,
    next_cursor: hasMore ? data[data.length - 1]?.id : null,
  }
}

// ── Expand Parameter ─────────────────────────────────────

export function parseExpand(url: URL): string[] {
  const expand = url.searchParams.get('expand')
  return expand ? expand.split(',').map(s => s.trim()) : []
}

// ── API Version ──────────────────────────────────────────

export function getApiVersion(req: Request): string {
  return req.headers.get('API-Version') ?? '2026-03-30'
}

// ── Helpers ──────────────────────────────────────────────

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── CORS for API ─────────────────────────────────────────

export const apiCorsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*', // Public API: allow all origins
  'Access-Control-Allow-Headers': 'authorization, content-type, idempotency-key, api-version',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Max-Age': '86400',
}
