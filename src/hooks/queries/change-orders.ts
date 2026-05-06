import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'
import type {
  ChangeOrder,
} from '../../types/database'

// ── Change Orders ─────────────────────────────────────────

export function useChangeOrders(projectId: string | undefined) {
  return useQuery({
    queryKey: ['change_orders', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('change_orders')
        .select('*')
        .eq('project_id' as never, projectId!)
        .order('number', { ascending: false })
      if (error) throw error
      return data as unknown as ChangeOrder[]
    },
    enabled: !!projectId,
  })
}

export function useChangeOrder(id: string | undefined) {
  return useQuery({
    queryKey: ['change_orders', 'detail', id],
    queryFn: async () => {
      const { data, error } = await fromTable('change_orders')
        .select('*')
        .eq('id' as never, id!)
        .single()
      if (error) throw error
      return data as unknown as ChangeOrder
    },
    enabled: !!id,
  })
}
