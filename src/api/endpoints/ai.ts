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
    const starterInsights: AIInsight[] = [
      {
        id: 'fallback-1',
        type: 'schedule_risk',
        severity: 'info',
        title: 'Schedule Analysis Available',
        description: 'Add schedule phases to enable AI delay prediction and critical path analysis.',
        affectedEntities: [],
        suggestedAction: 'Navigate to Schedule to add project phases',
        confidence: 1,
        source: 'fallback' as const,
        createdAt: now,
        generatedAt: now,
        expiresAt: null,
        dismissed: false,
      },
      {
        id: 'fallback-2',
        type: 'budget_risk',
        severity: 'info',
        title: 'Budget Tracking Ready',
        description: 'Enter contract values and cost codes to unlock variance alerts and cost forecasting.',
        affectedEntities: [],
        suggestedAction: 'Navigate to Budget to set up cost divisions',
        confidence: 1,
        source: 'fallback' as const,
        createdAt: now,
        generatedAt: now,
        expiresAt: null,
        dismissed: false,
      },
      {
        id: 'fallback-3',
        type: 'recommendation',
        severity: 'info',
        title: 'RFI Tracking Improves Closeout',
        description: 'Log RFIs as they arise to keep a complete record and avoid disputes at project closeout.',
        affectedEntities: [],
        suggestedAction: 'Navigate to RFIs to log your first request',
        confidence: 1,
        source: 'fallback' as const,
        createdAt: now,
        generatedAt: now,
        expiresAt: null,
        dismissed: false,
      },
      {
        id: 'fallback-4',
        type: 'risk',
        severity: 'info',
        title: 'Safety Observation Cadence',
        description: 'Daily safety observations in the field log build a defensible record and surface leading indicators early.',
        affectedEntities: [],
        suggestedAction: 'Navigate to Daily Log to add a safety observation',
        confidence: 1,
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
