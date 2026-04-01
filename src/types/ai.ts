export interface AIMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  context?: AIContext
  toolCalls?: AIToolCall[]
  generativeUI?: GenerativeUIBlock[]
}

export interface AIContext {
  projectId: string
  currentPage?: string
  selectedEntities?: Array<{ type: string; id: string }>
  projectMetrics?: Record<string, number>
}

export interface AIToolCall {
  name: string
  arguments: Record<string, unknown>
  result?: unknown
}

export interface AIInsight {
  id: string
  type: 'risk' | 'recommendation' | 'anomaly' | 'prediction'
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  affectedEntities: Array<{ type: string; id: string; name: string }>
  suggestedAction?: string
  confidence: number // 0-1
  source: string // which analysis generated this
  createdAt: string
  expiresAt?: string
  dismissed: boolean
}

export type GenerativeUIBlock =
  | { type: 'metric_cards'; data: Array<{ label: string; value: string | number; trend?: 'up' | 'down' }> }
  | { type: 'data_table'; columns: string[]; rows: Array<Record<string, unknown>> }
  | { type: 'chart'; chartType: 'bar' | 'line' | 'pie'; data: unknown }
  | { type: 'checklist'; items: Array<{ text: string; checked: boolean }> }
  | { type: 'action_card'; title: string; description: string; actions: Array<{ label: string; action: string }> }
