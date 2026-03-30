// Shared security utilities for ALL Supabase Edge Functions.
// EVERY function MUST use these. No exceptions.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Environment ──────────────────────────────────────────

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error('Server configuration error')
  return value
}

// ── CORS ─────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  'https://sitesync.pm',
  'https://app.sitesync.pm',
  'https://staging.sitesync.pm',
  'http://localhost:5173',
  'http://localhost:3000',
]

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
}

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: getCorsHeaders(req) })
  }
  return null
}

// ── UUID Validation ──────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value)
}

export function requireUuid(value: unknown, fieldName: string): string {
  if (!isValidUuid(value)) {
    throw new HttpError(400, `Invalid ${fieldName}: must be a valid UUID`)
  }
  return value
}

// ── HTTP Error ───────────────────────────────────────────

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

export function errorResponse(error: unknown, corsHeaders: Record<string, string>): Response {
  if (error instanceof HttpError) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: error.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
  // Generic error: never leak internals
  console.error('Edge function error:', error)
  return new Response(
    JSON.stringify({ error: 'An unexpected error occurred' }),
    { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

// ── User Authentication ──────────────────────────────────

export interface AuthenticatedUser {
  id: string
  email: string
}

/**
 * Authenticate a user from the Authorization header.
 * Creates a user-scoped Supabase client that respects RLS.
 * NEVER use service role key for user-initiated operations.
 */
export async function authenticateRequest(req: Request): Promise<{
  user: AuthenticatedUser
  supabase: ReturnType<typeof createClient>
}> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Missing or invalid authorization header')
  }

  const supabaseUrl = getRequiredEnv('SUPABASE_URL')
  const supabaseAnonKey = getRequiredEnv('SUPABASE_ANON_KEY')

  // Create user-scoped client: passes the user's JWT so RLS applies
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    throw new HttpError(401, 'Invalid or expired authentication token')
  }

  return {
    user: { id: user.id, email: user.email ?? '' },
    supabase,
  }
}

// ── CRON Authentication ──────────────────────────────────

/**
 * Verify that a request comes from the Supabase cron scheduler.
 * CRON functions use service role because they operate across all projects.
 * Returns a service-role client.
 */
export function authenticateCron(req: Request): ReturnType<typeof createClient> {
  const authHeader = req.headers.get('Authorization')
  const cronSecret = Deno.env.get('CRON_SECRET')

  // Option 1: Bearer token matches the cron secret
  if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
    const supabaseUrl = getRequiredEnv('SUPABASE_URL')
    const serviceKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY')
    return createClient(supabaseUrl, serviceKey)
  }

  // Option 2: Supabase-internal invocation (from pg_cron or scheduled function)
  // These come with the service role key in the authorization header
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (serviceKey && authHeader === `Bearer ${serviceKey}`) {
    const supabaseUrl = getRequiredEnv('SUPABASE_URL')
    return createClient(supabaseUrl, serviceKey)
  }

  throw new HttpError(403, 'This function is only callable by the scheduler')
}

// ── Project Membership Verification ──────────────────────

/**
 * Verify the user is a member of the given project and return their role.
 * Uses the user-scoped client, so RLS ensures they can only see their own memberships.
 */
export async function verifyProjectMembership(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  projectId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    throw new HttpError(403, 'You do not have access to this project')
  }

  return data.role as string
}

// Role hierarchy for permission checks
const ROLE_LEVELS: Record<string, number> = {
  owner: 6, admin: 5, project_manager: 4,
  superintendent: 3, subcontractor: 2, viewer: 1,
}

export function hasMinimumRole(userRole: string, requiredRole: string): boolean {
  return (ROLE_LEVELS[userRole] ?? 0) >= (ROLE_LEVELS[requiredRole] ?? 0)
}

export function requireMinimumRole(userRole: string, requiredRole: string, action: string): void {
  if (!hasMinimumRole(userRole, requiredRole)) {
    throw new HttpError(403, `You do not have permission to ${action}`)
  }
}

// ── Input Sanitization ───────────────────────────────────

/**
 * Strip HTML tags and common injection patterns from user content.
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/<[^>]*>/g, '') // strip HTML tags
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim()
}

/**
 * HTML-escape for safe rendering in email templates.
 */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
}

/**
 * Sanitize content before injecting into AI system prompt.
 * Prevents prompt injection by removing instruction-like patterns.
 */
export function sanitizeForPrompt(input: string): string {
  return input
    .replace(/```/g, '') // code blocks
    .replace(/\bsystem\b/gi, '[filtered]')
    .replace(/\bassistant\b/gi, '[filtered]')
    .replace(/\bignore (previous|above|all)\b/gi, '[filtered]')
    .replace(/\bforget (previous|above|all)\b/gi, '[filtered]')
    .replace(/\bnew instructions?\b/gi, '[filtered]')
    .replace(/\boverride\b/gi, '[filtered]')
    .slice(0, 2000) // cap length
}

// ── Request Size Limit ───────────────────────────────────

const MAX_REQUEST_BODY_SIZE = 256 * 1024 // 256KB

export async function parseJsonBody<T>(req: Request): Promise<T> {
  const contentLength = parseInt(req.headers.get('Content-Length') ?? '0', 10)
  if (contentLength > MAX_REQUEST_BODY_SIZE) {
    throw new HttpError(413, 'Request body too large')
  }

  const text = await req.text()
  if (text.length > MAX_REQUEST_BODY_SIZE) {
    throw new HttpError(413, 'Request body too large')
  }

  try {
    return JSON.parse(text) as T
  } catch {
    throw new HttpError(400, 'Invalid JSON in request body')
  }
}
