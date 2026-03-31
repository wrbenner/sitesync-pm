// ── Generative UI Types ─────────────────────────────────
// Discriminated unions for each UI component the AI can render.
// The AI returns a tool result with `ui_type` field, which maps to a React component.

export type GenerativeUIBlock =
  | DataTableBlock
  | MetricCardsBlock
  | FormBlock
  | ChartBlock
  | ApprovalCardBlock
  | TimelineBlock
  | ChecklistBlock
  | ComparisonBlock
  | ScheduleCardBlock
  | CostBreakdownBlock
  | SafetyAlertBlock
  | RFIResponseBlock
  | PhotoGridBlock

// ── Data Table ──────────────────────────────────────────

export interface DataTableBlock {
  ui_type: 'data_table'
  title?: string
  columns: DataTableColumn[]
  rows: Record<string, unknown>[]
  actions?: TableAction[]
  total_count?: number
}

export interface DataTableColumn {
  key: string
  label: string
  type?: 'text' | 'status' | 'priority' | 'date' | 'number' | 'currency'
  sortable?: boolean
  width?: string
}

export interface TableAction {
  label: string
  action: string
  variant?: 'primary' | 'secondary' | 'danger'
  requiresPermission?: string
}

// ── Metric Cards ────────────────────────────────────────

export interface MetricCardsBlock {
  ui_type: 'metric_cards'
  cards: MetricCard[]
}

export interface MetricCard {
  label: string
  value: string | number
  unit?: string
  change?: number
  changeLabel?: string
  status?: 'good' | 'warning' | 'critical' | 'neutral'
  link?: string
}

// ── Form ────────────────────────────────────────────────

export interface FormBlock {
  ui_type: 'form'
  title: string
  entity_type: string
  fields: FormField[]
  submit_label?: string
  prefilled?: Record<string, unknown>
}

export interface FormField {
  name: string
  label: string
  type: 'text' | 'textarea' | 'select' | 'date' | 'number'
  required?: boolean
  placeholder?: string
  options?: Array<{ value: string; label: string }>
  value?: unknown
}

// ── Chart ───────────────────────────────────────────────

export interface ChartBlock {
  ui_type: 'chart'
  chart_type: 'bar' | 'line' | 'pie' | 'area'
  title?: string
  data: Record<string, unknown>[]
  x_key: string
  y_keys: string[]
  y_labels?: string[]
  colors?: string[]
}

// ── Approval Card ───────────────────────────────────────

export interface ApprovalCardBlock {
  ui_type: 'approval_card'
  entity_type: string
  entity_id: string
  title: string
  subtitle?: string
  fields: Array<{ label: string; value: string }>
  approve_action: string
  reject_action?: string
  approve_permission?: string
}

// ── Timeline ────────────────────────────────────────────

export interface TimelineBlock {
  ui_type: 'timeline'
  title?: string
  events: TimelineEvent[]
}

export interface TimelineEvent {
  date: string
  title: string
  description?: string
  status?: 'complete' | 'active' | 'upcoming'
  entity_type?: string
  entity_id?: string
}

// ── Checklist ───────────────────────────────────────────

export interface ChecklistBlock {
  ui_type: 'checklist'
  title?: string
  items: ChecklistItem[]
}

export interface ChecklistItem {
  id: string
  label: string
  checked: boolean
  entity_type?: string
  entity_id?: string
}

// ── Comparison ──────────────────────────────────────────

export interface ComparisonBlock {
  ui_type: 'comparison'
  title?: string
  columns: string[]
  rows: Array<{
    label: string
    values: (string | number)[]
    highlight?: 'better' | 'worse' | 'neutral'
  }>
}

// ── Schedule Card ──────────────────────────────────────

export interface ScheduleCardBlock {
  ui_type: 'schedule_card'
  task_id: string
  task_name: string
  start_date: string
  end_date: string
  progress: number
  status: 'on_track' | 'at_risk' | 'late' | 'complete'
  duration_days: number
  float_days: number
  is_critical_path: boolean
  crew?: {
    name: string
    headcount: number
    trades: string[]
  }
  dependencies?: Array<{
    task_id: string
    task_name: string
    type: 'FS' | 'SS' | 'SF' | 'FF'
  }>
  variance?: {
    schedule_days: number
    cost_dollars: number
  }
  notes?: string
}

// ── Cost Breakdown ─────────────────────────────────────

export interface CostBreakdownBlock {
  ui_type: 'cost_breakdown'
  title: string
  cost_code?: string
  line_items: CostLineItem[]
  total_budget: number
  total_spent: number
  total_variance: number
  percent_spent: number
  last_updated?: string
}

export interface CostLineItem {
  id: string
  description: string
  quantity: number
  unit: string
  unit_price: number
  budget: number
  spent: number
  variance: number
  percent_spent: number
  status: 'under_budget' | 'on_budget' | 'at_risk' | 'over_budget'
  trade?: string
}

// ── Safety Alert ───────────────────────────────────────

export interface SafetyAlertBlock {
  ui_type: 'safety_alert'
  alert_id: string
  severity: 'critical' | 'major' | 'minor'
  title: string
  description: string
  location: string
  reported_by: string
  timestamp: string
  status: 'open' | 'in_progress' | 'resolved'
  assigned_to?: string
  recommended_actions: string[]
  osha_reference?: string
  photo_url?: string
}

// ── RFI Response ──────────────────────────────────────

export interface RFIResponseBlock {
  ui_type: 'rfi_response'
  rfi_id: string
  rfi_number: string
  question: string
  asked_by: string
  asked_date: string
  status: 'open' | 'answered' | 'approved' | 'rejected' | 'on_hold'
  priority: 'low' | 'medium' | 'high' | 'critical'
  days_open: number
  trade?: string
  response?: string
  responded_by?: string
  responded_date?: string
  attachments?: Array<{
    id: string
    name: string
    file_type: string
    url: string
  }>
}

// ── Photo Grid ─────────────────────────────────────────

export interface PhotoGridBlock {
  ui_type: 'photo_grid'
  title: string
  location: string
  project_phase?: string
  progress_percent?: number
  photos: PhotoGridItem[]
}

export interface PhotoGridItem {
  id: string
  url: string
  captured_date: string
  captured_by: string
  caption?: string
  tags?: string[]
  before_after_pair_id?: string
}

// ── Type Guard ──────────────────────────────────────────

export function isGenerativeUI(result: Record<string, unknown>): result is GenerativeUIBlock {
  return typeof result.ui_type === 'string' && [
    'data_table', 'metric_cards', 'form', 'chart',
    'approval_card', 'timeline', 'checklist', 'comparison',
    'schedule_card', 'cost_breakdown', 'safety_alert', 'rfi_response', 'photo_grid',
  ].includes(result.ui_type as string)
}
