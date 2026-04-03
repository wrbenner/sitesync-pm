// @ts-strict-check
import { supabase } from '../client'
import { validateProjectId } from '../middleware/projectScope'
import { aiService } from '../../lib/aiService'
import { captureException } from '../../lib/errorTracking'
import { ApiError } from '../errors'
import type { AIInsight, AiInsightsResponse } from '../../types/ai'
import type { ProjectFinancials, DivisionFinancials } from '../../types/financial'

export const getAiInsights = async (
  projectId: string,
  financials?: { summary: ProjectFinancials; divisions: DivisionFinancials[] }
): Promise<AiInsightsResponse> => {
  validateProjectId(projectId)

  const budgetInsights: AIInsight[] =
    financials && !financials.summary.isEmpty
      ? await aiService
          .generateBudgetInsights(projectId, financials.summary, financials.divisions)
          .catch(() => [])
      : []

  let aiServiceFailed = false
  let aiErrorType: string | undefined

  // Use AIService when configured; fall back to Supabase
  if (aiService.isConfigured()) {
    try {
      const insights = await aiService.generateInsights(projectId)
      const liveInsights = insights.map((i) => ({ ...i, source: 'live' as const }))
      return { insights: [...liveInsights, ...budgetInsights], dataSource: 'ai-live' as const }
    } catch (aiError) {
      aiServiceFailed = true
      aiErrorType = aiError instanceof Error ? aiError.name : 'UnknownError'
      captureException(
        aiError instanceof Error ? aiError : new Error(String(aiError)),
        { projectId, extra: { context: 'getAiInsights_aiService' } }
      )
    }
  }

  const { data, error } = await supabase
    .from('ai_insights')
    .select('*')
    .eq('project_id', projectId)
    .eq('dismissed', false)
    .order('created_at', { ascending: false })

  if (error) {
    throw new ApiError(
      'AI insights temporarily unavailable',
      503,
      'AI_UNAVAILABLE',
      'AI insights temporarily unavailable',
      error
    )
  }

  const cachedInsights = (data || []).map((row): AIInsight => ({
    id: row.id,
    type: row.type,
    severity: row.severity,
    title: row.title,
    description: row.description,
    affectedEntities: row.affected_entities || [],
    suggestedAction: row.suggested_action,
    confidence: row.confidence ?? 1,
    source: 'cached' as const,
    createdAt: row.created_at,
    generatedAt: row.created_at,
    expiresAt: row.expires_at,
    dismissed: row.dismissed,
  }))

  if (cachedInsights.length === 0 && budgetInsights.length === 0) {
    const now = new Date().toISOString()

    // Query real project data before falling back to onboarding placeholders
    let overdueRfiCount = 0
    let openPunchCount = 0
    let overBudgetCount = 0
    let overdueActivitiesCount = 0

    try {
      const { count } = await supabase
        .from('rfis')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('status', 'open')
        .lt('due_date', now)
      overdueRfiCount = count ?? 0
    } catch { /* non-fatal */ }

    try {
      const { count } = await supabase
        .from('punch_list_items')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('status', 'open')
      openPunchCount = count ?? 0
    } catch { /* non-fatal */ }

    try {
      const { data: budgetRows } = await supabase
        .from('budget_line_items')
        .select('spent_to_date, current_budget')
        .eq('project_id', projectId)
      overBudgetCount = (budgetRows ?? []).filter(
        (row) => (row.spent_to_date ?? 0) > (row.current_budget ?? 0)
      ).length
    } catch { /* non-fatal */ }

    try {
      const { count } = await supabase
        .from('schedule_activities')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('status', 'in_progress')
        .lt('planned_finish', now)
      overdueActivitiesCount = count ?? 0
    } catch { /* non-fatal */ }

    const dynamicInsights: AIInsight[] = []

    if (overdueRfiCount > 0) {
      const rfiSeverity: AIInsight['severity'] =
        overdueRfiCount > 5 ? 'critical' : overdueRfiCount > 2 ? 'warning' : 'info'
      dynamicInsights.push({
        id: 'computed-rfi-overdue',
        type: 'risk',
        severity: rfiSeverity,
        title: `${overdueRfiCount} RFI${overdueRfiCount === 1 ? '' : 's'} are overdue and may delay critical path`,
        description: `${overdueRfiCount} open RFI${overdueRfiCount === 1 ? '' : 's'} passed their due date. Unresolved RFIs can block field work and push the schedule. Review and respond immediately.`,
        affectedEntities: [],
        suggestedAction: 'Navigate to RFIs to review and respond',
        confidence: 0.85,
        source: 'computed' as const,
        createdAt: now,
        generatedAt: now,
        expiresAt: null,
        dismissed: false,
      })
    }

    if (openPunchCount > 0) {
      const punchSeverity: AIInsight['severity'] =
        openPunchCount > 5 ? 'critical' : openPunchCount > 2 ? 'warning' : 'info'
      dynamicInsights.push({
        id: 'computed-punch-open',
        type: 'action_needed',
        severity: punchSeverity,
        title: `${openPunchCount} open punch list item${openPunchCount === 1 ? '' : 's'} require resolution`,
        description: `${openPunchCount} punch list item${openPunchCount === 1 ? '' : 's'} remain open. Clearing these is required before closeout.`,
        affectedEntities: [],
        suggestedAction: 'Navigate to Punch List to review open items',
        confidence: 0.85,
        source: 'computed' as const,
        createdAt: now,
        generatedAt: now,
        expiresAt: null,
        dismissed: false,
      })
    }

    if (overBudgetCount > 0) {
      const budgetSeverity: AIInsight['severity'] =
        overBudgetCount > 5 ? 'critical' : overBudgetCount > 2 ? 'warning' : 'info'
      dynamicInsights.push({
        id: 'computed-budget-overrun',
        type: 'risk',
        severity: budgetSeverity,
        title: `${overBudgetCount} budget line item${overBudgetCount === 1 ? '' : 's'} are over budget`,
        description: `${overBudgetCount} cost code${overBudgetCount === 1 ? '' : 's'} show spending above the current budget. Review cost exposure and issue change orders if needed.`,
        affectedEntities: [],
        suggestedAction: 'Navigate to Budget to review cost variance',
        confidence: 0.85,
        source: 'computed' as const,
        createdAt: now,
        generatedAt: now,
        expiresAt: null,
        dismissed: false,
      })
    }

    if (overdueActivitiesCount > 0) {
      const schedSeverity: AIInsight['severity'] =
        overdueActivitiesCount > 5 ? 'critical' : overdueActivitiesCount > 2 ? 'warning' : 'info'
      dynamicInsights.push({
        id: 'computed-schedule-overdue',
        type: 'risk',
        severity: schedSeverity,
        title: `${overdueActivitiesCount} in-progress activit${overdueActivitiesCount === 1 ? 'y has' : 'ies have'} passed planned finish`,
        description: `${overdueActivitiesCount} schedule activit${overdueActivitiesCount === 1 ? 'y is' : 'ies are'} still in progress past their planned finish date. These may be impacting downstream tasks and the critical path.`,
        affectedEntities: [],
        suggestedAction: 'Navigate to Schedule to review late activities',
        confidence: 0.85,
        source: 'computed' as const,
        createdAt: now,
        generatedAt: now,
        expiresAt: null,
        dismissed: false,
      })
    }

    if (dynamicInsights.length > 0) {
      return {
        insights: dynamicInsights,
        dataSource: 'computed' as const,
      }
    }

    const starterInsights: AIInsight[] = [
      {
        id: 'fallback-1',
        type: 'onboarding',
        severity: 'info',
        title: 'Connect your schedule data to enable AI delay predictions',
        description: 'Add schedule phases so the AI can identify critical path risks and forecast delays before they happen.',
        affectedEntities: [],
        suggestedAction: 'Navigate to Schedule to add project phases',
        confidence: 0,
        isPlaceholder: true,
        source: 'onboarding' as const,
        createdAt: now,
        generatedAt: now,
        expiresAt: null,
        dismissed: false,
      },
      {
        id: 'fallback-2',
        type: 'onboarding',
        severity: 'info',
        title: 'Add budget line items to unlock cost variance analysis',
        description: 'Enter contract values and cost codes so the AI can surface variance alerts and cost forecasting.',
        affectedEntities: [],
        suggestedAction: 'Navigate to Budget to set up cost divisions',
        confidence: 0,
        isPlaceholder: true,
        source: 'onboarding' as const,
        createdAt: now,
        generatedAt: now,
        expiresAt: null,
        dismissed: false,
      },
      {
        id: 'fallback-3',
        type: 'onboarding',
        severity: 'info',
        title: 'Create daily logs to power AI field summaries',
        description: 'Daily log entries give the AI the field data it needs to generate progress summaries and flag productivity trends.',
        affectedEntities: [],
        suggestedAction: 'Navigate to Daily Log to add your first entry',
        confidence: 0,
        isPlaceholder: true,
        source: 'onboarding' as const,
        createdAt: now,
        generatedAt: now,
        expiresAt: null,
        dismissed: false,
      },
    ]
    return {
      insights: starterInsights,
      dataSource: aiServiceFailed ? 'ai-degraded' as const : 'ai-fallback' as const,
      ...(aiServiceFailed && { degraded: true, degradedReason: aiErrorType }),
    }
  }

  return {
    insights: [...cachedInsights, ...budgetInsights],
    dataSource: aiServiceFailed ? 'ai-degraded' as const : 'ai-cached' as const,
    lastFallbackAt: new Date().toISOString(),
    ...(aiServiceFailed && { degraded: true, degradedReason: aiErrorType }),
  }
}

export const getAiInsightsMeta = async (
  projectId: string
): Promise<{ live: boolean; lastUpdated: string }> => {
  validateProjectId(projectId)
  const live = aiService.isConfigured()
  const { data } = await supabase
    .from('ai_insights')
    .select('created_at')
    .eq('project_id', projectId)
    .eq('dismissed', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  return {
    live,
    lastUpdated: data?.created_at ?? new Date().toISOString(),
  }
}

export const getAiConversation = async (_projectId: string): Promise<[]> => {
  // Conversations are managed client-side by useProjectAI
  return []
}

export const getVisionContent = async (_projectId: string): Promise<null> => {
  // Vision page uses static content
  return null
}
