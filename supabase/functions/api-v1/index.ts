// SiteSync Public REST API v1
// Stripe-quality API: consistent naming, cursor pagination, idempotency, expand, versioning.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { HttpError, errorResponse, isValidUuid } from '../shared/auth.ts'
import {
  authenticateApiKey,
  requireScope,
  checkRateLimit,
  getIdempotencyKey,
  getCachedResponse,
  cacheResponse,
  parsePagination,
  paginatedResponse,
  parseExpand,
  apiCorsHeaders,
  RateLimitError,
  type ApiKeyContext,
} from '../shared/apiAuth.ts'

// ── Route Matching ───────────────────────────────────────

interface Route {
  method: string
  pattern: RegExp
  handler: (ctx: ApiKeyContext, match: RegExpMatchArray, req: Request, url: URL) => Promise<Response>
}

// Extract path params from regex match groups
function param(match: RegExpMatchArray, index: number): string {
  const val = match[index]
  if (!val || !isValidUuid(val)) throw new HttpError(400, `Invalid ID at position ${index}`)
  return val
}

// ── Route Definitions ────────────────────────────────────

const routes: Route[] = [
  // Projects
  { method: 'GET', pattern: /^\/v1\/projects\/?$/, handler: listProjects },
  { method: 'GET', pattern: /^\/v1\/projects\/([^/]+)\/?$/, handler: getProject },

  // RFIs
  { method: 'GET', pattern: /^\/v1\/projects\/([^/]+)\/rfis\/?$/, handler: listRFIs },
  { method: 'POST', pattern: /^\/v1\/projects\/([^/]+)\/rfis\/?$/, handler: createRFI },
  { method: 'GET', pattern: /^\/v1\/projects\/([^/]+)\/rfis\/([^/]+)\/?$/, handler: getRFI },
  { method: 'PATCH', pattern: /^\/v1\/projects\/([^/]+)\/rfis\/([^/]+)\/?$/, handler: updateRFI },

  // Tasks
  { method: 'GET', pattern: /^\/v1\/projects\/([^/]+)\/tasks\/?$/, handler: listTasks },
  { method: 'POST', pattern: /^\/v1\/projects\/([^/]+)\/tasks\/?$/, handler: createTask },
  { method: 'GET', pattern: /^\/v1\/projects\/([^/]+)\/tasks\/([^/]+)\/?$/, handler: getTask },
  { method: 'PATCH', pattern: /^\/v1\/projects\/([^/]+)\/tasks\/([^/]+)\/?$/, handler: updateTask },

  // Submittals
  { method: 'GET', pattern: /^\/v1\/projects\/([^/]+)\/submittals\/?$/, handler: listSubmittals },
  { method: 'POST', pattern: /^\/v1\/projects\/([^/]+)\/submittals\/?$/, handler: createSubmittal },

  // Daily Logs
  { method: 'GET', pattern: /^\/v1\/projects\/([^/]+)\/daily-logs\/?$/, handler: listDailyLogs },
  { method: 'POST', pattern: /^\/v1\/projects\/([^/]+)\/daily-logs\/?$/, handler: createDailyLog },

  // Change Orders
  { method: 'GET', pattern: /^\/v1\/projects\/([^/]+)\/change-orders\/?$/, handler: listChangeOrders },
  { method: 'POST', pattern: /^\/v1\/projects\/([^/]+)\/change-orders\/?$/, handler: createChangeOrder },

  // Budget
  { method: 'GET', pattern: /^\/v1\/projects\/([^/]+)\/budget\/?$/, handler: getBudget },

  // Members
  { method: 'GET', pattern: /^\/v1\/projects\/([^/]+)\/members\/?$/, handler: listMembers },

  // Punch Items
  { method: 'GET', pattern: /^\/v1\/projects\/([^/]+)\/punch-items\/?$/, handler: listPunchItems },
  { method: 'POST', pattern: /^\/v1\/projects\/([^/]+)\/punch-items\/?$/, handler: createPunchItem },
]

// ── Main Handler ─────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: apiCorsHeaders })
  }

  try {
    // Authenticate API key
    const ctx = await authenticateApiKey(req)

    // Rate limit
    checkRateLimit(ctx)

    // Parse URL
    const url = new URL(req.url)
    const path = url.pathname

    // Idempotency for writes
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      const idempotencyKey = getIdempotencyKey(req)
      if (idempotencyKey) {
        const cached = getCachedResponse(idempotencyKey)
        if (cached) return addHeaders(cached)
      }
    }

    // Find matching route
    for (const route of routes) {
      if (req.method !== route.method) continue
      const match = path.match(route.pattern)
      if (match) {
        const response = await route.handler(ctx, match, req, url)

        // Cache idempotent responses
        const idempotencyKey = getIdempotencyKey(req)
        if (idempotencyKey && response.status < 400) {
          const body = await response.clone().text()
          cacheResponse(idempotencyKey, response.status, body)
        }

        return addHeaders(response)
      }
    }

    throw new HttpError(404, `No route matches ${req.method} ${path}`)
  } catch (error) {
    if (error instanceof RateLimitError) {
      return addHeaders(new Response(
        JSON.stringify({ error: { message: error.message, type: 'rate_limit_error' } }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(error.retryAfter) } }
      ))
    }
    return addHeaders(errorResponse(error, apiCorsHeaders))
  }
})

function addHeaders(response: Response): Response {
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(apiCorsHeaders)) {
    headers.set(key, value)
  }
  headers.set('X-API-Version', '2026-03-30')
  return new Response(response.body, { status: response.status, headers })
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

async function parseBody(req: Request): Promise<Record<string, unknown>> {
  const text = await req.text()
  if (text.length > 256 * 1024) throw new HttpError(413, 'Request body too large')
  try { return JSON.parse(text) } catch { throw new HttpError(400, 'Invalid JSON') }
}

// ── Verify Project Access ────────────────────────────────

async function verifyProjectAccess(ctx: ApiKeyContext, projectId: string): Promise<void> {
  // Verify the API key's organization owns this project
  const { data, error } = await ctx.supabase
    .from('projects')
    .select('id, organization_id')
    .eq('id', projectId)
    .eq('organization_id', ctx.organizationId)
    .maybeSingle()
  if (error || !data) throw new HttpError(404, 'Project not found')
}

// ── Route Handlers ───────────────────────────────────────

// Projects
async function listProjects(ctx: ApiKeyContext, _m: RegExpMatchArray, _r: Request, url: URL) {
  requireScope(ctx, 'read')
  const { cursor, limit } = parsePagination(url)
  let query = ctx.supabase.from('projects').select('id, name, address, city, state, status, contract_value, start_date, target_completion, created_at, updated_at').eq('organization_id', ctx.organizationId).order('created_at', { ascending: false }).limit(limit + 1)
  if (cursor) query = query.lt('id', cursor)
  const { data, error } = await query
  if (error) throw new HttpError(500, 'Failed to fetch projects')
  return jsonResponse(paginatedResponse(data ?? [], limit))
}

async function getProject(ctx: ApiKeyContext, match: RegExpMatchArray, _r: Request, _url: URL) {
  requireScope(ctx, 'read')
  const projectId = param(match, 1)
  const { data, error } = await ctx.supabase.from('projects').select('*').eq('id', projectId).eq('organization_id', ctx.organizationId).maybeSingle()
  if (error || !data) throw new HttpError(404, 'Project not found')
  return jsonResponse(data)
}

// RFIs
async function listRFIs(ctx: ApiKeyContext, match: RegExpMatchArray, _r: Request, url: URL) {
  requireScope(ctx, 'read:rfis')
  const projectId = param(match, 1)
  await verifyProjectAccess(ctx, projectId)
  const { cursor, limit } = parsePagination(url)
  const expand = parseExpand(url)

  let select = 'id, number, title, description, status, priority, assigned_to, due_date, created_at, updated_at'
  if (expand.includes('responses')) select += ', rfi_responses(*)'

  let query = ctx.supabase.from('rfis').select(select).eq('project_id', projectId).order('number', { ascending: false }).limit(limit + 1)
  if (cursor) query = query.lt('id', cursor)

  const status = url.searchParams.get('status')
  if (status) query = query.eq('status', status)
  const priority = url.searchParams.get('priority')
  if (priority) query = query.eq('priority', priority)

  const { data, error } = await query
  if (error) throw new HttpError(500, 'Failed to fetch RFIs')
  return jsonResponse(paginatedResponse(data ?? [], limit))
}

async function createRFI(ctx: ApiKeyContext, match: RegExpMatchArray, req: Request, _url: URL) {
  requireScope(ctx, 'write:rfis')
  const projectId = param(match, 1)
  await verifyProjectAccess(ctx, projectId)
  const body = await parseBody(req)

  if (!body.title || typeof body.title !== 'string') throw new HttpError(400, 'title is required')

  const { data, error } = await ctx.supabase.from('rfis').insert({
    project_id: projectId,
    title: body.title,
    description: body.description || '',
    priority: body.priority || 'medium',
    assigned_to: body.assigned_to || null,
    due_date: body.due_date || null,
    status: 'open',
  }).select().single()
  if (error) throw new HttpError(422, error.message)
  return jsonResponse(data, 201)
}

async function getRFI(ctx: ApiKeyContext, match: RegExpMatchArray, _r: Request, url: URL) {
  requireScope(ctx, 'read:rfis')
  const projectId = param(match, 1)
  const rfiId = param(match, 2)
  await verifyProjectAccess(ctx, projectId)
  const expand = parseExpand(url)
  let select = '*'
  if (expand.includes('responses')) select = '*, rfi_responses(*)'

  const { data, error } = await ctx.supabase.from('rfis').select(select).eq('id', rfiId).eq('project_id', projectId).single()
  if (error || !data) throw new HttpError(404, 'RFI not found')
  return jsonResponse(data)
}

async function updateRFI(ctx: ApiKeyContext, match: RegExpMatchArray, req: Request, _url: URL) {
  requireScope(ctx, 'write:rfis')
  const projectId = param(match, 1)
  const rfiId = param(match, 2)
  await verifyProjectAccess(ctx, projectId)
  const body = await parseBody(req)

  const allowed = ['title', 'description', 'status', 'priority', 'assigned_to', 'due_date']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }
  if (Object.keys(updates).length === 0) throw new HttpError(400, 'No valid fields to update')

  const { data, error } = await ctx.supabase.from('rfis').update(updates).eq('id', rfiId).eq('project_id', projectId).select().single()
  if (error) throw new HttpError(422, error.message)
  if (!data) throw new HttpError(404, 'RFI not found')
  return jsonResponse(data)
}

// Tasks
async function listTasks(ctx: ApiKeyContext, match: RegExpMatchArray, _r: Request, url: URL) {
  requireScope(ctx, 'read:tasks')
  const projectId = param(match, 1)
  await verifyProjectAccess(ctx, projectId)
  const { cursor, limit } = parsePagination(url)
  let query = ctx.supabase.from('tasks').select('id, title, status, priority, assigned_to, due_date, percent_complete, is_critical_path, created_at, updated_at').eq('project_id', projectId).order('sort_order').limit(limit + 1)
  if (cursor) query = query.lt('id', cursor)
  const status = url.searchParams.get('status')
  if (status) query = query.eq('status', status)
  const { data, error } = await query
  if (error) throw new HttpError(500, 'Failed to fetch tasks')
  return jsonResponse(paginatedResponse(data ?? [], limit))
}

async function createTask(ctx: ApiKeyContext, match: RegExpMatchArray, req: Request, _url: URL) {
  requireScope(ctx, 'write:tasks')
  const projectId = param(match, 1)
  await verifyProjectAccess(ctx, projectId)
  const body = await parseBody(req)
  if (!body.title) throw new HttpError(400, 'title is required')
  const { data, error } = await ctx.supabase.from('tasks').insert({
    project_id: projectId, title: body.title, description: body.description || '',
    priority: body.priority || 'medium', assigned_to: body.assigned_to || null,
    due_date: body.due_date || null, status: 'todo',
  }).select().single()
  if (error) throw new HttpError(422, error.message)
  return jsonResponse(data, 201)
}

async function getTask(ctx: ApiKeyContext, match: RegExpMatchArray, _r: Request, _url: URL) {
  requireScope(ctx, 'read:tasks')
  const projectId = param(match, 1)
  const taskId = param(match, 2)
  await verifyProjectAccess(ctx, projectId)
  const { data, error } = await ctx.supabase.from('tasks').select('*').eq('id', taskId).eq('project_id', projectId).single()
  if (error || !data) throw new HttpError(404, 'Task not found')
  return jsonResponse(data)
}

async function updateTask(ctx: ApiKeyContext, match: RegExpMatchArray, req: Request, _url: URL) {
  requireScope(ctx, 'write:tasks')
  const projectId = param(match, 1)
  const taskId = param(match, 2)
  await verifyProjectAccess(ctx, projectId)
  const body = await parseBody(req)
  const allowed = ['title', 'description', 'status', 'priority', 'assigned_to', 'due_date', 'percent_complete']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) { if (key in body) updates[key] = body[key] }
  if (Object.keys(updates).length === 0) throw new HttpError(400, 'No valid fields')
  const { data, error } = await ctx.supabase.from('tasks').update(updates).eq('id', taskId).eq('project_id', projectId).select().single()
  if (error) throw new HttpError(422, error.message)
  if (!data) throw new HttpError(404, 'Task not found')
  return jsonResponse(data)
}

// Submittals
async function listSubmittals(ctx: ApiKeyContext, match: RegExpMatchArray, _r: Request, url: URL) {
  requireScope(ctx, 'read:submittals')
  const projectId = param(match, 1)
  await verifyProjectAccess(ctx, projectId)
  const { cursor, limit } = parsePagination(url)
  let query = ctx.supabase.from('submittals').select('id, number, title, status, due_date, created_at, updated_at').eq('project_id', projectId).order('number', { ascending: false }).limit(limit + 1)
  if (cursor) query = query.lt('id', cursor)
  const { data, error } = await query
  if (error) throw new HttpError(500, 'Failed to fetch submittals')
  return jsonResponse(paginatedResponse(data ?? [], limit))
}

async function createSubmittal(ctx: ApiKeyContext, match: RegExpMatchArray, req: Request, _url: URL) {
  requireScope(ctx, 'write:submittals')
  const projectId = param(match, 1)
  await verifyProjectAccess(ctx, projectId)
  const body = await parseBody(req)
  if (!body.title) throw new HttpError(400, 'title is required')
  const { data, error } = await ctx.supabase.from('submittals').insert({
    project_id: projectId, title: body.title, description: body.description || '',
    status: 'draft',
  }).select().single()
  if (error) throw new HttpError(422, error.message)
  return jsonResponse(data, 201)
}

// Daily Logs
async function listDailyLogs(ctx: ApiKeyContext, match: RegExpMatchArray, _r: Request, url: URL) {
  requireScope(ctx, 'read:daily_logs')
  const projectId = param(match, 1)
  await verifyProjectAccess(ctx, projectId)
  const { cursor, limit } = parsePagination(url)
  let query = ctx.supabase.from('daily_logs').select('id, log_date, status, workers_onsite, total_hours, incidents, weather, summary, created_at').eq('project_id', projectId).order('log_date', { ascending: false }).limit(limit + 1)
  if (cursor) query = query.lt('id', cursor)
  const { data, error } = await query
  if (error) throw new HttpError(500, 'Failed to fetch daily logs')
  return jsonResponse(paginatedResponse(data ?? [], limit))
}

async function createDailyLog(ctx: ApiKeyContext, match: RegExpMatchArray, req: Request, _url: URL) {
  requireScope(ctx, 'write:daily_logs')
  const projectId = param(match, 1)
  await verifyProjectAccess(ctx, projectId)
  const body = await parseBody(req)
  const { data, error } = await ctx.supabase.from('daily_logs').insert({
    project_id: projectId, log_date: body.log_date || new Date().toISOString().slice(0, 10),
    status: 'draft', summary: body.summary || '',
  }).select().single()
  if (error) throw new HttpError(422, error.message)
  return jsonResponse(data, 201)
}

// Change Orders
async function listChangeOrders(ctx: ApiKeyContext, match: RegExpMatchArray, _r: Request, url: URL) {
  requireScope(ctx, 'read:change_orders')
  const projectId = param(match, 1)
  await verifyProjectAccess(ctx, projectId)
  const { cursor, limit } = parsePagination(url)
  let query = ctx.supabase.from('change_orders').select('id, title, description, amount, status, type, reason_code, created_at, updated_at').eq('project_id', projectId).order('created_at', { ascending: false }).limit(limit + 1)
  if (cursor) query = query.lt('id', cursor)
  const { data, error } = await query
  if (error) throw new HttpError(500, 'Failed to fetch change orders')
  return jsonResponse(paginatedResponse(data ?? [], limit))
}

async function createChangeOrder(ctx: ApiKeyContext, match: RegExpMatchArray, req: Request, _url: URL) {
  requireScope(ctx, 'write:change_orders')
  const projectId = param(match, 1)
  await verifyProjectAccess(ctx, projectId)
  const body = await parseBody(req)
  if (!body.title) throw new HttpError(400, 'title is required')
  if (body.amount === undefined) throw new HttpError(400, 'amount is required')
  const { data, error } = await ctx.supabase.from('change_orders').insert({
    project_id: projectId, title: body.title, description: body.description || '',
    amount: body.amount, status: 'draft', type: body.type || 'pco', reason_code: body.reason_code || null,
  }).select().single()
  if (error) throw new HttpError(422, error.message)
  return jsonResponse(data, 201)
}

// Budget
async function getBudget(ctx: ApiKeyContext, match: RegExpMatchArray, _r: Request, _url: URL) {
  requireScope(ctx, 'read:budget')
  const projectId = param(match, 1)
  await verifyProjectAccess(ctx, projectId)
  const { data, error } = await ctx.supabase.from('budget_items').select('id, division, original_amount, actual_amount, percent_complete, status, created_at').eq('project_id', projectId).order('division')
  if (error) throw new HttpError(500, 'Failed to fetch budget')
  const totalBudget = (data ?? []).reduce((s, b) => s + (b.original_amount || 0), 0)
  const totalSpent = (data ?? []).reduce((s, b) => s + (b.actual_amount || 0), 0)
  return jsonResponse({ items: data ?? [], summary: { total_budget: totalBudget, total_spent: totalSpent, percent_spent: totalBudget > 0 ? Math.round(totalSpent / totalBudget * 100) : 0 } })
}

// Members
async function listMembers(ctx: ApiKeyContext, match: RegExpMatchArray, _r: Request, _url: URL) {
  requireScope(ctx, 'read')
  const projectId = param(match, 1)
  await verifyProjectAccess(ctx, projectId)
  const { data, error } = await ctx.supabase.from('project_members').select('id, user_id, role, company, trade, accepted_at, created_at').eq('project_id', projectId)
  if (error) throw new HttpError(500, 'Failed to fetch members')
  return jsonResponse({ data: data ?? [] })
}

// Punch Items
async function listPunchItems(ctx: ApiKeyContext, match: RegExpMatchArray, _r: Request, url: URL) {
  requireScope(ctx, 'read:punch_items')
  const projectId = param(match, 1)
  await verifyProjectAccess(ctx, projectId)
  const { cursor, limit } = parsePagination(url)
  let query = ctx.supabase.from('punch_items').select('id, item_number, title, description, status, priority, assigned_to, location, due_date, created_at').eq('project_id', projectId).order('item_number', { ascending: false }).limit(limit + 1)
  if (cursor) query = query.lt('id', cursor)
  const { data, error } = await query
  if (error) throw new HttpError(500, 'Failed to fetch punch items')
  return jsonResponse(paginatedResponse(data ?? [], limit))
}

async function createPunchItem(ctx: ApiKeyContext, match: RegExpMatchArray, req: Request, _url: URL) {
  requireScope(ctx, 'write:punch_items')
  const projectId = param(match, 1)
  await verifyProjectAccess(ctx, projectId)
  const body = await parseBody(req)
  if (!body.title) throw new HttpError(400, 'title is required')
  const { data, error } = await ctx.supabase.from('punch_items').insert({
    project_id: projectId, title: body.title, description: body.description || '',
    status: 'open', priority: body.priority || 'medium',
    assigned_to: body.assigned_to || null, location: body.location || null,
  }).select().single()
  if (error) throw new HttpError(422, error.message)
  return jsonResponse(data, 201)
}
