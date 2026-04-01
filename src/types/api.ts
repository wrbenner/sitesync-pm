import type { TableRow, InsertTables, UpdateTables } from './database'
import type { ReasonCode } from '../machines/changeOrderMachine'
import type { MappedSchedulePhase } from './entities'

// Row types (what you GET from the database)
export type ActivityFeedRow = TableRow<'activity_feed'>
/** activity_feed row with the profiles join from .select('*, user:profiles(id, full_name, avatar_url)') */
export interface ActivityFeedRowWithProfile extends ActivityFeedRow {
  user: { id: string; full_name: string | null; avatar_url: string | null } | null
}
export type OrganizationMemberRow = TableRow<'organization_members'>
export type ProjectMemberRow = TableRow<'project_members'>
export type AiInsightRow = TableRow<'ai_insights'>
// Minimal shape returned by the ai_insights meta query (created_at only)
export interface AiInsightMetaRow { created_at: string }
export type BudgetItemRow = TableRow<'budget_items'>
export type ChangeOrderRow = TableRow<'change_orders'>
export type CrewRow = TableRow<'crews'>
export type DailyLogRow = TableRow<'daily_logs'>
export type DailyLogEntryRow = TableRow<'daily_log_entries'>
export type DirectoryContactRow = TableRow<'directory_contacts'>
export type DrawingRow = TableRow<'drawings'> & { discipline?: string | null }
export type FieldCaptureRow = TableRow<'field_captures'>
export type FileRow = TableRow<'files'> & {
  parent_folder_id: string | null
}
export type MeetingRow = TableRow<'meetings'>
export type ProjectRow = TableRow<'projects'>

// Narrow summary row returned by getOrganizationProjectSummaries.
// Only the columns needed for portfolio aggregation are selected, keeping
// the network payload small on orgs with many projects.
export interface ProjectSummaryRow {
  id: string
  status: string | null
  contract_value: number | null
  target_completion: string | null
}
// Extended to include fields present in DB but not yet captured in the generated schema
export type PunchItemRow = TableRow<'punch_items'> & {
  verification_status?: string | null
  verified_by?: string | null
  verified_at?: string | null
  sub_completed_at?: string | null
  before_photo_url?: string | null
  after_photo_url?: string | null
  rejection_reason?: string | null
}
export type RfiRow = TableRow<'rfis'>
export type SchedulePhaseRow = TableRow<'schedule_phases'> & {
  baseline_start_date: string | null
  baseline_end_date: string | null
  baseline_percent_complete: number | null
  is_milestone: boolean | null
  predecessor_ids: string[] | null
  work_type: 'indoor' | 'outdoor' | 'both' | null
  location: string | null
  assigned_trade: string | null
  planned_labor_hours: number | null
  actual_labor_hours: number | null
}
export type SubmittalRow = TableRow<'submittals'>
export type TaskRow = TableRow<'tasks'>

// Insert types (what you send to create)
export type ActivityFeedInsert = InsertTables<'activity_feed'>
export type ProjectMemberInsert = InsertTables<'project_members'>
export type BudgetItemInsert = InsertTables<'budget_items'>
export type ChangeOrderInsert = InsertTables<'change_orders'>
export type CrewInsert = InsertTables<'crews'>
export type DailyLogInsert = InsertTables<'daily_logs'>
export type DrawingInsert = InsertTables<'drawings'>
export type FileInsert = InsertTables<'files'>
export type MeetingInsert = InsertTables<'meetings'>
export type ProjectInsert = InsertTables<'projects'>
export type PunchItemInsert = InsertTables<'punch_items'>
export type RfiInsert = InsertTables<'rfis'>
export type SchedulePhaseInsert = InsertTables<'schedule_phases'>
export type SubmittalInsert = InsertTables<'submittals'>
export type TaskInsert = InsertTables<'tasks'>

// Aggregated metrics from the project_metrics materialized view
export interface ProjectMetrics {
  project_id: string
  project_name: string
  contract_value: number | null
  overall_progress: number
  milestones_completed: number
  milestones_total: number
  schedule_variance_days: number | null
  rfis_open: number
  rfis_overdue: number | null
  rfis_total: number
  avg_rfi_response_days: number
  punch_open: number | null
  punch_total: number
  budget_total: number
  budget_spent: number
  budget_committed: number
  crews_active: number
  workers_onsite: number
  safety_incidents_this_month: number
  submittals_pending: number
  submittals_approved: number
  submittals_total: number
  planned_duration_days?: number | null
  // Computed fields (not DB columns; populated by getMetrics)
  aiHealthScore?: number | null
  aiConfidenceLevel?: number | null
}

// Shape returned by getMetrics
export interface ProjectMetricsResult {
  progress: number
  budgetSpent: number
  budgetTotal: number
  crewsActive: number
  workersOnSite: number
  rfiOpen: number
  rfiOverdue: number | null
  punchListOpen: number | null
  aiHealthScore: number | null
  daysBeforeSchedule: number
  milestonesHit: number
  milestoneTotal: number
  aiConfidenceLevel: number | null
  // Computed from financialEngine / schedule_phases
  budgetVariance: number | null
  scheduleVarianceDays: number | null
  completionPercentage: number | null
}

// Submittal revision row (not yet in database.ts schema, defined here manually)
export interface SubmittalRevision {
  id: string
  submittal_id: string
  revision_number: number
  submitted_by: string
  submitted_at: string
  reviewer_id: string | null
  reviewer_role: 'gc' | 'architect' | 'engineer'
  review_status: 'pending' | 'approved' | 'approved_as_noted' | 'revise_resubmit' | 'rejected'
  review_comments: string | null
  reviewed_at: string | null
  file_urls: string[]
}

export interface CreateSubmittalRevisionPayload {
  submitted_by: string
  reviewer_id?: string | null
  reviewer_role: 'gc' | 'architect' | 'engineer'
  file_urls?: string[]
}

// Drawing revision row (not yet in database.ts schema, defined here manually)
export interface DrawingRevision {
  id: string
  drawing_id: string
  revision_number: number
  issued_date: string | null
  issued_by: string | null
  change_description: string | null
  file_url: string | null
  superseded_at: string | null
}

// Computed/mapped drawing returned by getDrawings
export interface MappedDrawing extends DrawingRow {
  setNumber: string
  disciplineColor: string
  disciplineLabel: string
  disciplineIcon: string
  date: string
  sheetCount: number
  revisions: DrawingRevision[]
  currentRevision: DrawingRevision | null
}

// Computed/mapped file returned by getFiles
export interface MappedFile extends FileRow {
  type: 'folder' | 'file'
  size: string
  modifiedDate: string
  itemCount: number
  totalSize: number
  lastModified: string | undefined
}

// Lien waiver row (not yet in database.ts schema, defined here manually)
export type LienWaiverType =
  | 'conditional_progress'
  | 'unconditional_progress'
  | 'conditional_final'
  | 'unconditional_final'

export type LienWaiverStatus = 'pending' | 'received' | 'executed'

export interface LienWaiverRow {
  id: string
  project_id: string
  subcontractor_id: string
  payment_period: string
  waiver_type: LienWaiverType
  amount: number
  status: LienWaiverStatus
  pay_application_id: string | null
  waiver_date: string | null
  submitted_at: string | null
  received_at: string | null
  created_at: string
}

export interface LienWaiverInsert {
  id?: string
  project_id: string
  subcontractor_id: string
  payment_period: string
  waiver_type: LienWaiverType
  amount: number
  status?: LienWaiverStatus
  pay_application_id?: string | null
  waiver_date?: string | null
  submitted_at?: string | null
  received_at?: string | null
}

// Pay Application row (AIA G702 billing)
export interface PayApplication {
  id: string
  project_id: string
  contract_id: string | null
  application_number: number
  period_from: string | null
  period_to: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  original_contract_sum: number | null
  net_change_orders: number | null
  total_completed_and_stored: number | null
  retainage: number | null
  total_earned_less_retainage: number | null
  less_previous_certificates: number | null
  current_payment_due: number | null
  balance_to_finish: number | null
  submitted_date: string | null
  approved_date: string | null
  created_at: string | null
  updated_at: string | null
}

export interface CreatePayAppPayload {
  contract_id: string
  application_number?: number
  period_from?: string | null
  period_to: string
  original_contract_sum?: number | null
  net_change_orders?: number | null
}

// Alias for LienWaiverRow for use in feature code
export type LienWaiver = LienWaiverRow

// Pagination support for list endpoints
export interface PaginationParams {
  page?: number
  pageSize?: number
}

export interface PaginatedResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}

// Type guard for ReasonCode (used by budget.ts to safely narrow co.reason)
const REASON_CODES = new Set<ReasonCode>([
  'owner_change',
  'design_error',
  'field_condition',
  'regulatory',
  'value_engineering',
  'unforeseen',
])

export function isReasonCode(v: unknown): v is ReasonCode {
  return typeof v === 'string' && REASON_CODES.has(v as ReasonCode)
}

// Incident record stored in the daily_logs.incident_data JSONB column
export interface IncidentData {
  description: string
  type: string
  corrective_action: string
}

// Payload for creating or updating a daily log via the field API and offline queue
export interface DailyLogPayload {
  log_date: string
  weather?: string | null
  weather_source?: 'open-meteo' | 'manual' | 'default' | null
  temperature_high?: number | null
  temperature_low?: number | null
  wind_speed?: string | null
  precipitation?: string | null   // stored as "X.XX in" string for display
  workers_onsite?: number | null
  total_hours?: number | null
  incidents?: number | null
  incident_data?: IncidentData[] | null
  summary?: string | null
  photos?: string[]
  amended_from_id?: string | null  // set when creating an amendment of a submitted log
}

// Payload for creating a new RFI
export interface CreateRfiPayload {
  title: string
  description?: string | null
  number?: number | null
  status?: string | null
  priority?: string | null
  due_date?: string | null
  assigned_to?: string | null
  spec_section?: string | null
  drawing_reference?: string | null
  question?: string | null
}

// Payload for creating or updating a submittal
export interface CreateSubmittalPayload {
  title: string
  description?: string | null
  number?: number | null
  status?: string | null
  spec_section?: string | null
  subcontractor?: string | null
  due_date?: string | null
  required_on_site?: string | null
}

// Payload for creating a new change order
export interface CreateChangeOrderPayload {
  title: string
  description?: string | null
  type?: 'pco' | 'cor' | 'co'
  status?: string | null
  amount?: number | null
  reason?: string | null
  cost_code?: string | null
  schedule_impact_days?: number | null
  requested_by?: string | null
  requested_date?: string | null
  budget_line_item_id?: string | null
  parent_co_id?: string | null
}

// CreateDailyLogPayload is an alias for DailyLogPayload
export type CreateDailyLogPayload = DailyLogPayload

// MappedSchedulePhase is defined in entities.ts and re-exported here for backwards compatibility
export type { MappedSchedulePhase, ScheduleWorkType } from './entities'

// Canonical schedule activity type used by the schedule module.
// Standalone interface (snake_case) with CPM-computed critical path fields.
export interface ScheduleActivity {
  id: string
  project_id: string
  name: string
  description: string | null
  start_date: string
  finish_date: string
  baseline_start: string | null
  baseline_finish: string | null
  actual_start: string | null
  actual_finish: string | null
  percent_complete: number
  planned_percent_complete: number
  duration_days: number
  float_days: number
  is_critical: boolean
  is_milestone: boolean
  wbs_code: string | null
  trade: string | null
  assigned_sub_id: string | null
  outdoor_activity: boolean
  predecessor_ids: string[]
  successor_ids: string[]
  status: 'not_started' | 'in_progress' | 'completed' | 'delayed'
  created_at: string
  updated_at: string
}

// Update types (what you send to patch)
export type ActivityFeedUpdate = UpdateTables<'activity_feed'>
export type BudgetItemUpdate = UpdateTables<'budget_items'>
export type ChangeOrderUpdate = UpdateTables<'change_orders'>
export type CrewUpdate = UpdateTables<'crews'>
export type DailyLogUpdate = UpdateTables<'daily_logs'>
export type DrawingUpdate = UpdateTables<'drawings'>
export type FileUpdate = UpdateTables<'files'>
export type MeetingUpdate = UpdateTables<'meetings'>
export type ProjectUpdate = UpdateTables<'projects'>
export type PunchItemUpdate = UpdateTables<'punch_items'>
export type RfiUpdate = UpdateTables<'rfis'>
export type SchedulePhaseUpdate = UpdateTables<'schedule_phases'>
export type SubmittalUpdate = UpdateTables<'submittals'>
export type TaskUpdate = UpdateTables<'tasks'>
