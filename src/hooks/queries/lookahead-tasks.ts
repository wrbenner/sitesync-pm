import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'
import { getPayApplication } from '../../api/endpoints/budget'
import type {
  Task,
} from '../../types/database'

// ── Lookahead Tasks ──────────────────────────────────────

export function useLookaheadTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: ['lookahead_tasks', projectId],
    queryFn: async () => {
      const today = new Date()
      const threeWeeksOut = new Date(today)
      threeWeeksOut.setDate(today.getDate() + 21)

      // Try embedded crew join first; fall back to a plain select if the
      // crews FK isn't configured in this environment (Supabase returns 400).
      const joined = await fromTable('tasks')
        .select('*, crew:crews(id, name)')
        .eq('project_id' as never, projectId!)
        .gte('start_date' as never, today.toISOString().slice(0, 10))
        .lte('start_date' as never, threeWeeksOut.toISOString().slice(0, 10))
        .in('status' as never, ['todo', 'in_progress'])
        .order('start_date')

      if (!joined.error) return joined.data as Task[]

      if (import.meta.env.DEV) console.warn('[LookaheadTasks] crews join unavailable, falling back:', joined.error.message)
      const plain = await fromTable('tasks')
        .select('*')
        .eq('project_id' as never, projectId!)
        .gte('start_date' as never, today.toISOString().slice(0, 10))
        .lte('start_date' as never, threeWeeksOut.toISOString().slice(0, 10))
        .in('status' as never, ['todo', 'in_progress'])
        .order('start_date')
      if (plain.error) throw plain.error
      const tasks = (plain.data ?? []) as Array<Task & { crew_id?: string | null; crew?: { id: string; name: string } | null }>

      // Manual enrichment: fetch crews for the referenced crew_ids so consumers
      // that read task.crew?.name still work even when the FK-join isn't set up.
      const crewIds = Array.from(new Set(tasks.map(t => t.crew_id).filter((v): v is string => !!v)))
      if (crewIds.length > 0) {
        const { data: crewsData } = await fromTable('crews').select('id, name').in('id' as never, crewIds)
        const crewMap = new Map((crewsData ?? []).map(c => [(c as { id: string }).id, c as { id: string; name: string }]))
        for (const t of tasks) {
          if (t.crew_id) t.crew = crewMap.get(t.crew_id) ?? null
        }
      }
      return tasks as Task[]
    },
    enabled: !!projectId,
  })
}

// ── Create Lookahead Task ───────────────────────────────

export interface CreateLookaheadTaskInput {
  project_id: string
  title: string
  crew_id?: string | null
  start_date?: string | null
  end_date?: string | null
  work_type?: string | null
  location?: string | null
  material_delivery_required?: boolean
  inspection_required?: boolean
  constraint_notes?: string | null
  percent_complete?: number
  status?: string
}

export function useCreateLookaheadTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateLookaheadTaskInput) => {
      const { data, error } = await fromTable('tasks')
        .insert({
          project_id: input.project_id,
          title: input.title,
          crew_id: input.crew_id || null,
          start_date: input.start_date || null,
          end_date: input.end_date || null,
          work_type: input.work_type || null,
          location: input.location || null,
          material_delivery_required: input.material_delivery_required ?? false,
          inspection_required: input.inspection_required ?? false,
          constraint_notes: input.constraint_notes || null,
          percent_complete: input.percent_complete ?? 0,
          status: input.status ?? 'todo',
        } as Record<string, unknown>)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['lookahead_tasks', variables.project_id] })
      queryClient.invalidateQueries({ queryKey: ['tasks', variables.project_id] })
    },
  })
}

export function usePayAppSOV(projectId: string | undefined, appNumber: number | null | undefined) {
  return useQuery({
    queryKey: ['pay_app_sov', projectId, appNumber],
    queryFn: () => getPayApplication(projectId!, appNumber!),
    enabled: !!projectId && appNumber != null,
  })
}
