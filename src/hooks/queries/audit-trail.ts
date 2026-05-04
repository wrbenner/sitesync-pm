import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'

// ── Audit Trail ────────────────────────────────────────────

export interface AuditTrailEntry {
  id: string
  project_id: string
  actor_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  entity_title: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export function useAuditTrail(
  projectId: string | undefined,
  filters?: {
    entity_type?: string
    action?: string
    page?: number
    pageSize?: number
  }
) {
  const page = filters?.page ?? 0
  const pageSize = filters?.pageSize ?? 50
  const from = page * pageSize
  const to = from + pageSize - 1

  return useQuery({
    queryKey: ['audit_trail', projectId, filters],
    queryFn: async () => {
      let query = fromTable('audit_trail')
        .select('*', { count: 'exact' })
        .eq('project_id' as never, projectId!)
        .order('created_at', { ascending: false })
        .range(from, to)

      if (filters?.entity_type) {
        query = query.eq('entity_type' as never, filters.entity_type)
      }
      if (filters?.action) {
        query = query.eq('action' as never, filters.action)
      }

      const { data, error, count } = await query
      if (error) throw error
      return { data: data as AuditTrailEntry[], count: count ?? 0 }
    },
    enabled: !!projectId,
  })
}
