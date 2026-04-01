import { aiService } from '../../lib/aiService'
import type { AIContext, AIInsight } from '../../types/ai'

export const generateProjectInsights = async (projectId: string): Promise<AIInsight[]> => {
  if (!aiService.isConfigured()) return []
  try {
    return await aiService.generateInsights(projectId)
  } catch (err) {
    console.error('[aiService] generateProjectInsights failed:', err)
    return []
  }
}

export const draftRFIResponse = async (rfiId: string, context: AIContext): Promise<string> => {
  if (!aiService.isConfigured()) return ''
  try {
    return await aiService.draftRFIResponse(rfiId, context)
  } catch (err) {
    console.error('[aiService] draftRFIResponse failed:', err)
    return ''
  }
}

export const summarizeDailyLog = async (logData: Record<string, unknown>): Promise<string | null> => {
  if (!aiService.isConfigured()) return null
  try {
    return await aiService.summarizeDailyLog(logData)
  } catch {
    return null
  }
}
