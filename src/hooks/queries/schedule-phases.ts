import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type {
  SchedulePhase,
} from '../../types/database'

// ── Schedule Phases ───────────────────────────────────────

export function useSchedulePhases(projectId: string | undefined) {
  return useQuery({
    queryKey: ['schedule_phases', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('schedule_phases')
        .select('*')
        .eq('project_id', projectId!)
        .order('start_date', { ascending: true })
      if (error) throw error
      return data as SchedulePhase[]
    },
    enabled: !!projectId,
  })
}
