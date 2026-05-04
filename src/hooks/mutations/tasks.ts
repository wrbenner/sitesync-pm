import { fromTable } from '../../lib/db/queries'

import { useAuditedMutation } from './createAuditedMutation'
import {

  taskSchema,
} from '../../components/forms/schemas'
import { validateTaskStatusTransition } from './state-machine-validation-helpers'

import type { Database } from '../../types/database'
type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
const from = (table: AnyTableName) => fromTable(table as keyof Database['public']['Tables'])

// ── Tasks ─────────────────────────────────────────────────

export function useCreateTask() {
  return useAuditedMutation<{ data: Record<string, unknown>; projectId: string }, { data: Record<string, unknown>; projectId: string }>({
    permission: 'tasks.create',
    schema: taskSchema,
    action: 'create',
    entityType: 'task',
    getEntityTitle: (p) => (p.data.title as string) || undefined,
    getAfterState: (p) => p.data,
    mutationFn: async (params) => {
      const { data, error } = await from('tasks').insert(params.data).select().single()
      if (error) throw error
      return { data: data as unknown as Record<string, unknown>, projectId: params.projectId }
    },
    analyticsEvent: 'task_created',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to create task',
    offlineQueue: {
      table: 'tasks',
      operation: 'insert',
      getData: (p) => ({ ...(p.data as unknown as Record<string, unknown>), project_id: p.projectId }),
      getStubResult: (p) => ({ data: { ...(p.data as unknown as Record<string, unknown>), id: `temp-${Date.now()}` }, projectId: p.projectId }),
    },
  })
}

export function useUpdateTask() {
  return useAuditedMutation<{ id: string; updates: Record<string, unknown>; projectId: string }, { projectId: string; id: string }>({
    permission: 'tasks.edit',
    schema: taskSchema.partial(),
    schemaKey: 'updates',
    action: 'update',
    entityType: 'task',
    getEntityId: (p) => p.id,
    getAfterState: (p) => p.updates,
    mutationFn: async ({ id, updates, projectId }) => {
      if (typeof updates.status === 'string') {
        await validateTaskStatusTransition(id, projectId, updates.status)
      }
      const { error } = await from('tasks').update(updates as never).eq('id' as never, id).eq('project_id' as never, projectId)
      if (error) throw error
      return { projectId, id }
    },
    analyticsEvent: 'task_updated',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to update task',
    offlineQueue: {
      table: 'tasks',
      operation: 'update',
      getData: (p) => ({ id: p.id, ...p.updates }),
      getStubResult: (p) => ({ id: p.id, projectId: p.projectId }),
    },
  })
}

export function useDeleteTask() {
  return useAuditedMutation<{ id: string; projectId: string }, { projectId: string }>({
    permission: 'tasks.delete',
    action: 'delete',
    entityType: 'task',
    getEntityId: (p) => p.id,
    mutationFn: async ({ id, projectId }) => {
      const { error } = await from('tasks').delete().eq('id' as never, id).eq('project_id' as never, projectId)
      if (error) throw error
      return { projectId }
    },
    analyticsEvent: 'task_deleted',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to delete task',
    offlineQueue: {
      table: 'tasks',
      operation: 'delete',
      getData: (p) => ({ id: p.id }),
      getStubResult: (p) => ({ projectId: p.projectId }),
    },
  })
}
