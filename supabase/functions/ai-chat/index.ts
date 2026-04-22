
import {
  handleCors,
  getCorsHeaders,
  authenticateRequest,
  verifyProjectMembership,
  requireUuid,
  sanitizeForPrompt,
  sanitizeText,
  escapeIlike,
  parseJsonBody,
  errorResponse,
  HttpError,
} from '../shared/auth.ts'

// ── Constants ────────────────────────────────────────────

const MAX_MESSAGES = 50
const MAX_TOOL_ROUNDS = 5
const DAILY_RATE_LIMIT = 50

// ── HTML Sanitization ────────────────────────────────────
// Strip scripts, dangerous embed tags, and inline event handlers from
// AI-generated output before returning to the client.
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<(iframe|object|embed|svg|img)[^>]*on\w+=[^>]*>/gi, '')
    .replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/<(iframe|object|embed)\b[^>]*>/gi, '')
}

// Tool permissions: which minimum role is required to use each tool
const TOOL_PERMISSIONS: Record<string, string> = {
  query_rfis: 'viewer',
  query_submittals: 'viewer',
  query_tasks: 'viewer',
  query_budget: 'superintendent', // budget data is sensitive
  query_schedule: 'viewer',
  query_daily_logs: 'viewer',
  search_everything: 'viewer',
  get_project_health: 'viewer',
  create_rfi: 'superintendent',
  create_task: 'superintendent',
  update_status: 'superintendent',
}

// ── Tool Definitions ─────────────────────────────────────

const tools = [
  {
    name: 'query_rfis',
    description: 'Search and retrieve RFIs with optional filters.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['open', 'under_review', 'answered', 'closed', 'void'] },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        overdue: { type: 'boolean' },
        assigned_to: { type: 'string' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'query_submittals',
    description: 'Search and retrieve submittals with optional filters.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['draft', 'submitted', 'under_review', 'approved', 'rejected', 'resubmit'] },
        overdue: { type: 'boolean' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'query_tasks',
    description: 'Search and retrieve tasks with optional filters.',
    input_schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['todo', 'in_progress', 'in_review', 'done'] },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        overdue: { type: 'boolean' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'query_budget',
    description: 'Get budget data by division or change order summary.',
    input_schema: {
      type: 'object',
      properties: { type: { type: 'string', enum: ['summary', 'divisions', 'change_orders'] } },
      required: ['type'],
    },
  },
  {
    name: 'query_schedule',
    description: 'Get schedule data: phases, milestones, or critical path.',
    input_schema: {
      type: 'object',
      properties: { type: { type: 'string', enum: ['phases', 'milestones', 'critical_path'] } },
      required: ['type'],
    },
  },
  {
    name: 'query_daily_logs',
    description: 'Get daily log entries for a date range.',
    input_schema: {
      type: 'object',
      properties: { days: { type: 'number' } },
    },
  },
  {
    name: 'create_rfi',
    description: 'Create a new RFI. ALWAYS ask for user confirmation first.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        assigned_to: { type: 'string' },
      },
      required: ['title'],
    },
  },
  {
    name: 'create_task',
    description: 'Create a new task. ALWAYS ask for user confirmation first.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        priority: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
        due_date: { type: 'string' },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_status',
    description: 'Update entity status. ALWAYS ask for user confirmation first.',
    input_schema: {
      type: 'object',
      properties: {
        entity_type: { type: 'string', enum: ['rfi', 'task', 'submittal'] },
        entity_id: { type: 'string' },
        new_status: { type: 'string' },
      },
      required: ['entity_type', 'entity_id', 'new_status'],
    },
  },
  {
    name: 'get_project_health',
    description: 'Get composite project health score.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'search_everything',
    description: 'Full text search across all project entities.',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string' } },
      required: ['query'],
    },
  },
]

// ── Tool Execution ───────────────────────────────────────

async function executeTool(
  supabase: any,
  projectId: string,
  userRole: string,
  toolName: string,
  toolInput: any,
): Promise<any> {
  // Check tool-level permission
  const requiredRole = TOOL_PERMISSIONS[toolName]
  if (requiredRole && !isRoleAtLeast(userRole, requiredRole)) {
    return { error: `Permission denied: your role (${userRole}) cannot use ${toolName}` }
  }

  const today = new Date().toISOString().slice(0, 10)
  const limit = Math.min(Math.max(toolInput.limit || 20, 1), 100) // clamp 1-100

  switch (toolName) {
    case 'query_rfis': {
      let query = supabase.from('rfis').select('id, rfi_number, title, status, priority, assigned_to, due_date, created_at').eq('project_id', projectId)
      if (toolInput.status) query = query.eq('status', toolInput.status)
      if (toolInput.priority) query = query.eq('priority', toolInput.priority)
      if (toolInput.assigned_to) query = query.ilike('assigned_to', `%${escapeIlike(sanitizeText(toolInput.assigned_to))}%`)
      if (toolInput.overdue) query = query.lt('due_date', today).not('status', 'in', '("closed","answered","void")')
      const { data, error } = await query.order('created_at', { ascending: false }).limit(limit)
      if (error) return { error: error.message }
      return { rfis: data || [], count: (data || []).length }
    }

    case 'query_submittals': {
      let query = supabase.from('submittals').select('id, submittal_number, title, status, spec_section, due_date, created_at').eq('project_id', projectId)
      if (toolInput.status) query = query.eq('status', toolInput.status)
      if (toolInput.overdue) query = query.lt('due_date', today).not('status', 'in', '("approved","closed")')
      const { data, error } = await query.order('created_at', { ascending: false }).limit(limit)
      if (error) return { error: error.message }
      return { submittals: data || [], count: (data || []).length }
    }

    case 'query_tasks': {
      let query = supabase.from('tasks').select('id, title, status, priority, assigned_to, due_date, percent_complete, created_at').eq('project_id', projectId)
      if (toolInput.status) query = query.eq('status', toolInput.status)
      if (toolInput.priority) query = query.eq('priority', toolInput.priority)
      if (toolInput.overdue) query = query.lt('due_date', today).neq('status', 'done')
      const { data, error } = await query.order('created_at', { ascending: false }).limit(limit)
      if (error) return { error: error.message }
      return { tasks: data || [], count: (data || []).length }
    }

    case 'query_budget': {
      if (toolInput.type === 'change_orders') {
        const { data, error } = await supabase.from('change_orders').select('id, title, amount, status, type').eq('project_id', projectId).order('created_at', { ascending: false }).limit(50)
        if (error) return { error: error.message }
        return { change_orders: data || [] }
      }
      const { data, error } = await supabase.from('budget_items').select('division, original_amount, actual_amount').eq('project_id', projectId)
      if (error) return { error: error.message }
      const divisions = new Map<string, { budget: number; spent: number }>()
      for (const item of (data || [])) {
        const name = item.division || 'Other'
        const existing = divisions.get(name) || { budget: 0, spent: 0 }
        existing.budget += item.original_amount || 0
        existing.spent += item.actual_amount || 0
        divisions.set(name, existing)
      }
      return { divisions: Array.from(divisions.entries()).map(([name, d]) => ({ division: name, budget: d.budget, spent: d.spent })) }
    }

    case 'query_schedule': {
      if (toolInput.type === 'critical_path') {
        const { data, error } = await supabase.from('tasks').select('id, title, status, due_date').eq('project_id', projectId).eq('is_critical_path', true).order('due_date').limit(50)
        if (error) return { error: error.message }
        return { critical_path_items: data || [] }
      }
      const { data, error } = await supabase.from('schedule_phases').select('id, name, status, percent_complete, start_date, end_date').eq('project_id', projectId).order('start_date')
      if (error) return { error: error.message }
      return { phases: data || [] }
    }

    case 'query_daily_logs': {
      const days = Math.min(Math.max(toolInput.days || 7, 1), 90)
      const startDate = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
      const { data, error } = await supabase.from('daily_logs').select('id, log_date, workers_onsite, total_hours, incidents, weather, summary, status').eq('project_id', projectId).gte('log_date', startDate).order('log_date', { ascending: false })
      if (error) return { error: error.message }
      return { daily_logs: data || [] }
    }

    case 'create_rfi': {
      const { data, error } = await supabase.from('rfis').insert({
        project_id: projectId,
        title: sanitizeText(toolInput.title),
        description: sanitizeText(toolInput.description || ''),
        priority: toolInput.priority || 'medium',
        assigned_to: toolInput.assigned_to ? sanitizeText(toolInput.assigned_to) : null,
        status: 'open',
      }).select().single()
      if (error) return { error: error.message }
      return { created: true, rfi: data }
    }

    case 'create_task': {
      const { data, error } = await supabase.from('tasks').insert({
        project_id: projectId,
        title: sanitizeText(toolInput.title),
        description: sanitizeText(toolInput.description || ''),
        priority: toolInput.priority || 'medium',
        due_date: toolInput.due_date || null,
        status: 'todo',
      }).select().single()
      if (error) return { error: error.message }
      return { created: true, task: data }
    }

    case 'update_status': {
      requireUuid(toolInput.entity_id, 'entity_id')
      const tableMap: Record<string, string> = { rfi: 'rfis', task: 'tasks', submittal: 'submittals' }
      const table = tableMap[toolInput.entity_type]
      if (!table) return { error: `Unknown entity type: ${toolInput.entity_type}` }
      const { error } = await supabase.from(table).update({ status: toolInput.new_status }).eq('id', toolInput.entity_id).eq('project_id', projectId)
      if (error) return { error: error.message }
      return { updated: true }
    }

    case 'get_project_health': {
      const [rfis, tasks, budget] = await Promise.all([
        supabase.from('rfis').select('id, status, due_date').eq('project_id', projectId),
        supabase.from('tasks').select('id, status, due_date').eq('project_id', projectId),
        supabase.from('budget_items').select('original_amount, actual_amount').eq('project_id', projectId),
      ])
      const openRfis = (rfis.data || []).filter((r: any) => ['open', 'under_review'].includes(r.status)).length
      const overdueTasks = (tasks.data || []).filter((t: any) => t.due_date && t.due_date < today && t.status !== 'done').length
      const totalBudget = (budget.data || []).reduce((s: number, b: any) => s + (b.original_amount || 0), 0)
      const totalSpent = (budget.data || []).reduce((s: number, b: any) => s + (b.actual_amount || 0), 0)
      return { open_rfis: openRfis, overdue_tasks: overdueTasks, budget_percent: totalBudget > 0 ? Math.round(totalSpent / totalBudget * 100) : 0 }
    }

    case 'search_everything': {
      const q = `%${escapeIlike(sanitizeText(toolInput.query))}%`
      const [rfis, tasks, submittals] = await Promise.all([
        supabase.from('rfis').select('id, rfi_number, title, status').eq('project_id', projectId).ilike('title', q).limit(5),
        supabase.from('tasks').select('id, title, status').eq('project_id', projectId).ilike('title', q).limit(5),
        supabase.from('submittals').select('id, submittal_number, title, status').eq('project_id', projectId).ilike('title', q).limit(5),
      ])
      return { rfis: rfis.data || [], tasks: tasks.data || [], submittals: submittals.data || [] }
    }

    default:
      return { error: `Unknown tool: ${toolName}` }
  }
}

function isRoleAtLeast(userRole: string, minRole: string): boolean {
  const levels: Record<string, number> = { owner: 6, admin: 5, project_manager: 4, superintendent: 3, subcontractor: 2, viewer: 1 }
  return (levels[userRole] ?? 0) >= (levels[minRole] ?? 0)
}

// ── Main Handler ─────────────────────────────────────────

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse

  const cors = getCorsHeaders(req)

  try {
    // SECURITY: Authenticate user (no more service role key)
    const { user, supabase } = await authenticateRequest(req)

    const body = await parseJsonBody<{
      messages: Array<{ role: string; content: string }>
      projectContext?: { projectId?: string; page?: string; entityContext?: string }
    }>(req)

    const { messages, projectContext } = body

    // Validate messages
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new HttpError(400, 'Messages array is required')
    }
    if (messages.length > MAX_MESSAGES) {
      throw new HttpError(400, `Maximum ${MAX_MESSAGES} messages allowed`)
    }
    // Validate each message has required fields
    for (const msg of messages) {
      if (!msg || typeof msg.role !== 'string' || typeof msg.content !== 'string') {
        throw new HttpError(400, 'Each message must have role and content strings')
      }
      if (msg.content.length > 10000) {
        throw new HttpError(400, 'Individual message content must be under 10,000 characters')
      }
    }

    // Validate projectContext fields
    if (projectContext) {
      if (projectContext.page && typeof projectContext.page !== 'string') {
        throw new HttpError(400, 'projectContext.page must be a string')
      }
      if (projectContext.entityContext && typeof projectContext.entityContext !== 'string') {
        throw new HttpError(400, 'projectContext.entityContext must be a string')
      }
      if (projectContext.page && projectContext.page.length > 100) {
        throw new HttpError(400, 'projectContext.page must be under 100 characters')
      }
      if (projectContext.entityContext && projectContext.entityContext.length > 2000) {
        throw new HttpError(400, 'projectContext.entityContext must be under 2000 characters')
      }
    }

    // Validate and verify project access
    const projectId = requireUuid(projectContext?.projectId, 'projectId')
    const userRole = await verifyProjectMembership(supabase, user.id, projectId)

    // Rate limit
    const { data: allowed } = await supabase.rpc('check_ai_rate_limit', { p_user_id: user.id, p_limit: DAILY_RATE_LIMIT })
    if (allowed === false) {
      throw new HttpError(429, `Daily AI usage limit reached (${DAILY_RATE_LIMIT} queries). Please try again tomorrow.`)
    }

    // Build sanitized context
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) throw new HttpError(503, 'AI service not configured')

    let contextSummary = ''
    const { data: project } = await supabase.from('projects').select('name, status, contract_value, target_completion').eq('id', projectId).single()
    if (project) {
      const daysRemaining = project.target_completion ? Math.max(0, Math.ceil((new Date(project.target_completion).getTime() - Date.now()) / 86400000)) : 0
      contextSummary = `Project: ${sanitizeForPrompt(project.name)}, Status: ${project.status}, Contract: $${((project.contract_value || 0) / 1e6).toFixed(1)}M, Days Remaining: ${daysRemaining}`
    }

    const currentPage = sanitizeForPrompt(projectContext?.page || 'dashboard')
    const entityContext = projectContext?.entityContext ? sanitizeForPrompt(projectContext.entityContext) : ''

    const systemPrompt = `You are SiteSync AI, an expert construction project management assistant. Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

${contextSummary ? `CURRENT PROJECT:\n${contextSummary}\n` : ''}
${entityContext ? `USER IS VIEWING:\n${entityContext}\n` : ''}
The user is on the "${currentPage}" page. Their role is "${userRole}".

RULES:
1. ALWAYS use tools to get real data before answering.
2. For CREATE or UPDATE actions, describe what you plan to do and ask the user to confirm using: [ACTION_PENDING: description]
3. Reference entities with: [ENTITY:type:id:label]
4. Be concise and actionable. Use construction terminology.
5. Never use hyphens. Format currency with $ ($1.2M, $45K).
6. After answering, suggest 2 to 3 follow up questions.
7. When tool results include a "ui_type" field, the frontend will render interactive UI. Include these in tool results where appropriate.

GENERATIVE UI TYPES (return as tool result with ui_type field):
- data_table: Interactive table with columns, rows, actions
- metric_cards: Summary metric cards with trends
- chart: Bar, line, pie, area charts
- timeline: Event timelines with status
- checklist: Interactive checklists
- comparison: Side by side comparisons
- form: Dynamic forms for entity creation
- approval_card: Approve/reject workflows
- schedule_card: Task details with progress, crew, dependencies, float, critical path
- cost_breakdown: Budget line items with variance, spend tracking, status
- safety_alert: Safety observations with severity, location, recommended actions, OSHA reference
- rfi_response: RFI question/response with attachments, priority, days open
- photo_grid: Progress photos with before/after pairs, tags, annotations`

    // Format messages (sanitize user content)
    const apiMessages = messages.map((m) => ({
      role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
      content: m.role === 'user' ? sanitizeText(m.content) : m.content,
    }))

    // Tool use loop
    let currentMessages = apiMessages
    let finalResponse = ''
    const toolResults: any[] = []

    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': anthropicKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: systemPrompt,
          messages: currentMessages,
          tools,
        }),
      })

      if (!response.ok) {
        throw new HttpError(502, 'AI service temporarily unavailable')
      }

      const result = await response.json()
      const hasToolUse = result.content?.some((block: any) => block.type === 'tool_use')

      if (!hasToolUse || result.stop_reason === 'end_turn') {
        finalResponse = (result.content || [])
          .filter((block: any) => block.type === 'text')
          .map((block: any) => block.text)
          .join('\n')
        break
      }

      const toolUseBlocks = result.content.filter((block: any) => block.type === 'tool_use')
      const toolResultBlocks: any[] = []

      for (const toolBlock of toolUseBlocks) {
        const toolResult = await executeTool(supabase, projectId, userRole, toolBlock.name, toolBlock.input)
        toolResults.push({ tool: toolBlock.name, input: toolBlock.input, result: toolResult })
        toolResultBlocks.push({
          type: 'tool_result',
          tool_use_id: toolBlock.id,
          content: JSON.stringify(toolResult),
        })
      }

      currentMessages = [
        ...currentMessages,
        { role: 'assistant' as const, content: result.content },
        { role: 'user' as const, content: toolResultBlocks },
      ]
    }

    // Track usage (via user-scoped client, respects RLS)
    supabase.from('ai_usage').insert({
      project_id: projectId,
      user_id: user.id,
      function_name: 'ai_chat',
      model: 'claude-sonnet-4-20250514',
    }).then(() => {})

    // Sanitize output: strip scripts, dangerous tags, event handlers
    const sanitizedResponse = sanitizeHtml(finalResponse)

    return new Response(
      JSON.stringify({ content: sanitizedResponse, tool_results: toolResults }),
      { headers: { ...cors, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return errorResponse(error, cors)
  }
})
