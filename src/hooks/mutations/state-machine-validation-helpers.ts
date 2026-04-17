import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import posthog from '../../lib/analytics'
import { useAuditedMutation, createOnError } from './createAuditedMutation'
import { invalidateEntity } from '../../api/invalidation'
import { toast } from 'sonner'
import Sentry from '../../lib/sentry'
import {
  rfiSchema, submittalSchema, punchItemSchema,
  taskSchema, changeOrderSchema, meetingSchema, dailyLogSchema,
} from '../../components/forms/schemas'
import { useOfflineMutation } from '../useOfflineMutation'
import { createDailyLog, updateDailyLog } from '../../api/endpoints/field'
import type { DailyLogPayload } from '../../types/api'
import { getValidTransitions } from '../../machines/rfiMachine'
import { getValidSubmittalStatusTransitions } from '../../machines/submittalMachine'
import { getValidTaskTransitions } from '../../services/taskService'
import { getValidPunchTransitions } from '../../machines/punchItemMachine'
import { getValidDailyLogTransitions } from '../../services/dailyLogService'
import type { TaskState } from '../../machines/taskMachine'
import type { PunchItemState } from '../../machines/punchItemMachine'
import type { DailyLogState } from '../../machines/dailyLogMachine'
import type { RfiStatus } from '../../types/database'
import type { SubmittalStatus } from '../../types/submittal'

import type { Database } from '../../types/database'
type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
const from = (table: AnyTableName) => supabase.from(table as keyof Database['public']['Tables'])

// ── State machine validation helpers ─────────────────────

async function resolveUserRole(projectId: string): Promise<string> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (!userId || !projectId) return 'viewer'
    const { data } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single()
    return (data?.role as string) ?? 'viewer'
  } catch {
    return 'viewer'
  }
}

async function validateRfiStatusTransition(
  rfiId: string,
  projectId: string,
  newStatus: string,
): Promise<void> {
  const { data: rfi } = await supabase
    .from('rfis')
    .select('status')
    .eq('id', rfiId)
    .single()
  if (!rfi) return // Let DB handle missing entity
  const userRole = await resolveUserRole(projectId)
  const validTransitions = getValidTransitions(rfi.status as RfiStatus, userRole)
  // Map from machine action labels to status values
  const rfiActionToStatus: Record<string, string> = {
    'Submit': 'open',
    'Assign for Review': 'under_review',
    'Respond': 'answered',
    'Close': 'closed',
    'Reopen': 'open',
    'Void': 'void',
  }
  const allowedStatuses = validTransitions.map((action) => rfiActionToStatus[action]).filter(Boolean)
  if (!allowedStatuses.includes(newStatus)) {
    throw new Error(
      `Invalid RFI status transition: ${rfi.status} → ${newStatus} (role: ${userRole}). Valid transitions: ${validTransitions.join(', ')}`,
    )
  }
}

async function validateSubmittalStatusTransition(
  submittalId: string,
  projectId: string,
  newStatus: string,
): Promise<void> {
  const { data: submittal } = await supabase
    .from('submittals')
    .select('status')
    .eq('id', submittalId)
    .single()
  if (!submittal) return // Let DB handle missing entity
  const userRole = await resolveUserRole(projectId)
  const validNext = getValidSubmittalStatusTransitions(submittal.status as SubmittalStatus, userRole)
  if (!validNext.includes(newStatus as SubmittalStatus)) {
    throw new Error(
      `Invalid submittal status transition: ${submittal.status} → ${newStatus} (role: ${userRole}). Valid: ${validNext.join(', ')}`,
    )
  }
}

async function validateTaskStatusTransition(
  taskId: string,
  projectId: string,
  newStatus: string,
): Promise<void> {
  const { data: task } = await supabase.from('tasks').select('status').eq('id', taskId).single()
  if (!task) return
  const userRole = await resolveUserRole(projectId)
  const current = (task.status ?? 'todo') as TaskState
  const valid = getValidTaskTransitions(current, userRole)
  if (!valid.includes(newStatus as TaskState)) {
    throw new Error(
      `Invalid task status transition: ${current} → ${newStatus} (role: ${userRole}). Valid: ${valid.join(', ') || '(none)'}`,
    )
  }
}

async function validatePunchItemStatusTransition(
  punchItemId: string,
  _projectId: string,
  newStatus: string,
): Promise<void> {
  const { data: item } = await supabase.from('punch_items').select('status').eq('id', punchItemId).single()
  if (!item) return
  // punchItemMachine uses action-label transitions; convert valid actions to
  // the set of target statuses reachable from the current state.
  const current = ((item as { status?: string | null }).status ?? 'open') as PunchItemState
  const actionToStatus: Record<string, PunchItemState> = {
    'Start Work': 'in_progress',
    'Verify (Complete at Creation)': 'verified',
    'Mark Resolved': 'resolved',
    'Reopen': 'open',
    'Verify': 'verified',
    'Reject Verification': 'in_progress',
  }
  const allowed = getValidPunchTransitions(current)
    .map((a) => actionToStatus[a])
    .filter(Boolean)
  if (!allowed.includes(newStatus as PunchItemState)) {
    throw new Error(
      `Invalid punch item status transition: ${current} → ${newStatus}. Valid: ${allowed.join(', ') || '(none)'}`,
    )
  }
}

async function validateDailyLogStatusTransition(
  logId: string,
  projectId: string,
  newStatus: string,
): Promise<void> {
  const { data: log } = await supabase.from('daily_logs').select('status').eq('id', logId).single()
  if (!log) return
  const userRole = await resolveUserRole(projectId)
  const current = ((log as { status?: string | null }).status ?? 'draft') as DailyLogState
  const valid = getValidDailyLogTransitions(current, userRole)
  if (!valid.includes(newStatus as DailyLogState)) {
    throw new Error(
      `Invalid daily log status transition: ${current} → ${newStatus} (role: ${userRole}). Valid: ${valid.join(', ') || '(none)'}`,
    )
  }
}
