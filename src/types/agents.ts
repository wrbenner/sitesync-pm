// ── Multi-Agent System Types ──────────────────────────────────
// Type definitions for the SiteSync AI agent orchestration system.
// Six specialist agents + one coordinator, each with domain-specific tools.

// ── Agent Domains ─────────────────────────────────────────────

export const AGENT_DOMAINS = [
  'schedule',
  'cost',
  'safety',
  'quality',
  'compliance',
  'document',
] as const

export type AgentDomain = (typeof AGENT_DOMAINS)[number]

// ── Agent Tool Definitions ────────────────────────────────────

export interface AgentToolDef {
  name: string
  description: string
  parameters: Record<string, {
    type: 'string' | 'number' | 'boolean' | 'array' | 'object'
    description: string
    required?: boolean
    enum?: string[]
  }>
}

// Tools available to each specialist agent
export const AGENT_TOOLS: Record<AgentDomain, string[]> = {
  schedule: [
    'query_tasks',
    'query_schedule',
    'predict_delays',
    'analyze_critical_path',
    'query_weather_impact',
    'suggest_reordering',
  ],
  cost: [
    'query_budget',
    'query_change_orders',
    'earned_value_analysis',
    'forecast_costs',
    'query_contingency',
    'draft_change_order',
  ],
  safety: [
    'query_incidents',
    'query_inspections',
    'analyze_safety_photos',
    'query_weather',
    'generate_jha',
    'track_corrective_actions',
  ],
  quality: [
    'query_punch_items',
    'query_submittals',
    'query_inspections',
    'analyze_rework',
    'predict_rework_risk',
    'suggest_inspection_schedule',
  ],
  compliance: [
    'query_certifications',
    'query_insurance',
    'query_payroll',
    'check_prevailing_wage',
    'flag_expiring_cois',
    'generate_compliance_report',
  ],
  document: [
    'search_documents',
    'extract_from_pdf',
    'cross_reference_specs',
    'generate_report',
    'find_spec_sections',
    'generate_closeout_docs',
  ],
} as const

// ── Agent Identity ────────────────────────────────────────────

export interface AgentIdentity {
  domain: AgentDomain
  name: string
  shortName: string
  description: string
  expertise: string[]
  icon: string // lucide icon name
  accentColor: string // theme token key
}

export const SPECIALIST_AGENTS: Record<AgentDomain, AgentIdentity> = {
  schedule: {
    domain: 'schedule',
    name: 'Schedule Agent',
    shortName: 'Schedule',
    description: 'Gantt analysis, look ahead scheduling, delay forensics, weather impact',
    expertise: [
      'Critical path analysis',
      'Float consumption tracking',
      'Delay prediction and forensics',
      'Weather impact assessment',
      'Task reordering optimization',
      'Completion date forecasting',
    ],
    icon: 'Calendar',
    accentColor: 'statusInfo',
  },
  cost: {
    domain: 'cost',
    name: 'Cost Agent',
    shortName: 'Cost',
    description: 'EVM metrics (CPI/SPI/EAC), cash flow projection, contingency tracking',
    expertise: [
      'Earned value management (CPI/SPI/EAC)',
      'Cash flow projection',
      'Contingency tracking',
      'Change order analysis',
      'Budget overrun detection',
      'Final cost projection',
    ],
    icon: 'DollarSign',
    accentColor: 'statusActive',
  },
  safety: {
    domain: 'safety',
    name: 'Safety Agent',
    shortName: 'Safety',
    description: 'OSHA compliance, PPE detection, hazard identification, EMR calculation',
    expertise: [
      'OSHA compliance verification',
      'PPE violation detection',
      'Job Hazard Analysis generation',
      'Incident trend analysis',
      'EMR calculation',
      'Corrective action tracking',
    ],
    icon: 'ShieldCheck',
    accentColor: 'statusCritical',
  },
  quality: {
    domain: 'quality',
    name: 'Quality Agent',
    shortName: 'Quality',
    description: 'Punch list management, submittal review, QA/QC checklists, rework analysis',
    expertise: [
      'Punch list trend analysis',
      'Submittal review tracking',
      'QA/QC checklist management',
      'Rework risk prediction',
      'Inspection scheduling',
      'Deficiency trend analysis',
    ],
    icon: 'ClipboardCheck',
    accentColor: 'statusPending',
  },
  compliance: {
    domain: 'compliance',
    name: 'Compliance Agent',
    shortName: 'Compliance',
    description: 'Davis Bacon compliance, certified payroll, lien waivers, insurance tracking',
    expertise: [
      'Davis Bacon wage verification',
      'Certified payroll analysis',
      'Lien waiver tracking',
      'Insurance certificate monitoring',
      'COI expiration alerts',
      'Compliance report generation',
    ],
    icon: 'Scale',
    accentColor: 'statusReview',
  },
  document: {
    domain: 'document',
    name: 'Document Agent',
    shortName: 'Docs',
    description: 'Spec section lookup, drawing cross reference, report generation, closeout docs',
    expertise: [
      'Specification section lookup',
      'Drawing cross referencing',
      'Report generation',
      'RFI spec matching',
      'Closeout document preparation',
      'PDF data extraction',
    ],
    icon: 'FileSearch',
    accentColor: 'statusInfo',
  },
} as const

// ── Orchestrator Types ────────────────────────────────────────

export type OrchestratorIntent =
  | 'single_agent'    // Route to one specialist
  | 'multi_agent'     // Route to multiple specialists in parallel
  | 'general'         // Coordinator handles directly (greetings, meta questions)
  | 'clarification'   // Need more info from user

export interface IntentClassification {
  intent: OrchestratorIntent
  targetAgents: AgentDomain[]
  confidence: number
  reasoning: string
  mentionedAgent?: AgentDomain // If user used @mention
}

export interface AgentExecutionRequest {
  domain: AgentDomain
  userMessage: string
  conversationHistory: AgentConversationMessage[]
  projectContext: ProjectContext
  tools: string[]
}

export interface AgentExecutionResult {
  domain: AgentDomain
  content: string
  toolCalls: AgentToolCall[]
  suggestedActions: AgentSuggestedAction[]
  confidence: number
  processingTimeMs: number
  handoffSuggestion?: {
    targetDomain: AgentDomain
    reason: string
  }
}

export interface AgentToolCall {
  id: string
  tool: string
  input: Record<string, unknown>
  result: Record<string, unknown>
  domain: AgentDomain
}

export interface AgentSuggestedAction {
  id: string
  domain: AgentDomain
  description: string
  tool: string
  input: Record<string, unknown>
  confidence: number
  impact: 'low' | 'medium' | 'high' | 'critical'
  requiresApproval: boolean
}

// ── Conversation Types ────────────────────────────────────────

export interface AgentConversationMessage {
  id: string
  role: 'user' | 'coordinator' | 'agent'
  content: string
  timestamp: Date
  // Agent-specific fields
  agentDomain?: AgentDomain
  agentName?: string
  // Rich content
  toolCalls?: AgentToolCall[]
  suggestedActions?: AgentSuggestedAction[]
  entityRefs?: AgentEntityRef[]
  generativeBlocks?: GenerativeBlock[]
  // Routing metadata
  routingInfo?: {
    intent: OrchestratorIntent
    targetAgents: AgentDomain[]
    reasoning: string
  }
  // Handoff
  handoff?: {
    from: AgentDomain
    to: AgentDomain
    reason: string
  }
}

export interface AgentEntityRef {
  type: string
  id: string
  label: string
  domain: AgentDomain
}

export interface GenerativeBlock {
  type: 'data_table' | 'metric_cards' | 'chart' | 'form' | 'comparison' | 'timeline'
  data: Record<string, unknown>
}

// ── Batch Action Types ────────────────────────────────────────

export type ActionApprovalStatus = 'pending' | 'approved' | 'rejected' | 'executing' | 'completed' | 'failed'

export interface BatchAction {
  id: string
  actions: AgentSuggestedAction[]
  status: ActionApprovalStatus
  createdAt: Date
  resolvedAt?: Date
  resolvedBy?: string
  results?: Record<string, { success: boolean; message: string }>
}

// ── Project Context ───────────────────────────────────────────

export interface ProjectContext {
  projectId: string
  userId?: string
  page?: string
  entityContext?: string
  // Enriched context for agents
  projectName?: string
  projectPhase?: string
  percentComplete?: number
}

// ── Agent Activity / Audit Trail ──────────────────────────────

export interface AgentActivity {
  id: string
  domain: AgentDomain
  action: string
  description: string
  status: ActionApprovalStatus
  confidence: number
  createdAt: Date
  resolvedAt?: Date
  userId?: string
  metadata?: Record<string, unknown>
}

// ── Agent Status ──────────────────────────────────────────────

export type AgentStatus = 'active' | 'paused' | 'error' | 'initializing'

export interface AgentState {
  domain: AgentDomain
  status: AgentStatus
  lastActivity?: Date
  totalActions: number
  approvedActions: number
  rejectedActions: number
  averageConfidence: number
  activeConversations: number
}

// ── Orchestrator Response ─────────────────────────────────────

export interface OrchestratorResponse {
  messages: AgentConversationMessage[]
  pendingActions: AgentSuggestedAction[]
  metadata: {
    totalAgentsInvoked: number
    totalProcessingTimeMs: number
    intent: IntentClassification
  }
}

// ── @Mention parsing ──────────────────────────────────────────

const DOMAIN_ALIASES: Record<string, AgentDomain> = {
  schedule: 'schedule',
  scheduling: 'schedule',
  gantt: 'schedule',
  timeline: 'schedule',
  cost: 'cost',
  budget: 'cost',
  finance: 'cost',
  money: 'cost',
  evm: 'cost',
  safety: 'safety',
  osha: 'safety',
  ppe: 'safety',
  hazard: 'safety',
  quality: 'quality',
  punch: 'quality',
  qc: 'quality',
  qa: 'quality',
  submittal: 'quality',
  compliance: 'compliance',
  payroll: 'compliance',
  insurance: 'compliance',
  davis: 'compliance',
  lien: 'compliance',
  document: 'document',
  docs: 'document',
  spec: 'document',
  drawing: 'document',
  report: 'document',
}

export function parseAgentMention(text: string): AgentDomain | null {
  const mentionMatch = text.match(/@(\w+)/)
  if (!mentionMatch) return null
  const mention = mentionMatch[1].toLowerCase()
  return DOMAIN_ALIASES[mention] ?? null
}

export function stripAgentMention(text: string): string {
  return text.replace(/@\w+\s*/, '').trim()
}
