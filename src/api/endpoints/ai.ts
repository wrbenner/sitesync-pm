import { supabase, transformSupabaseError } from '../client'
import { validateProjectId } from '../middleware/projectScope'
import { aiService } from '../../lib/aiService'
import type { AIInsight } from '../../types/ai'

export const getAiInsights = async (projectId: string): Promise<AIInsight[]> => {
  validateProjectId(projectId)

  // Use AIService when configured; fall back to Supabase
  if (aiService.isConfigured()) {
    try {
      return await aiService.generateInsights(projectId)
    } catch {
      // Fall through to Supabase
    }
  }

  const { data, error } = await supabase
    .from('ai_insights')
    .select('*')
    .eq('project_id', projectId)
    .eq('dismissed', false)
    .order('created_at', { ascending: false })

  if (error) throw transformSupabaseError(error)

  return (data || []).map((row): AIInsight => ({
    id: row.id,
    type: row.type,
    severity: row.severity,
    title: row.title,
    description: row.description,
    affectedEntities: row.affected_entities || [],
    suggestedAction: row.suggested_action,
    confidence: row.confidence ?? 1,
    source: row.source || 'supabase',
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    dismissed: row.dismissed,
  }))
}

export const getAiConversation = async (_projectId: string): Promise<[]> => {
  // Conversations are managed client-side by useProjectAI
  return []
}

export const getVisionContent = async (_projectId: string): Promise<null> => {
  // Vision page uses static content
  return null
}
