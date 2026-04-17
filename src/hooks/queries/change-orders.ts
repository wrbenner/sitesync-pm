import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type {
  ChangeOrder,
} from '../../types/database'

// ── Change Orders ─────────────────────────────────────────

export function useChangeOrders(projectId: string | undefined) {
  return useQuery({
    queryKey: ['change_orders', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('change_orders')
        .select('*')
        .eq('project_id', projectId!)
        .order('co_number', { ascending: false })
      if (error) throw error
      return data as ChangeOrder[]
    },
    enabled: !!projectId,
  })
}

export function useChangeOrder(id: string | undefined) {
  return useQuery({
    queryKey: ['change_orders', 'detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('change_orders')
        .select('*')
        .eq('id', id!)
        .single()
      if (error) throw error
      return data as ChangeOrder
    },
    enabled: !!id,
  })
}
