import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type {
  DailyLog,
  Crew,
} from '../../types/database'

// ── Crews ─────────────────────────────────────────────────

export function useCrews(projectId: string | undefined) {
  return useQuery({
    queryKey: ['crews', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('crews')
        .select('*')
        .eq('project_id', projectId!)
      if (error) throw error
      return data as Crew[]
    },
    enabled: !!projectId,
  })
}

export function useDailyLog(id: string | undefined) {
  return useQuery({
    queryKey: ['daily_logs', 'detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_logs')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as DailyLog
    },
    enabled: !!id,
  })
}
