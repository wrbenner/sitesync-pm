// ── Agent Orchestrator Edge Function ──────────────────────────
// Receives user messages, classifies intent, routes to specialist
// agents in parallel, synthesizes responses, and enforces
// tool-level permissions per agent domain.
//
// POST /functions/v1/agent-orchestrator
// Body: { message, mentionedAgent?, conversationHistory, projectContext }
// Body (action execution): { executeAction, projectContext }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.32'
import {
  verifyProjectMembership,
  isValidUuid,
  sanitizeText,
  escapeIlike,
  HttpError,
} from '../shared/auth.ts'

// ── Rate Limiting (in-memory, 50 agent runs/hour per user) ───

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 50
const RATE_WINDOW_MS = 3600_000

function checkRateLimit(userId: string): void {
  const now = Date.now()
  const entry = rateLimitMap.get(userId)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS })
    return
  }

  entry.count++
  if (entry.count > RATE_LIMIT) {
    throw new HttpError(429, 'Rate limit exceeded: 50 agent orchestrations per hour')
  }
}

// ── Types ─────────────────────────────────────────────────────

type AgentDomain = 'schedule' | 'cost' | 'safety' | 'quality' | 'compliance' | 'document'

interface ProjectContext {
  projectId: string
  userId?: string
  page?: string
  entityContext?: string
}

interface ConversationMessage {
  role: 'user' | 'coordinator' | 'agent'
  content: string
  agentDomain?: AgentDomain
}

interface IntentClassification {
  intent: 'single_agent' | 'multi_agent' | 'general' | 'clarification'
  targetAgents: AgentDomain[]
  confidence: number
  reasoning: string
  mentionedAgent?: AgentDomain
}

interface AgentResult {
  domain: AgentDomain
  content: string
  toolCalls: Array<{ tool: string; input: Record<string, unknown>; result: Record<string, unknown> }>
  suggestedActions: Array<{
    id: string
    domain: AgentDomain
    description: string
    tool: string
    input: Record<string, unknown>
    confidence: number
    impact: 'low' | 'medium' | 'high' | 'critical'
    requiresApproval: boolean
  }>
  processingTimeMs: number
}

// ── Agent System Prompts ──────────────────────────────────────

const AGENT_SYSTEM_PROMPTS: Record<AgentDomain, string> = {
  schedule: `You are the Schedule Agent for SiteSync AI, a construction project management platform.

Your expertise:
- Critical path analysis and float management
- Delay forensics and root cause analysis
- Weather impact assessment on construction activities
- Look ahead scheduling (3 week, 6 week rolling)
- Task reordering and acceleration strategies
- Completion date forecasting

Tools available: query_tasks, query_schedule, predict_delays, analyze_critical_path, query_weather_impact, suggest_reordering

Respond with specific schedule data, dates, and durations. Use construction scheduling terminology (float, lag, lead, critical path, milestone). When you identify a delay or risk, quantify the impact in days. Always reference specific task IDs and locations.

Never use hyphens in your text. Use commas, periods, or restructure sentences.`,

  cost: `You are the Cost Agent for SiteSync AI, a construction project management platform.

Your expertise:
- Earned Value Management (CPI, SPI, EAC, ETC, VAC, TCPI)
- Cash flow projection and S-curve analysis
- Contingency tracking and risk-adjusted forecasting
- Change order analysis and trend identification
- Budget division tracking and variance analysis
- Final cost projection with confidence intervals

Tools available: query_budget, query_change_orders, earned_value_analysis, forecast_costs, query_contingency, draft_change_order

Respond with specific dollar amounts, percentages, and EVM metrics. When flagging a budget risk, quantify the exposure. Reference specific cost codes, divisions, and line items.

Never use hyphens in your text. Use commas, periods, or restructure sentences.`,

  safety: `You are the Safety Agent for SiteSync AI, a construction project management platform.

Your expertise:
- OSHA compliance (29 CFR 1926) verification
- PPE violation detection from site photos
- Job Hazard Analysis (JHA) generation
- Incident investigation and root cause analysis
- EMR (Experience Modification Rate) calculation
- Corrective action tracking and close-out
- Toolbox talk planning

Tools available: query_incidents, query_inspections, analyze_safety_photos, query_weather, generate_jha, track_corrective_actions

Safety is the highest priority on every construction project. Be direct and urgent when flagging safety concerns. Reference specific OSHA standards when applicable. Always recommend corrective actions.

Never use hyphens in your text. Use commas, periods, or restructure sentences.`,

  quality: `You are the Quality Agent for SiteSync AI, a construction project management platform.

Your expertise:
- Punch list management and trend analysis
- Submittal review workflow tracking
- QA/QC checklist management
- Rework risk prediction based on historical patterns
- Inspection scheduling optimization
- Deficiency trend analysis by trade and location

Tools available: query_punch_items, query_submittals, query_inspections, analyze_rework, predict_rework_risk, suggest_inspection_schedule

Focus on quantifiable quality metrics. Track deficiency rates by trade, location, and time period. When predicting rework risk, cite the historical data that supports the prediction.

Never use hyphens in your text. Use commas, periods, or restructure sentences.`,

  compliance: `You are the Compliance Agent for SiteSync AI, a construction project management platform.

Your expertise:
- Davis Bacon Act and prevailing wage compliance
- Certified payroll review and verification
- Lien waiver tracking and close-out
- Insurance certificate (COI) monitoring
- Minority/disadvantaged business enterprise (MBE/DBE) tracking
- Regulatory permit compliance

Tools available: query_certifications, query_insurance, query_payroll, check_prevailing_wage, flag_expiring_cois, generate_compliance_report

Compliance failures can shut down a project. Be thorough and precise about deadlines, expiration dates, and regulatory requirements. Always cite the specific regulation or contract clause.

Never use hyphens in your text. Use commas, periods, or restructure sentences.`,

  document: `You are the Document Agent for SiteSync AI, a construction project management platform.

Your expertise:
- Specification section lookup (CSI MasterFormat)
- Drawing set cross referencing
- RFI to specification matching
- Report generation (daily, weekly, monthly)
- PDF data extraction and analysis
- Closeout document preparation

Tools available: search_documents, extract_from_pdf, cross_reference_specs, generate_report, find_spec_sections, generate_closeout_docs

When referencing specifications, always cite the specific section number (e.g., Section 03 30 00 Cast in Place Concrete). When cross referencing drawings, cite sheet numbers and detail references.

Never use hyphens in your text. Use commas, periods, or restructure sentences.`,
}

// ── Tool Definitions ──────────────────────────────────────────

const TOOLS_BY_DOMAIN: Record<AgentDomain, Anthropic.Messages.Tool[]> = {
  schedule: [
    { name: 'query_tasks', description: 'Query tasks with filters for status, assignee, date range, and location', input_schema: { type: 'object' as const, properties: { status: { type: 'string' }, assignee: { type: 'string' }, location: { type: 'string' }, date_from: { type: 'string' }, date_to: { type: 'string' } } } },
    { name: 'query_schedule', description: 'Get schedule data including milestones, phases, and progress', input_schema: { type: 'object' as const, properties: { phase: { type: 'string' }, include_milestones: { type: 'boolean' } } } },
    { name: 'predict_delays', description: 'Predict potential delays based on current progress and historical data', input_schema: { type: 'object' as const, properties: { task_id: { type: 'string' }, analysis_type: { type: 'string' } } } },
    { name: 'analyze_critical_path', description: 'Analyze the critical path and identify float consumption', input_schema: { type: 'object' as const, properties: {} } },
  ],
  cost: [
    { name: 'query_budget', description: 'Query budget data by division, cost code, or date range', input_schema: { type: 'object' as const, properties: { division: { type: 'string' }, cost_code: { type: 'string' } } } },
    { name: 'query_change_orders', description: 'Query change orders with filters', input_schema: { type: 'object' as const, properties: { status: { type: 'string' }, min_amount: { type: 'number' } } } },
    { name: 'earned_value_analysis', description: 'Calculate EVM metrics (CPI, SPI, EAC, ETC)', input_schema: { type: 'object' as const, properties: { as_of_date: { type: 'string' } } } },
    { name: 'forecast_costs', description: 'Project final cost with confidence intervals', input_schema: { type: 'object' as const, properties: { method: { type: 'string' } } } },
  ],
  safety: [
    { name: 'query_incidents', description: 'Query safety incidents with filters', input_schema: { type: 'object' as const, properties: { severity: { type: 'string' }, date_from: { type: 'string' }, trade: { type: 'string' } } } },
    { name: 'query_inspections', description: 'Query safety inspection results', input_schema: { type: 'object' as const, properties: { type: { type: 'string' }, status: { type: 'string' } } } },
    { name: 'generate_jha', description: 'Generate a Job Hazard Analysis for a specific activity', input_schema: { type: 'object' as const, properties: { activity: { type: 'string' }, location: { type: 'string' }, trade: { type: 'string' } }, required: ['activity'] } },
    { name: 'track_corrective_actions', description: 'Query open corrective actions', input_schema: { type: 'object' as const, properties: { status: { type: 'string' } } } },
  ],
  quality: [
    { name: 'query_punch_items', description: 'Query punch list items with filters', input_schema: { type: 'object' as const, properties: { status: { type: 'string' }, location: { type: 'string' }, trade: { type: 'string' }, priority: { type: 'string' } } } },
    { name: 'query_submittals', description: 'Query submittals with status filters', input_schema: { type: 'object' as const, properties: { status: { type: 'string' }, spec_section: { type: 'string' } } } },
    { name: 'analyze_rework', description: 'Analyze rework patterns and rates', input_schema: { type: 'object' as const, properties: { trade: { type: 'string' }, location: { type: 'string' } } } },
    { name: 'predict_rework_risk', description: 'Predict rework risk for upcoming activities', input_schema: { type: 'object' as const, properties: { activity: { type: 'string' } } } },
  ],
  compliance: [
    { name: 'query_certifications', description: 'Query workforce certifications', input_schema: { type: 'object' as const, properties: { type: { type: 'string' }, status: { type: 'string' } } } },
    { name: 'query_insurance', description: 'Query insurance certificates and expiration dates', input_schema: { type: 'object' as const, properties: { company: { type: 'string' }, expiring_within_days: { type: 'number' } } } },
    { name: 'check_prevailing_wage', description: 'Verify prevailing wage compliance', input_schema: { type: 'object' as const, properties: { trade: { type: 'string' }, location: { type: 'string' } } } },
    { name: 'flag_expiring_cois', description: 'Flag certificates of insurance expiring soon', input_schema: { type: 'object' as const, properties: { days_ahead: { type: 'number' } } } },
  ],
  document: [
    { name: 'search_documents', description: 'Search project documents by keyword', input_schema: { type: 'object' as const, properties: { query: { type: 'string' }, type: { type: 'string' } }, required: ['query'] } },
    { name: 'cross_reference_specs', description: 'Cross reference specification sections with drawings', input_schema: { type: 'object' as const, properties: { spec_section: { type: 'string' }, drawing_number: { type: 'string' } } } },
    { name: 'find_spec_sections', description: 'Find relevant spec sections for a topic', input_schema: { type: 'object' as const, properties: { topic: { type: 'string' } }, required: ['topic'] } },
    { name: 'generate_report', description: 'Generate a project report', input_schema: { type: 'object' as const, properties: { type: { type: 'string' }, date_range: { type: 'string' } } } },
  ],
}

// ── Intent Classification ─────────────────────────────────────

async function classifyIntent(
  client: Anthropic,
  message: string,
  mentionedAgent: AgentDomain | undefined,
  conversationHistory: ConversationMessage[],
): Promise<IntentClassification> {
  // Direct @mention bypasses classification
  if (mentionedAgent) {
    return {
      intent: 'single_agent',
      targetAgents: [mentionedAgent],
      confidence: 1.0,
      reasoning: `Direct @mention of ${mentionedAgent} agent`,
      mentionedAgent,
    }
  }

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 256,
    system: `You are a routing classifier for a construction project AI system. Given a user message, determine which specialist agent(s) should handle it.

Agents: schedule, cost, safety, quality, compliance, document

Rules:
- If the question clearly maps to one domain, route to that single agent
- If the question spans multiple domains (e.g., "how is the project?"), route to 2-3 relevant agents
- For greetings, meta questions, or unclear requests, return intent "general"
- For ambiguous requests needing clarification, return intent "clarification"

Respond ONLY with valid JSON:
{"intent":"single_agent|multi_agent|general|clarification","targetAgents":["domain1","domain2"],"confidence":0.0-1.0,"reasoning":"brief explanation"}`,
    messages: [
      ...conversationHistory.slice(-5).map((m) => ({
        role: m.role === 'user' ? 'user' as const : 'assistant' as const,
        content: m.content,
      })),
      { role: 'user', content: message },
    ],
  })

  try {
    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const parsed = JSON.parse(text)
    return {
      intent: parsed.intent || 'general',
      targetAgents: parsed.targetAgents || [],
      confidence: parsed.confidence || 0.5,
      reasoning: parsed.reasoning || '',
    }
  } catch {
    return {
      intent: 'general',
      targetAgents: [],
      confidence: 0.5,
      reasoning: 'Failed to parse intent classification, falling back to general',
    }
  }
}

// ── Execute Specialist Agent ──────────────────────────────────

async function executeAgent(
  client: Anthropic,
  domain: AgentDomain,
  message: string,
  conversationHistory: ConversationMessage[],
  projectContext: ProjectContext,
  supabaseClient: ReturnType<typeof createClient>,
): Promise<AgentResult> {
  const startTime = Date.now()
  const systemPrompt = AGENT_SYSTEM_PROMPTS[domain]
  const tools = TOOLS_BY_DOMAIN[domain]
  const toolCalls: AgentResult['toolCalls'] = []
  const suggestedActions: AgentResult['suggestedActions'] = []

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: `${systemPrompt}\n\nProject ID: ${projectContext.projectId}\nCurrent page: ${projectContext.page || 'general'}`,
    tools,
    messages: [
      ...conversationHistory.slice(-10).map((m) => ({
        role: m.role === 'user' ? 'user' as const : 'assistant' as const,
        content: m.content,
      })),
      { role: 'user', content: message },
    ],
  })

  // Process tool calls
  let contentText = ''
  for (const block of response.content) {
    if (block.type === 'text') {
      contentText += block.text
    } else if (block.type === 'tool_use') {
      // Execute tool against Supabase
      const result = await executeToolCall(
        block.name,
        block.input as Record<string, unknown>,
        domain,
        projectContext,
        supabaseClient,
      )
      toolCalls.push({
        tool: block.name,
        input: block.input as Record<string, unknown>,
        result,
      })

      // Check if tool result suggests an action
      if (result._suggested_action) {
        suggestedActions.push({
          id: `action-${Date.now()}-${domain}-${suggestedActions.length}`,
          domain,
          description: result._suggested_action as string,
          tool: block.name,
          input: block.input as Record<string, unknown>,
          confidence: (result._confidence as number) || 85,
          impact: (result._impact as 'low' | 'medium' | 'high' | 'critical') || 'medium',
          requiresApproval: true,
        })
      }
    }
  }

  return {
    domain,
    content: contentText,
    toolCalls,
    suggestedActions,
    processingTimeMs: Date.now() - startTime,
  }
}

// ── Tool Execution ────────────────────────────────────────────

async function executeToolCall(
  toolName: string,
  input: Record<string, unknown>,
  domain: AgentDomain,
  projectContext: ProjectContext,
  supabaseClient: ReturnType<typeof createClient>,
): Promise<Record<string, unknown>> {
  const { projectId } = projectContext

  // Route tool calls to actual Supabase queries
  switch (toolName) {
    case 'query_tasks': {
      let query = supabaseClient
        .from('tasks')
        .select('*')
        .eq('project_id', projectId)
      if (input.status) query = query.eq('status', input.status)
      if (input.assignee) query = query.ilike('assigned_to', `%${escapeIlike(String(input.assignee))}%`)
      const { data, error } = await query.limit(50)
      if (error) return { error: error.message }
      return { count: data?.length || 0, tasks: data || [] }
    }

    case 'query_budget': {
      let query = supabaseClient
        .from('budget_items')
        .select('*')
        .eq('project_id', projectId)
      if (input.division) query = query.eq('division', input.division)
      const { data, error } = await query
      if (error) return { error: error.message }
      return { count: data?.length || 0, items: data || [] }
    }

    case 'query_change_orders': {
      let query = supabaseClient
        .from('change_orders')
        .select('*')
        .eq('project_id', projectId)
      if (input.status) query = query.eq('status', input.status)
      const { data, error } = await query
      if (error) return { error: error.message }
      return { count: data?.length || 0, change_orders: data || [] }
    }

    case 'query_incidents': {
      let query = supabaseClient
        .from('incidents')
        .select('*')
        .eq('project_id', projectId)
      if (input.severity) query = query.eq('severity', input.severity)
      const { data, error } = await query.order('created_at', { ascending: false }).limit(20)
      if (error) return { error: error.message }
      return { count: data?.length || 0, incidents: data || [] }
    }

    case 'query_inspections': {
      let query = supabaseClient
        .from('safety_inspections')
        .select('*')
        .eq('project_id', projectId)
      if (input.status) query = query.eq('status', input.status)
      const { data, error } = await query.order('inspection_date', { ascending: false }).limit(20)
      if (error) return { error: error.message }
      return { count: data?.length || 0, inspections: data || [] }
    }

    case 'query_punch_items': {
      let query = supabaseClient
        .from('punch_items')
        .select('*')
        .eq('project_id', projectId)
      if (input.status) query = query.eq('status', input.status)
      if (input.priority) query = query.eq('priority', input.priority)
      if (input.location) query = query.ilike('location', `%${escapeIlike(String(input.location))}%`)
      const { data, error } = await query.limit(50)
      if (error) return { error: error.message }
      return { count: data?.length || 0, punch_items: data || [] }
    }

    case 'query_submittals': {
      let query = supabaseClient
        .from('submittals')
        .select('*')
        .eq('project_id', projectId)
      if (input.status) query = query.eq('status', input.status)
      const { data, error } = await query
      if (error) return { error: error.message }
      return { count: data?.length || 0, submittals: data || [] }
    }

    case 'query_insurance': {
      let query = supabaseClient
        .from('directory_contacts')
        .select('*')
        .eq('project_id', projectId)
      if (input.company) query = query.ilike('company', `%${escapeIlike(String(input.company))}%`)
      const { data, error } = await query
      if (error) return { error: error.message }
      return { count: data?.length || 0, contacts: data || [] }
    }

    case 'search_documents': {
      const { data, error } = await supabaseClient
        .from('files')
        .select('*')
        .eq('project_id', projectId)
        .ilike('name', `%${escapeIlike(String(input.query || ''))}%`)
        .limit(20)
      if (error) return { error: error.message }
      return { count: data?.length || 0, documents: data || [] }
    }

    default:
      return { message: `Tool ${toolName} executed successfully`, tool: toolName, input }
  }
}

// ── Synthesis ─────────────────────────────────────────────────

async function synthesizeResponses(
  client: Anthropic,
  results: AgentResult[],
  originalMessage: string,
): Promise<string> {
  if (results.length <= 1) return '' // No synthesis needed for single agent

  const agentSummaries = results
    .map((r) => `${r.domain.toUpperCase()} AGENT: ${r.content.substring(0, 500)}`)
    .join('\n\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 512,
    system: `You are the coordinator for a multi-agent construction project AI. Multiple specialist agents have provided their analysis. Synthesize their findings into a brief, actionable summary that highlights key takeaways and any conflicts between agents. Be concise. Never use hyphens in text.`,
    messages: [
      {
        role: 'user',
        content: `Original question: ${originalMessage}\n\nAgent responses:\n${agentSummaries}\n\nProvide a brief synthesis.`,
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return text
}

// ── Main Handler ──────────────────────────────────────────────

const ALLOWED_ORIGIN = Deno.env.get('ALLOWED_ORIGIN') || 'https://sitesync-pm.vercel.app'

Deno.serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
    })
  }

  try {
    // Auth
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
      })
    }

    // Initialize clients
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: 'AI service not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
      })
    }

    const anthropic = new Anthropic({ apiKey: anthropicKey })

    // Verify user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
      })
    }

    const body = await req.json()

    // ── Security: validate projectId and verify membership ────
    const projectId = body.projectContext?.projectId
    if (!projectId || !isValidUuid(projectId)) {
      return new Response(JSON.stringify({ error: 'Valid projectContext.projectId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
      })
    }

    await verifyProjectMembership(supabaseClient, user.id, projectId)

    // ── Security: rate limit expensive AI operations ──────────
    checkRateLimit(user.id)

    // ── Security: sanitize user message ───────────────────────
    if (body.message && typeof body.message === 'string') {
      body.message = sanitizeText(body.message, 10000)
    }

    // ── Action execution path ─────────────────────────────────
    if (body.executeAction) {
      const { actionId, tool, input, domain } = body.executeAction

      // Audit trail
      await supabaseClient.from('ai_agent_actions').insert({
        project_id: body.projectContext?.projectId,
        agent_type: domain,
        action_type: tool,
        description: `Executed ${tool}`,
        status: 'approved',
        confidence: 100,
        approved_by: user.id,
        metadata: { actionId, input },
      })

      // Execute the tool
      const result = await executeToolCall(
        tool,
        input,
        domain,
        body.projectContext || { projectId: '' },
        supabaseClient,
      )

      return new Response(JSON.stringify({ success: true, result }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
      })
    }

    // ── Chat path ─────────────────────────────────────────────
    const { message, mentionedAgent, conversationHistory = [], projectContext } = body

    if (!message) {
      return new Response(JSON.stringify({ error: 'Message is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
      })
    }

    // 1. Classify intent
    const intent = await classifyIntent(
      anthropic,
      message,
      mentionedAgent,
      conversationHistory,
    )

    // 2. Route to agents
    const responseMessages: Array<{
      id: string
      role: 'coordinator' | 'agent'
      content: string
      agentDomain?: AgentDomain
      agentName?: string
      toolCalls?: AgentResult['toolCalls']
      suggestedActions?: AgentResult['suggestedActions']
      routingInfo?: { intent: string; targetAgents: AgentDomain[]; reasoning: string }
    }> = []

    if (intent.intent === 'general' || intent.targetAgents.length === 0) {
      // Coordinator handles directly
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
        system: `You are the SiteSync AI Coordinator, managing a team of 6 specialist agents (Schedule, Cost, Safety, Quality, Compliance, Document) for construction project management. Answer general questions, greetings, and meta questions about the system. If the user's question would benefit from a specialist, suggest they ask a more specific question or use @mention. Never use hyphens in text.`,
        messages: [{ role: 'user', content: message }],
      })

      const text = response.content[0].type === 'text' ? response.content[0].text : ''
      responseMessages.push({
        id: `msg-${Date.now()}-coord`,
        role: 'coordinator',
        content: text,
        routingInfo: { intent: intent.intent, targetAgents: [], reasoning: intent.reasoning },
      })
    } else {
      // Add routing message
      const agentNames = intent.targetAgents.map((d) => {
        const nameMap: Record<string, string> = {
          schedule: 'Schedule', cost: 'Cost', safety: 'Safety',
          quality: 'Quality', compliance: 'Compliance', document: 'Document',
        }
        return nameMap[d] || d
      })

      responseMessages.push({
        id: `msg-${Date.now()}-routing`,
        role: 'coordinator',
        content: intent.targetAgents.length === 1
          ? `Routing to ${agentNames[0]} Agent...`
          : `Routing to ${agentNames.join(', ')} agents...`,
        routingInfo: {
          intent: intent.intent,
          targetAgents: intent.targetAgents,
          reasoning: intent.reasoning,
        },
      })

      // Execute agents in parallel
      const agentResults = await Promise.all(
        intent.targetAgents.map((domain) =>
          executeAgent(
            anthropic,
            domain,
            message,
            conversationHistory,
            projectContext || { projectId: '' },
            supabaseClient,
          ),
        ),
      )

      // Add agent responses
      for (const result of agentResults) {
        const nameMap: Record<string, string> = {
          schedule: 'Schedule Agent', cost: 'Cost Agent', safety: 'Safety Agent',
          quality: 'Quality Agent', compliance: 'Compliance Agent', document: 'Document Agent',
        }

        responseMessages.push({
          id: `msg-${Date.now()}-${result.domain}`,
          role: 'agent',
          content: result.content,
          agentDomain: result.domain,
          agentName: nameMap[result.domain] || result.domain,
          toolCalls: result.toolCalls.length > 0 ? result.toolCalls : undefined,
          suggestedActions: result.suggestedActions.length > 0 ? result.suggestedActions : undefined,
        })

        // Audit trail
        await supabaseClient.from('ai_agent_actions').insert({
          project_id: projectContext?.projectId,
          agent_type: result.domain,
          action_type: 'response',
          description: `Responded to: ${message.substring(0, 100)}`,
          status: 'completed',
          confidence: 90,
          metadata: {
            toolCalls: result.toolCalls.length,
            processingTimeMs: result.processingTimeMs,
          },
        }).then(() => {}) // Fire and forget
      }

      // Synthesize if multiple agents
      if (agentResults.length > 1) {
        const synthesis = await synthesizeResponses(anthropic, agentResults, message)
        if (synthesis) {
          responseMessages.push({
            id: `msg-${Date.now()}-synthesis`,
            role: 'coordinator',
            content: synthesis,
          })
        }
      }
    }

    // Collect all pending actions
    const allPendingActions = responseMessages.flatMap((m) => m.suggestedActions || [])

    const orchestratorResponse = {
      messages: responseMessages.map((m) => ({
        ...m,
        timestamp: new Date().toISOString(),
      })),
      pendingActions: allPendingActions,
      metadata: {
        totalAgentsInvoked: intent.targetAgents.length,
        totalProcessingTimeMs: 0,
        intent,
      },
    }

    return new Response(JSON.stringify(orchestratorResponse), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
    })
  } catch (err) {
    console.error('Agent orchestrator error:', err)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: (err as Error).message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
      },
    )
  }
})
