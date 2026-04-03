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

  // Use AIService when configured; fall back to Supabase
  if (aiService.isConfigured()) {
    try {
      const insights = await aiService.generateInsights(projectId)
      const liveInsights = insights.map((i) => ({ ...i, source: 'live' as const }))
      return { insights: [...liveInsights, ...budgetInsights], dataSource: 'ai-live' as const }
    } catch (aiError) {
      captureException(
        aiError instanceof Error ? aiError : new Error(String(aiError)),
        { projectId, extra: { context: 'getAiInsights_aiService' } }
      )
      console.warn('[AI] aiService.generateInsights failed, falling back to Supabase:', aiError)
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
    let openRfiCount = 0
    let overdueRfiCount = 0
    let openPunchCount = 0

    try {
      const { count } = await supabase
        .from('rfis')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .eq('status', 'open')
      openRfiCount = count ?? 0
    } catch { /* non-fatal */ }

    try {
      const { count } = await supabase
        .from('rfis')
        .select('id', { count: 'exact', head: true })
        .eq('project_id', projectId)
        .neq('status', 'closed')
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

    const computedInsights: AIInsight[] = []

    if (openRfiCount > 0) {
      const rfiSeverity: AIInsight['severity'] =
        overdueRfiCount > 5 ? 'critical' : overdueRfiCount > 0 ? 'warning' : 'info'
      computedInsights.push({
        id: 'computed-rfi-status',
        type: 'risk',
        severity: rfiSeverity,
        title: overdueRfiCount > 0
          ? `${openRfiCount} open RFIs, ${overdueRfiCount} are overdue`
          : `${openRfiCount} open RFIs require attention`,
        description: overdueRfiCount > 0
          ? `${overdueRfiCount} RFI${overdueRfiCount === 1 ? '' : 's'} passed their due date and may be blocking work. Review and respond to keep the project moving.`
          : `${openRfiCount} open RFI${openRfiCount === 1 ? '' : 's'} awaiting response. Timely replies prevent field delays.`,
        affectedEntities: [],
        suggestedAction: 'Navigate to RFIs to review and respond',
        confidence: 1,
        source: 'fallback' as const,
        createdAt: now,
        generatedAt: now,
        expiresAt: null,
        dismissed: false,
      })
    }

    if (openPunchCount > 0) {
      computedInsights.push({
        id: 'computed-punch-status',
        type: 'risk',
        severity: openPunchCount > 20 ? 'warning' : 'info',
        title: `${openPunchCount} open punch list item${openPunchCount === 1 ? '' : 's'}`,
        description: `${openPunchCount} punch list item${openPunchCount === 1 ? '' : 's'} remain open. Clearing these is required before closeout.`,
        affectedEntities: [],
        suggestedAction: 'Navigate to Punch List to review open items',
        confidence: 1,
        source: 'fallback' as const,
        createdAt: now,
        generatedAt: now,
        expiresAt: null,
        dismissed: false,
      })
    }

    if (computedInsights.length > 0) {
      return { insights: computedInsights, dataSource: 'ai-fallback' as const }
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
        source: 'fallback' as const,
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
        source: 'fallback' as const,
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
        source: 'fallback' as const,
        createdAt: now,
        generatedAt: now,
        expiresAt: null,
        dismissed: false,
      },
    ]
    return { insights: starterInsights, dataSource: 'ai-fallback' as const }
  }

  return {
    insights: [...cachedInsights, ...budgetInsights],
    dataSource: 'ai-cached' as const,
    lastFallbackAt: new Date().toISOString(),
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
