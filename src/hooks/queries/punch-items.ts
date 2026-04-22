import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { PaginationParams, PaginatedResult } from '../../types/api'
import type {
  PunchItem,
} from '../../types/database'

// ── Punch Items ───────────────────────────────────────────

export function usePunchItems(projectId: string | undefined, pagination?: PaginationParams) {
  const { page = 1, pageSize = 50 } = pagination ?? {}
  return useQuery({
    queryKey: ['punch_items', projectId, page, pageSize],
    queryFn: async (): Promise<PaginatedResult<PunchItem>> => {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      const { data, error, count } = await supabase
        .from('punch_items')
        .select('*', { count: 'exact' })
        .eq('project_id', projectId!)
        .order('number', { ascending: false })
        .range(from, to)
      if (error) throw error
      return { data: (data ?? []) as PunchItem[], total: count ?? 0, page, pageSize }
    },
    enabled: !!projectId,
  })
}

export function usePunchItem(id: string | undefined) {
  return useQuery({
    queryKey: ['punch_items', 'detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('punch_items')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as PunchItem
    },
    enabled: !!id,
  })
}
