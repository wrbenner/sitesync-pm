// Canonical frontend entity types derived from the Supabase database schema.
// Always import from here, never define ad-hoc interfaces for database entities.

import type { Database } from './database'

type Tables = Database['public']['Tables']

// ── Base Row Types (what you get from SELECT) ────────────────
export type Project = Tables['projects']['Row']
export type ProjectMember = Tables['project_members']['Row']
export type RFI = Tables['rfis']['Row']
export type RFIResponse = Tables['rfi_responses']['Row']
export type Submittal = Tables['submittals']['Row']
export type SubmittalApproval = Tables['submittal_approvals']['Row']
export type PunchItem = Tables['punch_items']['Row']
export type Task = Tables['tasks']['Row']
export type Drawing = Tables['drawings']['Row']
export type DailyLog = Tables['daily_logs']['Row']
export type DailyLogEntry = Tables['daily_log_entries']['Row']
export type Crew = Tables['crews']['Row']
export type BudgetItem = Tables['budget_items']['Row']
export type ChangeOrder = Tables['change_orders']['Row']
export type Meeting = Tables['meetings']['Row']
export type MeetingAttendee = Tables['meeting_attendees']['Row']
export type MeetingActionItem = Tables['meeting_action_items']['Row']
export type DirectoryContact = Tables['directory_contacts']['Row']
export type FileRecord = Tables['files']['Row']
export type FieldCapture = Tables['field_captures']['Row']
export type SchedulePhase = Tables['schedule_phases']['Row']
export type Notification = Tables['notifications']['Row']
export type ActivityFeedRow = Tables['activity_feed']['Row']

/** Enriched activity feed item with resolved actor info and entity label. */
export interface ActivityFeedItem {
  id: string
  actorName: string
  actorAvatar: string | null
  verb: string
  entityType: string
  entityLabel: string
  entityId: string
  projectId: string
  createdAt: string
  metadata: Record<string, unknown>
}
export type AIInsight = Tables['ai_insights']['Row']
export type ProjectSnapshot = Tables['project_snapshots']['Row']

// ── Insert Types (for mutations) ─────────────────────────────
export type ProjectInsert = Tables['projects']['Insert']
export type RFIInsert = Tables['rfis']['Insert']
export type SubmittalInsert = Tables['submittals']['Insert']
export type PunchItemInsert = Tables['punch_items']['Insert']
export type TaskInsert = Tables['tasks']['Insert']
export type DailyLogInsert = Tables['daily_logs']['Insert']
export type ChangeOrderInsert = Tables['change_orders']['Insert']
export type MeetingInsert = Tables['meetings']['Insert']
export type DirectoryContactInsert = Tables['directory_contacts']['Insert']
export type FileInsert = Tables['files']['Insert']
export type FieldCaptureInsert = Tables['field_captures']['Insert']

// ── Update Types (for mutations) ─────────────────────────────
export type ProjectUpdate = Tables['projects']['Update']
export type RFIUpdate = Tables['rfis']['Update']
export type SubmittalUpdate = Tables['submittals']['Update']
export type PunchItemUpdate = Tables['punch_items']['Update']
export type TaskUpdate = Tables['tasks']['Update']
export type DailyLogUpdate = Tables['daily_logs']['Update']
export type ChangeOrderUpdate = Tables['change_orders']['Update']

// ── Status Enums ─────────────────────────────────────────────
export type Priority = 'low' | 'medium' | 'high' | 'critical'
export type RFIStatus = 'open' | 'under_review' | 'answered' | 'closed'
export type SubmittalStatus = 'pending' | 'under_review' | 'approved' | 'rejected' | 'resubmit'
export type PunchItemStatus = 'open' | 'in_progress' | 'resolved' | 'verified'
export type TaskStatus = 'todo' | 'in_progress' | 'in_review' | 'done'
export type ProjectRole = 'owner' | 'admin' | 'member' | 'viewer'
export type ChangeOrderStatus = 'pending' | 'approved' | 'rejected'
export type DailyLogStatus = 'draft' | 'submitted' | 'approved'
export type IncidentSeverity = 'first_aid' | 'medical_treatment' | 'lost_time' | 'fatality'

// ── JSON Utility Type ────────────────────────────────────────
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

// ── Schedule Domain ──────────────────────────────────────────
export type ScheduleWorkType = 'indoor' | 'outdoor' | 'both'

type DbSchedulePhaseRow = Tables['schedule_phases']['Row']

/** Fully-mapped construction schedule phase returned by the API layer.
 *  All nullable DB fields are kept as-is; computed/convenience fields are non-null.
 */
export interface MappedSchedulePhase extends DbSchedulePhaseRow {
  // Extended domain fields not yet in DB schema
  baseline_start_date: string | null
  baseline_end_date: string | null
  baseline_percent_complete: number | null
  is_milestone: boolean | null
  predecessor_ids: string[] | null
  work_type: ScheduleWorkType | null
  location: string | null
  assigned_trade: string | null
  planned_labor_hours: number | null
  actual_labor_hours: number | null

  // Camelcase convenience aliases (non-null / defaulted)
  startDate: string
  endDate: string
  progress: number
  critical: boolean
  completed: boolean
  baselineStartDate: string | null
  baselineEndDate: string | null
  baselineProgress: number
  slippageDays: number
  earnedValue: number

  // Computed fields (always non-null)
  isOnCriticalPath: boolean
  floatDays: number
  scheduleVarianceDays: number

  // Camelcase versions of new domain fields (non-null / defaulted)
  isMilestone: boolean
  predecessorIds: string[]
  plannedLaborHours: number
  actualLaborHours: number
}
