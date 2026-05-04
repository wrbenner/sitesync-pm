import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'



// ── Task Templates ───────────────────────────────────────

export function useTaskTemplates() {
  return useQuery({
    queryKey: ['task_templates'],
    queryFn: async () => {
      const { data, error } = await fromTable('task_templates')
        .select('*')
        .order('phase', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

export function useTaskCriticalPath(projectId: string | undefined) {
  return useQuery({
    queryKey: ['task_critical_path', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('tasks')
        .select('id, title, start_date, end_date, predecessor_ids, estimated_hours')
        .eq('project_id' as never, projectId!)
        .not('status' as never, 'eq', 'done')
      if (error) throw error

      const { tasksToCPM, calculateCriticalPath } = await import('../../lib/criticalPath')
      const cpmTasks = tasksToCPM((data || []).map((t) => ({
        id: t.id,
        title: t.title,
        start_date: t.start_date,
        end_date: t.end_date,
        predecessor_ids: t.predecessor_ids,
        estimated_hours: t.estimated_hours,
      })))
      return calculateCriticalPath(cpmTasks)
    },
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000, // CPM results are stable for 5 minutes
  })
}

export function useTaskDependencies(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task_dependencies', taskId],
    queryFn: async () => {
      // Get the task's predecessor_ids
      const { data: task, error: taskError } = await fromTable('tasks')
        .select('predecessor_ids, successor_ids')
        .eq('id' as never, taskId!)
        .single()
      if (taskError) throw taskError

      const taskRecord = task as unknown as Record<string, unknown>
      const predecessorIds = (taskRecord.predecessor_ids as string[] | null) || []
      const successorIds = (taskRecord.successor_ids as string[] | null) || []

      let predecessors: Array<{ id: string; title: string; status: string; due_date: string | null }> = []
      let successors: Array<{ id: string; title: string; status: string; due_date: string | null }> = []

      if (predecessorIds.length > 0) {
        const { data } = await fromTable('tasks')
          .select('id, title, status, due_date')
          .in('id' as never, predecessorIds)
        predecessors = data || []
      }

      if (successorIds.length > 0) {
        const { data } = await fromTable('tasks')
          .select('id, title, status, due_date')
          .in('id' as never, successorIds)
        successors = data || []
      }

      return { predecessors, successors }
    },
    enabled: !!taskId,
  })
}
