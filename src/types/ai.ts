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
  type: 'risk' | 'recommendation' | 'anomaly' | 'prediction' | 'budget_risk' | 'schedule_risk' | 'onboarding' | 'action_needed'
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  affectedEntities: Array<{ type: string; id: string; name: string }>
  suggestedAction?: string
  confidence: number // 0-1
  isPlaceholder?: boolean // true for onboarding prompts, not real analysis results
  source?: 'live' | 'cached' | 'supabase' | 'fallback' | 'onboarding' | 'computed' // which analysis generated this
  createdAt: string
  generatedAt?: string
  expiresAt?: string
  dismissed: boolean
}

export interface AiInsightsResponse {
  insights: AIInsight[]
  /** 'ai-live' when served directly from the AI service; 'ai-cached' when served from Supabase (no failure); 'ai-degraded' when aiService threw an error and we fell back to cache or placeholders; 'ai-fallback' when no data exists and starter insights are shown; 'computed' when generated from live project data queries without AI. */
  dataSource: 'ai-live' | 'ai-cached' | 'ai-degraded' | 'ai-fallback' | 'computed'
  /** ISO timestamp set when results were served from Supabase cache after aiService failed. */
  lastFallbackAt?: string
  /** True when the AI service threw an error and results are from cache or onboarding placeholders. */
  degraded?: boolean
  /** The error type (Error.name) from the AI service failure, for frontend banner messaging. */
  degradedReason?: string
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

export type DrawingDiscipline =
  | 'architectural'
  | 'structural'
  | 'mechanical'
  | 'electrical'
  | 'plumbing'
  | 'mep'
  | 'civil'
  | 'interior_design'
  | 'unclassified'

export type DrawingClassificationStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface DrawingPairingTokens {
  areaToken?: string | null
  sectionToken?: string | null
}

export interface DrawingViewportBlock {
  title?: string | null
  scale?: string | null
  floorId?: string | null
}

export interface DrawingViewportDetails {
  hasMultipleDesigns?: boolean
  designBlocks?: DrawingViewportBlock[]
}

export interface DrawingDesignDescription {
  sheetNumber?: string | null
  drawingTitle?: string | null
  projectName?: string | null
  projectAddress?: string | null
  buildingName?: string | null
  buildingType?: string | null
  buildingBlock?: string | null
  floorLevel?: string | null
  levelNumber?: number | null
  discipline?: string | null
  planType?: string | null
  hasDimensions?: boolean | null
  planTypeConfidence?: number | null
  levelConfidence?: number | null
  notes?: string | null
  scaleText?: string | null
  scaleRatio?: number | null
}

export interface DrawingClassification {
  id: string
  drawing_id: string | null
  project_id: string | null
  sheet_number: string | null
  drawing_title: string | null
  building_name: string | null
  floor_level: string | null
  discipline: DrawingDiscipline | null
  plan_type: string | null
  scale_text: string | null
  scale_ratio: number | null
  design_description: DrawingDesignDescription | null
  viewport_details: DrawingViewportDetails | null
  pairing_tokens: DrawingPairingTokens | null
  classification_confidence: number | null
  processing_status: DrawingClassificationStatus
  processed_at: string | null
  ai_cost_cents: number
  created_at: string
}

export interface ClassifyDrawingResult {
  classification_id: string
  drawing_id: string
  discipline: DrawingDiscipline
  plan_type: string | null
  sheet_number: string | null
  drawing_title: string | null
  scale_text: string | null
  scale_ratio: number | null
  confidence: number | null
  ai_cost_cents: number
  status: DrawingClassificationStatus
}

export interface RevisionDiffScaleInfo {
  scale_ratio: number | null
  scale_text: string
  confidence: number
  method: string
}

export interface RevisionDiffResult {
  drawing_id: string
  project_id: string
  old_revision: { url: string; label: string; scale: RevisionDiffScaleInfo }
  new_revision: { url: string; label: string; scale: RevisionDiffScaleInfo }
  scale_correction: { scaling_factor: number; notes: string }
  blend_mode: 'screen'
  colors: { old: string; new: string }
  threshold: number
  web_scale_factor: number
  notes: string
}

// ── Phase 3: Drawing Intelligence Engine ────────────────────

export type DrawingPairStatus =
  | 'pending'
  | 'detecting_edges'
  | 'edges_detected'
  | 'analyzing'
  | 'completed'
  | 'failed'

export interface DetectedEdge {
  x: number
  y: number
  w: number
  h: number
  confidence?: number
  label?: string | null
}

export interface DetectedEdges {
  arch: DetectedEdge[]
  struct: DetectedEdge[]
}

export interface DrawingPair {
  id: string
  project_id: string
  arch_drawing_id: string | null
  struct_drawing_id: string | null
  arch_page_number: number | null
  struct_page_number: number | null
  arch_classification_id: string | null
  struct_classification_id: string | null
  pairing_confidence: number | null
  pairing_method: string
  pairing_reason: string | null
  status: DrawingPairStatus
  overlap_image_url: string | null
  detected_edges: DetectedEdges | null
  discrepancies: unknown
  created_at: string
  updated_at: string
}

export type DiscrepancySeverity = 'high' | 'medium' | 'low'

export interface DrawingDiscrepancy {
  id: string
  pair_id: string | null
  project_id: string
  description: string
  arch_dimension: string | null
  struct_dimension: string | null
  location_on_drawing: { x?: number; y?: number; w?: number; h?: number } | null
  severity: DiscrepancySeverity | null
  confidence: number | null
  auto_rfi_id: string | null
  user_confirmed: boolean
  is_false_positive: boolean
  created_at: string
}

export type GenerativeUIBlock =
  | { type: 'metric_cards'; data: Array<{ label: string; value: string | number; trend?: 'up' | 'down' }> }
  | { type: 'data_table'; columns: string[]; rows: Array<Record<string, unknown>> }
  | { type: 'chart'; chartType: 'bar' | 'line' | 'pie'; data: unknown }
  | { type: 'checklist'; items: Array<{ text: string; checked: boolean }> }
  | { type: 'action_card'; title: string; description: string; actions: Array<{ label: string; action: string }> }
