import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
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

      const { data, error } = await supabase
        .from('tasks')
        .select('*, crew:crews(id, name)')
        .eq('project_id', projectId!)
        .gte('start_date', today.toISOString().slice(0, 10))
        .lte('start_date', threeWeeksOut.toISOString().slice(0, 10))
        .in('status', ['todo', 'in_progress'])
        .order('start_date')
      if (error) throw error
      return data as Task[]
    },
    enabled: !!projectId,
  })
}

export function usePayAppSOV(projectId: string | undefined, appNumber: number | null | undefined) {
  return useQuery({
    queryKey: ['pay_app_sov', projectId, appNumber],
    queryFn: () => getPayApplication(projectId!, appNumber!),
    enabled: !!projectId && appNumber != null,
  })
}
