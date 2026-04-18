// ── AI Copilot Tools ─────────────────────────────────────────
// Construction-aware tool definitions for the Copilot. Each tool
// declares its JSON schema (for function calling) and an executor
// that runs against the live Supabase data model.
//
// Ported/adapted from sitesyncai-backend chatbot function-definitions,
// re-targeted onto SiteSync PM's Supabase schema, and extended with
// PM-specific tools: risk summary, schedule impact, proactive suggestions.

import { supabase } from './supabase'

// ── OpenAI/Anthropic function-call style schema ──────────────
export interface ToolSchema {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description: string; enum?: string[] }>
    required: string[]
  }
}

export interface ToolDefinition<A = Record<string, unknown>, R = unknown> {
  schema: ToolSchema
  execute: (args: A) => Promise<R>
}

// ── Types ────────────────────────────────────────────────────
export type Entity = 'rfi' | 'submittal' | 'task' | 'punch_item' | 'drawing' | 'document' | 'incident'

// ── Utility: safe count ──────────────────────────────────────
async function countTable(
  table: string,
  projectId: string,
  filters: Record<string, unknown> = {},
): Promise<number> {
  let q = supabase.from(table).select('*', { count: 'exact', head: true }).eq('project_id', projectId)
  for (const [k, v] of Object.entries(filters)) {
    q = q.eq(k, v)
  }
  const { count } = await q
  return count ?? 0
}

// ── 1. get_sheet_metadata ────────────────────────────────────
const getSheetMetadata: ToolDefinition<{ sheet_number: string; project_id: string }> = {
  schema: {
    name: 'get_sheet_metadata',
    description:
      'Get metadata for a single drawing sheet by sheet number (e.g., A101, S-201). Returns discipline, confidence, classification details, and source file.',
    parameters: {
      type: 'object',
      properties: {
        sheet_number: { type: 'string', description: "Sheet number like 'A101', 'S-201'" },
        project_id: { type: 'string', description: 'Project UUID' },
      },
      required: ['sheet_number', 'project_id'],
    },
  },
  async execute({ sheet_number, project_id }) {
    const { data, error } = await supabase
      .from('drawing_classifications')
      .select('*')
      .eq('project_id', project_id)
      .eq('sheet_number', sheet_number)
      .maybeSingle()
    if (error) return { error: error.message }
    return { sheet: data ?? null }
  },
}

// ── 2. analyze_pair_relationships ────────────────────────────
const analyzePairRelationships: ToolDefinition<{ project_id: string }> = {
  schema: {
    name: 'analyze_pair_relationships',
    description:
      'Analyze all drawing-pair relationships for a project with discrepancy counts per pair.',
    parameters: {
      type: 'object',
      properties: { project_id: { type: 'string', description: 'Project UUID' } },
      required: ['project_id'],
    },
  },
  async execute({ project_id }) {
    const { data: pairs, error } = await supabase
      .from('drawing_pairs')
      .select('id, primary_sheet, secondary_sheet, pair_type, confidence')
      .eq('project_id', project_id)
    if (error) return { error: error.message }
    // Aggregate discrepancies per pair
    const pairIds = (pairs ?? []).map((p) => p.id)
    if (pairIds.length === 0) return { pairs: [], total: 0 }
    const { data: discs } = await supabase
      .from('drawing_discrepancies')
      .select('pair_id, severity')
      .in('pair_id', pairIds)
    const byPair = new Map<string, { high: number; medium: number; low: number }>()
    for (const d of discs ?? []) {
      const e = byPair.get(d.pair_id) ?? { high: 0, medium: 0, low: 0 }
      const sev = (d.severity ?? 'low') as 'high' | 'medium' | 'low'
      e[sev] += 1
      byPair.set(d.pair_id, e)
    }
    const enriched = (pairs ?? []).map((p) => ({ ...p, discrepancies: byPair.get(p.id) ?? { high: 0, medium: 0, low: 0 } }))
    return { pairs: enriched, total: enriched.length }
  },
}

// ── 3. get_project_stats ─────────────────────────────────────
const getProjectStats: ToolDefinition<{ project_id: string }> = {
  schema: {
    name: 'get_project_stats',
    description:
      'Get aggregate counts for a project: open RFIs, open submittals, open tasks, overdue tasks, open punch items, open incidents, total drawings.',
    parameters: {
      type: 'object',
      properties: { project_id: { type: 'string', description: 'Project UUID' } },
      required: ['project_id'],
    },
  },
  async execute({ project_id }) {
    const nowIso = new Date().toISOString()
    const [openRfis, openSubs, openTasks, punch, inc, draw, overdueTasks] = await Promise.all([
      countTable('rfis', project_id, { status: 'open' }),
      countTable('submittals', project_id, { status: 'pending' }),
      supabase.from('tasks').select('*', { count: 'exact', head: true })
        .eq('project_id', project_id).neq('status', 'complete').then((r) => r.count ?? 0),
      countTable('punch_items', project_id, { status: 'open' }),
      countTable('incidents', project_id),
      countTable('drawing_classifications', project_id),
      supabase.from('tasks').select('*', { count: 'exact', head: true })
        .eq('project_id', project_id).neq('status', 'complete').lt('due_date', nowIso).then((r) => r.count ?? 0),
    ])
    return {
      open_rfis: openRfis, open_submittals: openSubs, open_tasks: openTasks,
      overdue_tasks: overdueTasks, open_punch_items: punch, incidents: inc,
      total_drawings: draw,
    }
  },
}

// ── 4. search_entities ───────────────────────────────────────
const TABLE_MAP: Record<Entity, { table: string; title: string }> = {
  rfi: { table: 'rfis', title: 'subject' },
  submittal: { table: 'submittals', title: 'title' },
  task: { table: 'tasks', title: 'title' },
  punch_item: { table: 'punch_items', title: 'description' },
  drawing: { table: 'drawing_classifications', title: 'sheet_title' },
  document: { table: 'documents', title: 'name' },
  incident: { table: 'incidents', title: 'description' },
}

const searchEntities: ToolDefinition<{ project_id: string; query: string; types?: Entity[] }> = {
  schema: {
    name: 'search_entities',
    description:
      'Full-text search across project entities: RFIs, submittals, tasks, punch items, drawings, documents, incidents.',
    parameters: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Project UUID' },
        query: { type: 'string', description: 'Search query' },
        types: { type: 'string', description: 'Comma-separated entity types to include' },
      },
      required: ['project_id', 'query'],
    },
  },
  async execute({ project_id, query, types }) {
    const selected = (types && types.length > 0 ? types : (Object.keys(TABLE_MAP) as Entity[]))
    const all = await Promise.all(selected.map(async (t) => {
      const info = TABLE_MAP[t]
      const { data } = await supabase.from(info.table)
        .select(`id, ${info.title}`)
        .eq('project_id', project_id)
        .ilike(info.title, `%${query}%`)
        .limit(10)
      return { type: t, results: data ?? [] }
    }))
    return { groups: all, total: all.reduce((s, g) => s + g.results.length, 0) }
  },
}

// ── 5. trigger_analysis ──────────────────────────────────────
const triggerAnalysis: ToolDefinition<{ project_id: string }> = {
  schema: {
    name: 'trigger_analysis',
    description: 'Kick off the drawing intelligence pipeline for a project.',
    parameters: {
      type: 'object',
      properties: { project_id: { type: 'string', description: 'Project UUID' } },
      required: ['project_id'],
    },
  },
  async execute({ project_id }) {
    const { data: { session } } = await supabase.auth.getSession()
    const url = (import.meta.env.VITE_SUPABASE_URL as string) || ''
    const res = await fetch(`${url}/functions/v1/classify-drawing`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ project_id }),
    })
    return { started: res.ok, status: res.status }
  },
}

// ── 6. generate_report ───────────────────────────────────────
const generateReport: ToolDefinition<{ project_id: string; type: 'discrepancy' | 'owner' | 'safety' }> = {
  schema: {
    name: 'generate_report',
    description: 'Generate a PDF report for the project (discrepancy, owner, or safety).',
    parameters: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'Project UUID' },
        type: { type: 'string', description: 'Report type', enum: ['discrepancy', 'owner', 'safety'] },
      },
      required: ['project_id', 'type'],
    },
  },
  async execute({ project_id, type }) {
    const { data: { session } } = await supabase.auth.getSession()
    const url = (import.meta.env.VITE_SUPABASE_URL as string) || ''
    const res = await fetch(`${url}/functions/v1/generate-report`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ project_id, report_type: type }),
    })
    const body = await res.json().catch(() => ({}))
    return { started: res.ok, ...body }
  },
}

// ── 7. get_risk_summary (enhancement) ────────────────────────
const getRiskSummary: ToolDefinition<{ project_id: string }> = {
  schema: {
    name: 'get_risk_summary',
    description:
      'AI-computed risk score for a project combining overdue RFIs, open safety incidents, schedule slippage, and budget variance.',
    parameters: {
      type: 'object',
      properties: { project_id: { type: 'string', description: 'Project UUID' } },
      required: ['project_id'],
    },
  },
  async execute({ project_id }) {
    const nowIso = new Date().toISOString()
    const [overdueRfis, openIncidents, overdueTasks, highDiscs] = await Promise.all([
      supabase.from('rfis').select('*', { count: 'exact', head: true })
        .eq('project_id', project_id).eq('status', 'open').lt('due_date', nowIso).then((r) => r.count ?? 0),
      supabase.from('incidents').select('*', { count: 'exact', head: true })
        .eq('project_id', project_id).neq('status', 'closed').then((r) => r.count ?? 0),
      supabase.from('tasks').select('*', { count: 'exact', head: true })
        .eq('project_id', project_id).neq('status', 'complete').lt('due_date', nowIso).then((r) => r.count ?? 0),
      supabase.from('drawing_discrepancies').select('*', { count: 'exact', head: true })
        .eq('project_id', project_id).eq('severity', 'high').then((r) => r.count ?? 0),
    ])
    // Simple weighted score (0-100)
    const score = Math.min(100,
      overdueRfis * 6 + openIncidents * 12 + overdueTasks * 3 + highDiscs * 8
    )
    const level = score >= 70 ? 'critical' : score >= 40 ? 'elevated' : score >= 15 ? 'moderate' : 'low'
    return {
      score, level,
      drivers: { overdue_rfis: overdueRfis, open_incidents: openIncidents, overdue_tasks: overdueTasks, high_discrepancies: highDiscs },
    }
  },
}

// ── 8. get_schedule_impact (enhancement) ─────────────────────
const getScheduleImpact: ToolDefinition<{ rfi_id: string }> = {
  schema: {
    name: 'get_schedule_impact',
    description:
      'Predict schedule impact of an open RFI based on its due date, linked tasks, and critical-path proximity.',
    parameters: {
      type: 'object',
      properties: { rfi_id: { type: 'string', description: 'RFI UUID' } },
      required: ['rfi_id'],
    },
  },
  async execute({ rfi_id }) {
    const { data: rfi } = await supabase.from('rfis')
      .select('id, subject, status, due_date, project_id, linked_task_ids')
      .eq('id', rfi_id).maybeSingle()
    if (!rfi) return { error: 'RFI not found' }
    const linkedIds = (rfi.linked_task_ids ?? []) as string[]
    let criticalPath = false
    let daysAtRisk = 0
    if (linkedIds.length > 0) {
      const { data: tasks } = await supabase.from('tasks')
        .select('id, is_critical_path, due_date, status').in('id', linkedIds)
      criticalPath = (tasks ?? []).some((t) => t.is_critical_path)
      const now = Date.now()
      daysAtRisk = (tasks ?? [])
        .map((t) => t.due_date ? Math.max(0, Math.ceil((now - new Date(t.due_date).getTime()) / 86400000)) : 0)
        .reduce((s, n) => s + n, 0)
    }
    return {
      rfi_id, subject: rfi.subject,
      critical_path: criticalPath,
      linked_tasks: linkedIds.length,
      days_at_risk: daysAtRisk,
      impact: criticalPath ? 'high' : daysAtRisk > 3 ? 'medium' : 'low',
    }
  },
}

// ── 9. suggest_action (enhancement) ──────────────────────────
const suggestAction: ToolDefinition<{ project_id: string }> = {
  schema: {
    name: 'suggest_action',
    description:
      'Proactive next-action suggestions for a project based on current state. Returns a ranked list of actionable recommendations.',
    parameters: {
      type: 'object',
      properties: { project_id: { type: 'string', description: 'Project UUID' } },
      required: ['project_id'],
    },
  },
  async execute({ project_id }) {
    const suggestions: { priority: 'high' | 'medium' | 'low'; action: string; reason: string; cta?: string }[] = []
    const nowIso = new Date().toISOString()
    const { count: overdueRfis } = await supabase.from('rfis')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', project_id).eq('status', 'open').lt('due_date', nowIso)
    if ((overdueRfis ?? 0) > 0) {
      suggestions.push({
        priority: 'high',
        action: `Send follow-up emails for ${overdueRfis} overdue RFI(s)`,
        reason: 'RFIs past due date block field progress.',
        cta: 'trigger:rfi_followup',
      })
    }
    const { count: highDisc } = await supabase.from('drawing_discrepancies')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', project_id).eq('severity', 'high').is('rfi_id', null)
    if ((highDisc ?? 0) > 0) {
      suggestions.push({
        priority: 'high',
        action: `Auto-draft RFIs from ${highDisc} High severity discrepancies`,
        reason: 'High severity mismatches have no RFI yet.',
        cta: 'trigger:autofile_rfis',
      })
    }
    const { count: openIncidents } = await supabase.from('incidents')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', project_id).neq('status', 'closed')
    if ((openIncidents ?? 0) > 0) {
      suggestions.push({
        priority: 'medium',
        action: `Review ${openIncidents} open incident report(s)`,
        reason: 'Unclosed incidents affect safety metrics and insurance.',
        cta: 'navigate:safety',
      })
    }
    if (suggestions.length === 0) {
      suggestions.push({
        priority: 'low',
        action: 'Run a weekly owner digest',
        reason: 'No critical items detected — good moment for proactive reporting.',
        cta: 'trigger:weekly_digest',
      })
    }
    return { suggestions, count: suggestions.length }
  },
}

// ── Registry ─────────────────────────────────────────────────
export const COPILOT_TOOLS = {
  get_sheet_metadata: getSheetMetadata,
  analyze_pair_relationships: analyzePairRelationships,
  get_project_stats: getProjectStats,
  search_entities: searchEntities,
  trigger_analysis: triggerAnalysis,
  generate_report: generateReport,
  get_risk_summary: getRiskSummary,
  get_schedule_impact: getScheduleImpact,
  suggest_action: suggestAction,
} as const

export type CopilotToolName = keyof typeof COPILOT_TOOLS

export const COPILOT_TOOL_SCHEMAS: ToolSchema[] = Object.values(COPILOT_TOOLS).map((t) => t.schema)

export async function runCopilotTool<N extends CopilotToolName>(
  name: N,
  args: Record<string, unknown>,
): Promise<unknown> {
  const tool = COPILOT_TOOLS[name] as unknown as ToolDefinition
  if (!tool) throw new Error(`Unknown tool: ${name}`)
  return tool.execute(args)
}
