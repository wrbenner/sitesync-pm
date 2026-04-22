// ── Route Context ────────────────────────────────────────────
// Phase 7: For each page route, generate a structured context object of
// relevant data. The AI Copilot reads this so that when the user opens
// the assistant on e.g. the Drawings page, it already knows the current
// discipline counts and open discrepancies — no "what are you looking at?"
// exchange needed.
//
// Adapted from sitesyncai-backend-main/src/chatbot/services/route-context.service.ts.

import { fromTable } from './supabase'

export type RouteKey =
  | 'dashboard'
  | 'drawings'
  | 'rfis'
  | 'files'
  | 'schedule'
  | 'budget'
  | 'submittals'
  | 'daily_logs'
  | 'safety'
  | 'punch_list'
  | 'generic'

export interface RouteContext {
  route: RouteKey
  projectId: string | null
  projectName?: string
  summary: string
  facts: Record<string, string | number | boolean | null>
  suggestedQuestions: string[]
  proactiveAlerts: Array<{
    severity: 'low' | 'medium' | 'high' | 'critical'
    message: string
    actionRoute?: string
  }>
  generatedAt: string
}

const CONTEXT_TTL_MS = 60_000
const cache = new Map<string, { ctx: RouteContext; expiresAt: number }>()

function cacheKey(route: RouteKey, projectId: string | null): string {
  return `${route}::${projectId ?? 'none'}`
}

async function countRows(
  table: string,
  projectId: string,
  filters: Record<string, unknown> = {},
): Promise<number> {
  try {
    let query = fromTable(table)
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
    for (const [k, v] of Object.entries(filters)) {
      query = query.eq(k, v as never)
    }
    const { count } = await query
    return count ?? 0
  } catch {
    return 0
  }
}

// ── Drawings route ──────────────────────────────────────────
async function drawingsContext(projectId: string): Promise<Partial<RouteContext>> {
  const [byDisc, pairs, discrepancies, critical] = await Promise.all([
    fromTable('drawing_classifications')
      .select('discipline')
      .eq('project_id', projectId)
      .limit(500)
      .then((r) => {
        const rows = (r.data as Array<{ discipline: string }> | null) ?? []
        return rows.reduce<Record<string, number>>((acc, row) => {
          acc[row.discipline] = (acc[row.discipline] ?? 0) + 1
          return acc
        }, {})
      }),
    countRows('drawing_pairs', projectId),
    countRows('drawing_discrepancies', projectId).catch(() => 0),
    countRows('drawing_discrepancies', projectId, { severity: 'critical' }).catch(() => 0),
  ])

  const disciplines = Object.entries(byDisc)
    .map(([d, n]) => `${n} ${d}`)
    .join(', ')
  const alerts: RouteContext['proactiveAlerts'] = []
  if (critical > 0) {
    alerts.push({
      severity: 'critical',
      message: `${critical} critical drawing discrepanc${critical === 1 ? 'y needs' : 'ies need'} attention.`,
      actionRoute: '/drawings/discrepancies',
    })
  }

  return {
    summary: `${Object.values(byDisc).reduce((a, b) => a + b, 0)} drawings classified (${disciplines}). ${pairs} arch/struct pairs, ${discrepancies} discrepancies.`,
    facts: {
      pairs,
      discrepancies,
      critical_discrepancies: critical,
      ...byDisc,
    },
    suggestedQuestions: [
      'Which drawings have the most discrepancies?',
      'Are there any scale mismatches between arch and struct?',
      'Summarize the latest revision changes.',
    ],
    proactiveAlerts: alerts,
  }
}

// ── RFIs route ──────────────────────────────────────────────
async function rfisContext(projectId: string): Promise<Partial<RouteContext>> {
  const now = new Date().toISOString()
  const [open, overdue, responseTimes] = await Promise.all([
    countRows('rfis', projectId, { status: 'open' }),
    fromTable('rfis')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('status', 'open')
      .lt('due_date', now)
      .then((r) => r.count ?? 0),
    fromTable('rfis')
      .select('created_at, closed_date')
      .eq('project_id', projectId)
      .not('closed_date', 'is', null)
      .limit(200)
      .then((r) => {
        const rows = (r.data as Array<{ created_at: string; closed_date: string }> | null) ?? []
        if (rows.length === 0) return null
        const avgMs =
          rows.reduce(
            (a, row) => a + (new Date(row.closed_date).getTime() - new Date(row.created_at).getTime()),
            0,
          ) / rows.length
        return Math.round(avgMs / (1000 * 60 * 60 * 24))
      }),
  ])

  const alerts: RouteContext['proactiveAlerts'] = []
  if (overdue > 0) {
    alerts.push({
      severity: overdue >= 5 ? 'high' : 'medium',
      message: `${overdue} open RFI${overdue === 1 ? ' is' : 's are'} past due.`,
      actionRoute: '/rfis?filter=overdue',
    })
  }

  return {
    summary: `${open} open RFIs (${overdue} overdue). Avg response time: ${responseTimes ?? '—'} days.`,
    facts: { open, overdue, avg_response_days: responseTimes ?? null },
    suggestedQuestions: [
      'Which RFIs are blocking schedule?',
      'Draft an RFI about this drawing.',
      'Who owes me a response?',
    ],
    proactiveAlerts: alerts,
  }
}

// ── Dashboard route ─────────────────────────────────────────
async function dashboardContext(projectId: string): Promise<Partial<RouteContext>> {
  const [tasks, openRfis, upcomingMilestones, safety] = await Promise.all([
    countRows('tasks', projectId, { status: 'in_progress' }).catch(() => 0),
    countRows('rfis', projectId, { status: 'open' }).catch(() => 0),
    fromTable('tasks')
      .select('id, title, due_date')
      .eq('project_id', projectId)
      .eq('is_critical_path', true)
      .gte('due_date', new Date().toISOString())
      .order('due_date')
      .limit(3)
      .then((r) => ((r.data as Array<{ id: string; title: string; due_date: string }> | null) ?? [])),
    countRows('safety_incidents', projectId).catch(() => 0),
  ])

  return {
    summary: `${tasks} tasks in progress, ${openRfis} open RFIs. Next milestones: ${upcomingMilestones.map((m) => m.title).join(', ') || 'none'}.`,
    facts: {
      tasks_in_progress: tasks,
      open_rfis: openRfis,
      upcoming_milestones: upcomingMilestones.length,
      safety_incidents: safety,
    },
    suggestedQuestions: [
      'What needs my attention today?',
      'Am I on track for the next milestone?',
      'Show me the critical risks.',
    ],
    proactiveAlerts: [],
  }
}

// ── Schedule ────────────────────────────────────────────────
async function scheduleContext(projectId: string): Promise<Partial<RouteContext>> {
  const [total, overdue, criticalPath] = await Promise.all([
    countRows('tasks', projectId),
    fromTable('tasks')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .neq('status', 'done')
      .lt('due_date', new Date().toISOString())
      .then((r) => r.count ?? 0),
    countRows('tasks', projectId, { is_critical_path: true }).catch(() => 0),
  ])

  const alerts: RouteContext['proactiveAlerts'] = []
  if (overdue > 0) {
    alerts.push({
      severity: overdue >= 10 ? 'high' : 'medium',
      message: `${overdue} task${overdue === 1 ? ' is' : 's are'} overdue.`,
    })
  }
  return {
    summary: `${total} tasks total, ${criticalPath} on critical path, ${overdue} overdue.`,
    facts: { total, overdue, critical_path: criticalPath },
    suggestedQuestions: ['Where is the schedule slipping?', 'Which task blocks the most work?'],
    proactiveAlerts: alerts,
  }
}

// ── Generic fallback ────────────────────────────────────────
function genericContext(projectId: string | null): Partial<RouteContext> {
  return {
    summary: projectId ? 'Project context loaded.' : 'No project selected.',
    facts: {},
    suggestedQuestions: [
      'What should I focus on right now?',
      'Summarize activity in the last 7 days.',
    ],
    proactiveAlerts: [],
  }
}

const BUILDERS: Record<RouteKey, (projectId: string) => Promise<Partial<RouteContext>>> = {
  dashboard: dashboardContext,
  drawings: drawingsContext,
  rfis: rfisContext,
  schedule: scheduleContext,
  files: async (projectId) => ({
    summary: 'Files workspace.',
    facts: { files: await countRows('files', projectId) },
    suggestedQuestions: ['Where can I find the latest specs?', 'Organize my files automatically.'],
    proactiveAlerts: [],
  }),
  budget: async (projectId) => ({
    summary: 'Budget tracking.',
    facts: { change_orders: await countRows('change_orders', projectId).catch(() => 0) },
    suggestedQuestions: ['What is my exposure this month?', 'Show me pending change orders.'],
    proactiveAlerts: [],
  }),
  submittals: async (projectId) => ({
    summary: 'Submittals workspace.',
    facts: { open: await countRows('submittals', projectId, { status: 'open' }).catch(() => 0) },
    suggestedQuestions: ['Which submittals are overdue?', 'Who needs to review next?'],
    proactiveAlerts: [],
  }),
  daily_logs: async (projectId) => ({
    summary: 'Daily logs.',
    facts: { total: await countRows('daily_logs', projectId).catch(() => 0) },
    suggestedQuestions: ['Summarize yesterday', "What's the trend this week?"],
    proactiveAlerts: [],
  }),
  safety: async (projectId) => ({
    summary: 'Safety module.',
    facts: { incidents: await countRows('safety_incidents', projectId).catch(() => 0) },
    suggestedQuestions: ['Any patterns in recent incidents?', 'What is my safety score?'],
    proactiveAlerts: [],
  }),
  punch_list: async (projectId) => ({
    summary: 'Punch list.',
    facts: { open: await countRows('punch_items', projectId, { status: 'open' }).catch(() => 0) },
    suggestedQuestions: ['What is still open?', 'Who has the most punch items?'],
    proactiveAlerts: [],
  }),
  generic: async () => genericContext(null),
}

/**
 * Load (or fetch fresh) the context object for a given route + project.
 * Cached for 60 seconds — long enough to survive a rapid click path without
 * a thundering herd, short enough that fresh data hits after a user action.
 */
export async function getRouteContext(
  route: RouteKey,
  projectId: string | null,
): Promise<RouteContext> {
  const key = cacheKey(route, projectId)
  const now = Date.now()
  const cached = cache.get(key)
  if (cached && cached.expiresAt > now) return cached.ctx

  const base: RouteContext = {
    route,
    projectId,
    summary: '',
    facts: {},
    suggestedQuestions: [],
    proactiveAlerts: [],
    generatedAt: new Date().toISOString(),
  }

  if (!projectId) {
    const g = genericContext(null)
    const ctx = { ...base, ...g } as RouteContext
    cache.set(key, { ctx, expiresAt: now + CONTEXT_TTL_MS })
    return ctx
  }

  try {
    const partial = await BUILDERS[route](projectId)
    const ctx = { ...base, ...partial } as RouteContext
    cache.set(key, { ctx, expiresAt: now + CONTEXT_TTL_MS })
    return ctx
  } catch {
    const g = genericContext(projectId)
    return { ...base, ...g } as RouteContext
  }
}

/**
 * Map a browser path to a RouteKey. Extend as new modules land.
 */
export function routeFromPath(pathname: string): RouteKey {
  if (pathname.includes('/drawings')) return 'drawings'
  if (pathname.includes('/rfi')) return 'rfis'
  if (pathname.includes('/files') || pathname.includes('/documents')) return 'files'
  if (pathname.includes('/schedule') || pathname.includes('/gantt')) return 'schedule'
  if (pathname.includes('/budget') || pathname.includes('/cost')) return 'budget'
  if (pathname.includes('/submittal')) return 'submittals'
  if (pathname.includes('/daily-log')) return 'daily_logs'
  if (pathname.includes('/safety')) return 'safety'
  if (pathname.includes('/punch')) return 'punch_list'
  if (pathname.includes('/dashboard') || pathname === '/') return 'dashboard'
  return 'generic'
}

/**
 * Serialize the context as a compact system-prompt block for injection into
 * AI Copilot conversations. Keeps it under ~500 tokens.
 */
export function contextToPromptBlock(ctx: RouteContext): string {
  const factLines = Object.entries(ctx.facts)
    .filter(([, v]) => v !== null && v !== undefined && v !== '')
    .map(([k, v]) => `- ${k}: ${v}`)
    .join('\n')
  const alertLines = ctx.proactiveAlerts
    .map((a) => `- [${a.severity.toUpperCase()}] ${a.message}`)
    .join('\n')

  return [
    `[Route context: ${ctx.route}]`,
    ctx.projectName ? `Project: ${ctx.projectName}` : '',
    `Summary: ${ctx.summary}`,
    factLines ? `Facts:\n${factLines}` : '',
    alertLines ? `Active alerts:\n${alertLines}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

export function clearRouteContextCache(): void {
  cache.clear()
}
