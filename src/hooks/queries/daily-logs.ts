import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { PaginationParams, PaginatedResult } from '../../types/api'
import type {
  DailyLog,
} from '../../types/database'

// ── Daily Logs ────────────────────────────────────────────

export function useDailyLogs(projectId: string | undefined, pagination?: PaginationParams) {
  const { page = 1, pageSize = 50 } = pagination ?? {}
  return useQuery({
    queryKey: ['daily_logs', projectId, page, pageSize],
    queryFn: async (): Promise<PaginatedResult<DailyLog>> => {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      const { data, error, count } = await supabase
        .from('daily_logs')
        .select('*', { count: 'exact' })
        .eq('project_id', projectId!)
        .order('date', { ascending: false })
        .range(from, to)
      if (error) throw error
      return { data: (data ?? []) as DailyLog[], total: count ?? 0, page, pageSize }
    },
    enabled: !!projectId,
  })
}
