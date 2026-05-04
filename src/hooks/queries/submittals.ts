import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'
import type { PaginationParams, PaginatedResult } from '../../types/api'
import type {
  Submittal,
} from '../../types/database'

// ── Submittals ────────────────────────────────────────────

export function useSubmittals(projectId: string | undefined, pagination?: PaginationParams) {
  const { page = 1, pageSize = 50 } = pagination ?? {}
  return useQuery({
    queryKey: ['submittals', projectId, page, pageSize],
    queryFn: async (): Promise<PaginatedResult<Submittal>> => {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      const { data, error, count } = await fromTable('submittals')
        .select('*', { count: 'exact' })
        .eq('project_id' as never, projectId!)
        .order('number', { ascending: false })
        .range(from, to)
      if (error) throw error
      return { data: (data ?? []) as unknown as Submittal[], total: count ?? 0, page, pageSize }
    },
    enabled: !!projectId,
  })
}

export function useSubmittal(id: string | undefined) {
  return useQuery({
    queryKey: ['submittals', 'detail', id],
    queryFn: async () => {
      const { data, error } = await fromTable('submittals')
        .select('*')
        .eq('id' as never, id!)
        .single()
      if (error) throw error
      return data as unknown as Submittal
    },
    enabled: !!id,
  })
}

export function useSubmittalReviewers(submittalId: string | undefined) {
  return useQuery({
    queryKey: ['submittal_approvals', submittalId],
    queryFn: async () => {
      const { data, error } = await fromTable('submittal_approvals')
        .select('*')
        .eq('submittal_id' as never, submittalId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as Array<{
        id: string
        submittal_id: string
        role: string | null
        status: string | null
        stamp: string | null
        comments: string | null
        approver_id: string | null
      }>
    },
    enabled: !!submittalId,
  })
}
