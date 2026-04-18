import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryKeys } from '../../api/queryKeys'
import type { PaginationParams, PaginatedResult } from '../../types/api'
import type {
  RFI,
  RFIResponse,
} from '../../types/database'

// ── RFIs ──────────────────────────────────────────────────

export function useRFIs(projectId: string | undefined, pagination?: PaginationParams) {
  const { page = 1, pageSize = 50 } = pagination ?? {}
  return useQuery({
    queryKey: queryKeys.rfis.all(projectId!),
    queryFn: async (): Promise<PaginatedResult<RFI>> => {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      const { data, error, count } = await supabase
        .from('rfis')
        .select('*', { count: 'exact' })
        .eq('project_id', projectId!)
        .order('number', { ascending: false })
        .range(from, to)
      if (error) throw error
      return { data: (data ?? []) as RFI[], total: count ?? 0, page, pageSize }
    },
    enabled: !!projectId,
  })
}

export function useRFI(id: string | undefined) {
  return useQuery({
    queryKey: ['rfis', 'detail', id],
    queryFn: async () => {
      const [rfiResult, responsesResult] = await Promise.all([
        supabase.from('rfis').select('*').eq('id', id!).single(),
        supabase
          .from('rfi_responses')
          .select('*')
          .eq('rfi_id', id!)
          .order('created_at', { ascending: true }),
      ])
      if (rfiResult.error) throw rfiResult.error
      if (responsesResult.error) throw responsesResult.error
      return {
        ...(rfiResult.data as RFI),
        responses: responsesResult.data as RFIResponse[],
      }
    },
    enabled: !!id,
  })
}
