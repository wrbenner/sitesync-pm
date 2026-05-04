import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'
import type {
  SchedulePhase,
} from '../../types/database'

// ── Schedule Phases ───────────────────────────────────────

export function useSchedulePhases(projectId: string | undefined) {
  return useQuery({
    queryKey: ['schedule_phases', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('schedule_phases')
        .select('*')
        .eq('project_id' as never, projectId!)
        .order('start_date', { ascending: true })
      if (error) throw error
      return data as SchedulePhase[]
    },
    enabled: !!projectId,
  })
}
