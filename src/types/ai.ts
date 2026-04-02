export interface AIMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  context?: AIContext
  toolCalls?: AIToolCall[]
  generativeUI?: GenerativeUIBlock[]
}

export interface CollaborationBlockerItem {
  entityType: 'rfi' | 'submittal'
  entityNumber: string
  entityId: string
  title: string
  assignedTo: string
  idleSinceHours: number
}

export interface CollaborationContext {
  onlineUsers: Array<{ id: string; name: string; page?: string }>
  unreadNotificationTitles: string[]
  blockedItems: CollaborationBlockerItem[]
  mostOverdueAssignee: { name: string; itemCount: number } | null
}

export interface ProjectAIContext {
  projectName: string
  contractValue: number | null
  phase: string | null
  openRfiCount: number
  overdueRfiCount: number
  budgetVarianceByDivision: Array<{
    csiCode: string | null
    divisionName: string
    budgetVariancePct: number
    varianceAmount: number
  }>
  scheduleVarianceDays: number | null
  criticalPathActivities: Array<{ name: string; finishDate: string }>
  recentDailyLogSummaries: Array<{ date: string; summary: string }>
  activeBallInCourtSubmittals: Array<{ number: string; title: string; assignedTo: string }>
  pendingChangeOrderExposure: number
}

export interface AIContext {
  projectId: string
  currentPage?: string
  selectedEntities?: Array<{ type: string; id: string }>
  projectMetrics?: Record<string, number>
  collaborationContext?: CollaborationContext
  projectData?: ProjectAIContext
}

export interface AIToolCall {
  name: string
  arguments: Record<string, unknown>
  result?: unknown
}

export interface AIInsight {
  id: string
  type: 'risk' | 'recommendation' | 'anomaly' | 'prediction' | 'budget_risk' | 'schedule_risk' | 'onboarding'
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  affectedEntities: Array<{ type: string; id: string; name: string }>
  suggestedAction?: string
  confidence: number // 0-1
  isPlaceholder?: boolean // true for onboarding prompts, not real analysis results
  source?: 'live' | 'cached' | 'supabase' | 'fallback' // which analysis generated this
  createdAt: string
  generatedAt?: string
  expiresAt?: string
  dismissed: boolean
}

export interface AiInsightsResponse {
  insights: AIInsight[]
  /** 'ai-live' when served directly from the AI service; 'ai-cached' when served from Supabase after aiService failed; 'ai-fallback' when no data exists and starter insights are shown. */
  dataSource: 'ai-live' | 'ai-cached' | 'ai-fallback'
  /** ISO timestamp set when results were served from Supabase cache after aiService failed. */
  lastFallbackAt?: string
}

export interface CoordinationConflict {
  description: string
  location: string // e.g. "Grid Line C4", "Level 3 ceiling space"
  disciplines: [string, string] // the two disciplines in conflict
  confidence: number // 0-1
}

export interface DrawingAnalysis {
  sheetType: 'architectural' | 'structural' | 'mep' | 'civil' | 'other'
  drawingNumber: string
  revision: string
  conflicts: CoordinationConflict[]
}

export type GenerativeUIBlock =
  | { type: 'metric_cards'; data: Array<{ label: string; value: string | number; trend?: 'up' | 'down' }> }
  | { type: 'data_table'; columns: string[]; rows: Array<Record<string, unknown>> }
  | { type: 'chart'; chartType: 'bar' | 'line' | 'pie'; data: unknown }
  | { type: 'checklist'; items: Array<{ text: string; checked: boolean }> }
  | { type: 'action_card'; title: string; description: string; actions: Array<{ label: string; action: string }> }
