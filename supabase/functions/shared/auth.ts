// ── Shared Auth Utilities ─────────────────────────────────────
// Authentication, authorization, validation, and CORS for all edge functions.
// LAW 12: Edge Functions are secure by default.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Error Handling ───────────────────────────────────────────

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly type: string = 'api_error',
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export function errorResponse(
  error: unknown,
  extraHeaders: Record<string, string> = {},
): Response {
  if (error instanceof HttpError) {
    return new Response(
      JSON.stringify({
        error: {
          message: error.message,
          type: error.type,
          status: error.status,
        },
      }),
      {
        status: error.status,
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
      },
    )
  }

  console.error('Unhandled error:', error)
  return new Response(
    JSON.stringify({
      error: {
        message: 'Internal server error',
        type: 'internal_error',
        status: 500,
      },
    }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...extraHeaders },
    },
  )
}

// ── CORS ─────────────────────────────────────────────────────

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'https://sitesync.ai',
  'https://app.sitesync.ai',
]

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') || ''
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-API-Key, X-Idempotency-Key',
    'Access-Control-Max-Age': '86400',
  }
}

export function handleCors(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: getCorsHeaders(req) })
  }
  return null
}

// ── UUID Validation ──────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidUuid(value: string): boolean {
  return UUID_REGEX.test(value)
}

export function requireUuid(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || !isValidUuid(value)) {
    throw new HttpError(400, `${fieldName} must be a valid UUID`)
  }
  return value
}

// ── Input Sanitization ───────────────────────────────────────

export function sanitizeString(value: string, maxLength = 1000): string {
  return value.slice(0, maxLength).replace(/<[^>]*>/g, '')
}

export function sanitizeText(value: string, maxLength = 5000): string {
  return value
    .slice(0, maxLength)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]*>/g, '')
    .trim()
}

export function sanitizeForPrompt(value: string, maxLength = 10000): string {
  return value
    .slice(0, maxLength)
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/```[\s\S]*?```/g, (m) => m) // preserve code blocks
    .trim()
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ── JSON Body Parsing ────────────────────────────────────────

export async function parseJsonBody<T = Record<string, unknown>>(
  req: Request,
): Promise<T> {
  const contentType = req.headers.get('Content-Type') || ''
  if (!contentType.includes('application/json')) {
    throw new HttpError(415, 'Content-Type must be application/json')
  }

  try {
    const body = await req.json()
    if (typeof body !== 'object' || body === null) {
      throw new HttpError(400, 'Request body must be a JSON object')
    }
    return body as T
  } catch (err) {
    if (err instanceof HttpError) throw err
    throw new HttpError(400, 'Invalid JSON in request body')
  }
}

// ── Authentication ───────────────────────────────────────────

interface AuthResult {
  user: { id: string; email: string }
  supabase: SupabaseClient
}

export async function authenticateRequest(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    throw new HttpError(401, 'Missing or invalid Authorization header')
  }

  const token = authHeader.slice(7)
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    throw new HttpError(401, 'Invalid or expired authentication token')
  }

  return {
    user: { id: user.id, email: user.email || '' },
    supabase,
  }
}

// ── CRON Authentication ──────────────────────────────────────

export function authenticateCron(req: Request): SupabaseClient {
  const authHeader = req.headers.get('Authorization')
  const cronSecret = Deno.env.get('CRON_SECRET')

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    throw new HttpError(401, 'Invalid CRON authentication')
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  return createClient(supabaseUrl, serviceRoleKey)
}

// ── Project Membership ───────────────────────────────────────

type ProjectRole = 'viewer' | 'field_user' | 'foreman' | 'project_manager' | 'admin' | 'owner'

const ROLE_HIERARCHY: Record<ProjectRole, number> = {
  viewer: 0,
  field_user: 1,
  foreman: 2,
  project_manager: 3,
  admin: 4,
  owner: 5,
}

export async function verifyProjectMembership(
  supabase: SupabaseClient,
  userId: string,
  projectId: string,
): Promise<ProjectRole> {
  const { data, error } = await supabase
    .from('project_members')
    .select('role')
    .eq('user_id', userId)
    .eq('project_id', projectId)
    .single()

  if (error || !data) {
    throw new HttpError(403, 'User is not a member of this project')
  }

  return (data.role as ProjectRole) || 'viewer'
}

export function requireMinimumRole(
  currentRole: ProjectRole,
  minimumRole: ProjectRole,
  action: string,
): void {
  const currentLevel = ROLE_HIERARCHY[currentRole] ?? 0
  const requiredLevel = ROLE_HIERARCHY[minimumRole] ?? 0

  if (currentLevel < requiredLevel) {
    throw new HttpError(
      403,
      `Insufficient permissions: ${minimumRole} role required to ${action}`,
    )
  }
}
