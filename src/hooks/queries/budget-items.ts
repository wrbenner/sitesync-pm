import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type {
  BudgetItem,
} from '../../types/database'

// ── Budget Items ──────────────────────────────────────────

export function useBudgetItems(projectId: string | undefined) {
  return useQuery({
    queryKey: ['budget_items', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('budget_items')
        .select('*')
        .eq('project_id', projectId!)
        .order('division', { ascending: true })
      if (error) throw error
      return data as BudgetItem[]
    },
    enabled: !!projectId,
  })
}
