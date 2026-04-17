import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { PaginationParams, PaginatedResult } from '../../types/api'
import type {
  Task,
} from '../../types/database'

// ── Tasks ─────────────────────────────────────────────────

export function useTasks(projectId: string | undefined, pagination?: PaginationParams) {
  const { page = 1, pageSize = 50 } = pagination ?? {}
  return useQuery({
    queryKey: ['tasks', projectId, page, pageSize],
    queryFn: async (): Promise<PaginatedResult<Task>> => {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      const { data, error, count } = await supabase
        .from('tasks')
        .select('*', { count: 'exact' })
        .eq('project_id', projectId!)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true })
        .range(from, to)
      if (error) throw error
      return { data: (data ?? []) as Task[], total: count ?? 0, page, pageSize }
    },
    enabled: !!projectId,
  })
}
