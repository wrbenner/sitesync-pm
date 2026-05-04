import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'
import type {
  DailyLog,
  Crew,
} from '../../types/database'

// ── Crews ─────────────────────────────────────────────────

export function useCrews(projectId: string | undefined) {
  return useQuery({
    queryKey: ['crews', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('crews')
        .select('*')
        .eq('project_id' as never, projectId!)
      if (error) throw error
      return data as unknown as Crew[]
    },
    enabled: !!projectId,
  })
}

export function useDailyLog(id: string | undefined) {
  return useQuery({
    queryKey: ['daily_logs', 'detail', id],
    queryFn: async () => {
      const { data, error } = await fromTable('daily_logs')
        .select('*')
        .eq('id' as never, id!)
        .single()
      if (error) throw error
      return data as unknown as DailyLog
    },
    enabled: !!id,
  })
}
