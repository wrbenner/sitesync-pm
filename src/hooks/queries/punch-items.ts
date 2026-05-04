import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'
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
      const { data, error, count } = await fromTable('punch_items')
        .select('*', { count: 'exact' })
        .eq('project_id' as never, projectId!)
        .order('number', { ascending: false })
        .range(from, to)
      if (error) throw error
      return { data: (data ?? []) as unknown as PunchItem[], total: count ?? 0, page, pageSize }
    },
    enabled: !!projectId,
  })
}

export function usePunchItem(id: string | undefined) {
  return useQuery({
    queryKey: ['punch_items', 'detail', id],
    queryFn: async () => {
      const { data, error } = await fromTable('punch_items')
        .select('*')
        .eq('id' as never, id!)
        .single()
      if (error) throw error
      return data as unknown as PunchItem
    },
    enabled: !!id,
  })
}
