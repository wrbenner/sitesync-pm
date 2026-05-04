import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'
import posthog from '../../lib/analytics'
import { createOnError } from './createAuditedMutation'
import { invalidateEntity } from '../../api/invalidation'
import { toast } from 'sonner'
import Sentry from '../../lib/sentry'

// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
// `as never` collapses the table-name union so strict-generic .insert/.update overloads don't trigger TS2589.
const from = (table: string) => fromTable(table as never)

// ── Task Bulk Operations ─────────────────────────────────

export function useBulkUpdateTasks() {
  return useMutation({
    mutationFn: async ({ ids, updates, projectId }: { ids: string[]; updates: Record<string, unknown>; projectId: string }) => {
      const { error } = await from('tasks').update(updates as never).in('id' as never, ids).eq('project_id' as never, projectId)
      if (error) throw error
      return { projectId, count: ids.length }
    },
    onSuccess: (result: { projectId: string; count: number }) => {
      invalidateEntity('task', result.projectId)
      posthog.capture('tasks_bulk_updated', { project_id: result.projectId, count: result.count })
    },
    onError: createOnError('bulk_update_tasks'),
  })
}

export function useBulkDeleteTasks() {
  return useMutation({
    mutationFn: async ({ ids, projectId }: { ids: string[]; projectId: string }) => {
      const { error } = await from('tasks').delete().in('id' as never, ids).eq('project_id' as never, projectId)
      if (error) throw error
      return { projectId, count: ids.length }
    },
    onSuccess: (result: { projectId: string; count: number }) => {
      invalidateEntity('task', result.projectId)
      posthog.capture('tasks_bulk_deleted', { project_id: result.projectId, count: result.count })
    },
    onError: createOnError('bulk_delete_tasks'),
  })
}

export function useReorderTasks() {
  const queryClient = useQueryClient()
  return useMutation({
    // Optimistic: apply reorder instantly in the UI
    onMutate: async ({ updates, projectId }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', projectId] })
      const previousTasks = queryClient.getQueryData(['tasks', projectId])
      queryClient.setQueryData(['tasks', projectId], (old: unknown[]) => {
        if (!Array.isArray(old)) return old
        const orderMap = new Map(updates.map((u) => [u.id, u.sort_order]))
        return old.map((t) => orderMap.has(t.id) ? { ...t, sort_order: orderMap.get(t.id) } : t)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      })
      return { previousTasks }
    },
    mutationFn: async ({ updates, projectId }: { updates: Array<{ id: string; sort_order: number }>; projectId: string }) => {
      // ATOMIC: Use Supabase RPC to update all sort_orders in a single transaction.
      // Falls back to individual updates if RPC not available.
      try {
        const { error } = await supabase.rpc('reorder_tasks', {
          task_ids: updates.map((u) => u.id),
          new_orders: updates.map((u) => u.sort_order),
        })
        if (error) throw error
      } catch {
        // Fallback: individual updates (non-atomic, last resort)
        for (const { id, sort_order } of updates) {
          const { error } = await from('tasks').update({ sort_order } as never).eq('id' as never, id).eq('project_id' as never, projectId)
          if (error) throw error
        }
      }
      return { projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', result.projectId] })
    },
    onError: (_err, { projectId }, context) => {
      // Rollback optimistic update on failure
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks', projectId], context.previousTasks)
      }
      toast.error('Failed to reorder tasks')
      Sentry.captureException(_err, { extra: { mutation: 'reorder_tasks' } })
    },
  })
}

export function useUpdateTaskDependencies() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, predecessorIds, projectId }: { taskId: string; predecessorIds: string[]; projectId: string }) => {
      const { error } = await from('tasks').update({ predecessor_ids: predecessorIds } as never).eq('id' as never, taskId).eq('project_id' as never, projectId)
      if (error) throw error
      return { projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', result.projectId] })
      queryClient.invalidateQueries({ queryKey: ['task_critical_path', result.projectId] })
      posthog.capture('task_dependencies_updated', { project_id: result.projectId })
    },
    onError: createOnError('update_task_dependencies'),
  })
}

export function useApplyTaskTemplate() {
  return useMutation({
    mutationFn: async ({ templateId, projectId }: { templateId: string; projectId: string }) => {
      // task_templates added by migration but not yet in generated DB types
      const { data: template, error: templateError } = await fromTable('task_templates' as never)
        .select('*')
        .eq('id' as never, templateId)
        .single()
      if (templateError) throw templateError

      const tmpl = template as unknown as Record<string, unknown>
      const taskData = (Array.isArray(tmpl.task_data) ? tmpl.task_data : []) as Array<Record<string, unknown>>

      // ATOMIC: Batch insert all tasks in a single operation
      const taskRows = taskData.map((task) => ({
        project_id: projectId,
        title: task.title as string,
        description: (task.description as string) || '',
        status: 'todo',
        priority: (task.priority as string) || 'medium',
        estimated_hours: (task.estimated_hours as number | null) || null,
        phase: tmpl.phase as string,
      }))

      const { data: created, error: insertError } = await from('tasks')
        .insert(taskRows as never)
        .select()
      if (insertError) throw insertError

      // Wire up predecessor relationships in a second pass
      const createdTasks = (created || []) as Array<Record<string, unknown>>
      const idMap = new Map<string, string>()
      taskData.forEach((task, i: number) => {
        if (createdTasks[i]) {
          idMap.set(String(task.id || task.title), String(createdTasks[i].id))
        }
      })

      for (const task of taskData) {
        const preds = task.predecessors as string[] | undefined
        if (preds?.length) {
          const createdId = idMap.get(String(task.id || task.title))
          const predIds = preds.map((p: string) => idMap.get(p)).filter(Boolean)
          if (createdId && predIds.length) {
            await from('tasks').update({ predecessor_ids: predIds } as never).eq('id' as never, createdId)
          }
        }
      }

      return { projectId, count: taskData.length, phase: tmpl.phase as string }
    },
    onSuccess: (result: { projectId: string; count: number; phase: string }) => {
      invalidateEntity('task', result.projectId)
      posthog.capture('task_template_applied', { project_id: result.projectId, count: result.count, phase: result.phase })
    },
    onError: createOnError('apply_task_template'),
  })
}
