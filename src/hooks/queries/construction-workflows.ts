import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'



// ── Construction Workflows ───────────────────────────────

export function useCloseoutItems(projectId: string | undefined) {
  return useQuery({
    queryKey: ['closeout_items', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('closeout_items').select('*').eq('project_id' as never, projectId!).order('trade').order('category')
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
      const { data, error } = await fromTable('weather_records').select('*').eq('project_id' as never, projectId!).order('date', { ascending: false }).limit(90)
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
      let q = fromTable('weekly_commitments').select('*').eq('project_id' as never, projectId!).order('created_at')
      if (weekStart) q = q.eq('week_start' as never, weekStart)
      const { data, error } = await q
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}
