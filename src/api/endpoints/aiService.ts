import { aiService } from '../../lib/aiService'
import type { AIContext, AIInsight } from '../../types/ai'

export const generateProjectInsights = async (projectId: string): Promise<AIInsight[]> => {
  return aiService.generateInsights(projectId)
}

export const draftRFIResponse = async (rfiId: string, context: AIContext): Promise<string> => {
  return aiService.draftRFIResponse(rfiId, context)
}

export const summarizeDailyLog = async (logData: Record<string, unknown>): Promise<string> => {
  return aiService.summarizeDailyLog(logData)
}
