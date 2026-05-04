import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

import type { WorkingDaysConfig } from '../../services/schedulingEngine'

import { fromTable } from '../../lib/db/queries'

// `as never` collapses the table-name union so strict-generic .insert/.update overloads don't trigger TS2589.
const from = (table: string) => fromTable(table as never)

// ── Non-Working Days ─────────────────────────────────────

export interface NonWorkingDay {
  id: string;
  project_id: string;
  name: string;
  date: string;
  created_at: string;
}

export function useNonWorkingDays(projectId: string | undefined) {
  return useQuery({
    queryKey: ['non_working_days', projectId],
    queryFn: async () => {
      const { data, error } = await from('non_working_days')
        .select('*')
        .eq('project_id' as never, projectId!)
        .order('date', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as NonWorkingDay[]
    },
    enabled: !!projectId,
  })
}

export function useCreateNonWorkingDay() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { project_id: string; name: string; date: string }) => {
      const { data, error } = await from('non_working_days')
        .insert(params as never)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['non_working_days', vars.project_id] })
    },
  })
}

export function useDeleteNonWorkingDay() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; projectId: string }) => {
      const { error } = await from('non_working_days')
        .delete()
        .eq('id' as never, params.id)
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['non_working_days', vars.projectId] })
    },
  })
}

// ── Task Relations ───────────────────────────────────────

export type RelationType = 'follows' | 'precedes' | 'blocks' | 'blocked_by' | 'relates' | 'duplicates'

export interface TaskRelation {
  id: string;
  from_task_id: string;
  to_task_id: string;
  relation_type: RelationType;
  lag_days: number;
  created_at: string;
}

export function useTaskRelations(taskId: string | undefined) {
  return useQuery({
    queryKey: ['task_relations', taskId],
    queryFn: async () => {
      // Get relations where this task is either the source or target
      const [fromResult, toResult] = await Promise.all([
        from('task_relations')
          .select('*')
          .eq('from_task_id' as never, taskId!),
        from('task_relations')
          .select('*')
          .eq('to_task_id' as never, taskId!),
      ])
      if (fromResult.error) throw fromResult.error
      if (toResult.error) throw toResult.error
      return {
        outgoing: (fromResult.data ?? []) as unknown as TaskRelation[],
        incoming: (toResult.data ?? []) as unknown as TaskRelation[],
        all: [...(fromResult.data ?? []), ...(toResult.data ?? [])] as TaskRelation[],
      }
    },
    enabled: !!taskId,
  })
}

export function useCreateTaskRelation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      from_task_id: string;
      to_task_id: string;
      relation_type: RelationType;
      lag_days?: number;
    }) => {
      const { data, error } = await from('task_relations')
        .insert({
          from_task_id: params.from_task_id,
          to_task_id: params.to_task_id,
          relation_type: params.relation_type,
          lag_days: params.lag_days ?? 0,
        } as never)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['task_relations', vars.from_task_id] })
      qc.invalidateQueries({ queryKey: ['task_relations', vars.to_task_id] })
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
  })
}

export function useDeleteTaskRelation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; fromTaskId: string; toTaskId: string }) => {
      const { error } = await from('task_relations')
        .delete()
        .eq('id' as never, params.id)
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['task_relations', vars.fromTaskId] })
      qc.invalidateQueries({ queryKey: ['task_relations', vars.toTaskId] })
    },
  })
}

// ── Working Days Config (composite hook) ─────────────────

/**
 * Combines project-level week settings with non-working days into a
 * WorkingDaysConfig usable by the scheduling engine.
 *
 * Week settings default to Mon–Fri if no project-level override exists.
 */
export function useWorkingDaysConfig(projectId: string | undefined) {
  const { data: nonWorkingDays, isPending: nwdLoading } = useNonWorkingDays(projectId)

  return useQuery({
    queryKey: ['working_days_config', projectId, nonWorkingDays?.length],
    queryFn: async (): Promise<WorkingDaysConfig> => {
      // Try to get project-level week settings
      let workingWeekDays = [false, true, true, true, true, true, false]; // Sun–Sat, Mon–Fri default
      try {
        const { data: project } = await from('projects')
          .select('settings')
          .eq('id' as never, projectId!)
          .single()
        const settings = (project as unknown as Record<string, unknown>)?.settings as unknown as Record<string, unknown> | null
        if (settings?.working_week_days && Array.isArray(settings.working_week_days)) {
          workingWeekDays = settings.working_week_days as boolean[]
        }
      } catch {
        // Use defaults if project settings unavailable
      }

      const holidays = new Set<string>(
        (nonWorkingDays ?? []).map((d) => d.date),
      )

      return { workingWeekDays, nonWorkingDays: holidays }
    },
    enabled: !!projectId && !nwdLoading,
  })
}
