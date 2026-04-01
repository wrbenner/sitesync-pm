import type { TableRow, InsertTables, UpdateTables } from './database'

// Row types (what you GET from the database)
export type ActivityFeedRow = TableRow<'activity_feed'>
export type AiInsightRow = TableRow<'ai_insights'>
export type BudgetItemRow = TableRow<'budget_items'>
export type ChangeOrderRow = TableRow<'change_orders'>
export type CrewRow = TableRow<'crews'>
export type DailyLogRow = TableRow<'daily_logs'>
export type DirectoryContactRow = TableRow<'directory_contacts'>
export type DrawingRow = TableRow<'drawings'>
export type FieldCaptureRow = TableRow<'field_captures'>
export type FileRow = TableRow<'files'>
export type MeetingRow = TableRow<'meetings'>
export type ProjectRow = TableRow<'projects'>
export type PunchItemRow = TableRow<'punch_items'>
export type RfiRow = TableRow<'rfis'>
export type SchedulePhaseRow = TableRow<'schedule_phases'>
export type SubmittalRow = TableRow<'submittals'>
export type TaskRow = TableRow<'tasks'>

// Insert types (what you send to create)
export type ActivityFeedInsert = InsertTables<'activity_feed'>
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
  rfis_open: number
  rfis_overdue: number
  rfis_total: number
  avg_rfi_response_days: number
  punch_open: number
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
