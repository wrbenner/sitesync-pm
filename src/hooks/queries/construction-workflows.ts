import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'



// ── Construction Workflows ───────────────────────────────

export function useCloseoutItems(projectId: string | undefined) {
  return useQuery({
    queryKey: ['closeout_items', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('closeout_items').select('*').eq('project_id', projectId!).order('trade').order('category')
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useWeatherRecords(projectId: string | undefined) {
  return useQuery({
    queryKey: ['weather_records', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('weather_records').select('*').eq('project_id', projectId!).order('date', { ascending: false }).limit(90)
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useWeeklyCommitments(projectId: string | undefined, weekStart?: string) {
  return useQuery({
    queryKey: ['weekly_commitments', projectId, weekStart],
    queryFn: async () => {
      let q = supabase.from('weekly_commitments').select('*').eq('project_id', projectId!).order('created_at')
      if (weekStart) q = q.eq('week_start', weekStart)
      const { data, error } = await q
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}
