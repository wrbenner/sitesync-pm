import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { PaginationParams, PaginatedResult } from '../../types/api'
import type {
  Task,
  Drawing,
} from '../../types/database'

// ── Drawings ──────────────────────────────────────────────

export function useDrawings(projectId: string | undefined, pagination?: PaginationParams) {
  const { page = 1, pageSize = 50 } = pagination ?? {}
  return useQuery({
    queryKey: ['drawings', projectId, page, pageSize],
    queryFn: async (): Promise<PaginatedResult<Drawing>> => {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      const { data, error, count } = await supabase
        .from('drawings')
        .select('*', { count: 'exact' })
        .eq('project_id', projectId!)
        .order('sheet_number', { ascending: true })
        .range(from, to)
      if (error) throw error
      return { data: (data ?? []) as Drawing[], total: count ?? 0, page, pageSize }
    },
    enabled: !!projectId,
  })
}

export function useDrawingPairs(projectId: string | undefined) {
  return useQuery({
    queryKey: ['drawing_pairs', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drawing_pairs')
        .select('*')
        .eq('project_id', projectId!)
        .order('pairing_confidence', { ascending: false })
      if (error) {
        // Table/columns may not exist — degrade gracefully
        console.warn('[DrawingPairs] Query failed:', error.message);
        return [];
      }
      return data ?? []
    },
    retry: false,
    enabled: !!projectId,
  })
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: ['tasks', 'detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as Task
    },
    enabled: !!id,
  })
}
