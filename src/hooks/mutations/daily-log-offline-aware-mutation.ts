import { useOfflineMutation } from '../useOfflineMutation'
import { createDailyLog, updateDailyLog } from '../../api/endpoints/field'
import type { DailyLogPayload } from '../../types/api'

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
