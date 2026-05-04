import { fromTable } from '../../lib/db/queries'
import { useAuditedMutation } from './createAuditedMutation'
import { dailyLogDbSchema,
} from '../../components/forms/schemas'

import type { Database } from '../../types/database'
type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
const from = (table: AnyTableName) => fromTable(table as keyof Database['public']['Tables'])

// ── Daily Logs ────────────────────────────────────────────

export function useCreateDailyLog() {
  return useAuditedMutation<{ data: Record<string, unknown>; projectId: string }, { data: Record<string, unknown>; projectId: string }>({
    permission: 'daily_log.create',
    schema: dailyLogDbSchema,
    action: 'create',
    entityType: 'daily_log',
    getEntityTitle: (p) => (p.data.title as string) || undefined,
    getNewValue: (p) => p.data,
    mutationFn: async (params) => {
      const { data, error } = await from('daily_logs').insert(params.data as never).select().single()
      if (error) throw error
      return { data: data as Record<string, unknown>, projectId: params.projectId }
    },
    analyticsEvent: 'daily_log_created',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to create daily log',
  })
}

export function useUpdateDailyLog() {
  return useAuditedMutation<{ id: string; updates: Record<string, unknown>; projectId: string }, { projectId: string; id: string }>({
    permission: 'daily_log.edit',
    schema: dailyLogDbSchema.partial(),
    schemaKey: 'updates',
    action: 'update',
    entityType: 'daily_log',
    getEntityId: (p) => p.id,
    getNewValue: (p) => p.updates,
    mutationFn: async ({ id, updates, projectId }) => {
      const { error } = await from('daily_logs').update(updates as never).eq('id' as never, id).eq('project_id' as never, projectId)
      if (error) throw error
      return { projectId, id }
    },
    invalidateKeys: (_, r) => [['daily_logs', 'detail', r.id]],
    analyticsEvent: 'daily_log_updated',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to update daily log',
  })
}

export function useDeleteDailyLog() {
  return useAuditedMutation<{ id: string; projectId: string }, { projectId: string }>({
    permission: 'daily_log.edit',
    action: 'delete',
    entityType: 'daily_log',
    getEntityId: (p) => p.id,
    mutationFn: async ({ id, projectId }) => {
      const { error } = await from('daily_logs').delete().eq('id' as never, id).eq('project_id' as never, projectId)
      if (error) throw error
      return { projectId }
    },
    analyticsEvent: 'daily_log_deleted',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to delete daily log',
  })
}
