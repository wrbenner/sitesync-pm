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

// ── Daily Log Offline-aware Mutation ──────────────────────
// Wraps createDailyLog with offline queue support. When the device is offline
// the payload is enqueued to syncManager and written optimistically to the
// local Dexie cache. On reconnect the SyncManager drains the queue automatically.

export function useDailyLogMutation(projectId: string) {
  return useOfflineMutation<unknown, { payload: DailyLogPayload }>({
    table: 'daily_logs',
    operation: 'insert',
    mutationFn: ({ payload }) => createDailyLog(projectId, payload),
    invalidateKeys: [['daily_logs', projectId]],
    getOfflinePayload: ({ payload }) => ({ project_id: projectId, ...payload }),
    analyticsEvent: 'daily_log_created',
  })
}

export function useDailyLogUpdateMutation(projectId: string) {
  return useOfflineMutation<unknown, { id: string; payload: Partial<DailyLogPayload> }>({
    table: 'daily_logs',
    operation: 'update',
    mutationFn: ({ id, payload }) => updateDailyLog(id, payload),
    invalidateKeys: [['daily_logs', projectId]],
    getOfflinePayload: ({ id, payload }) => ({ id, project_id: projectId, ...payload }),
    analyticsEvent: 'daily_log_updated',
  })
}
