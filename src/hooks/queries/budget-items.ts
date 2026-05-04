import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'
import type {
  BudgetItem,
} from '../../types/database'

// ── Budget Items ──────────────────────────────────────────

export function useBudgetItems(projectId: string | undefined) {
  return useQuery({
    queryKey: ['budget_items', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('budget_items')
        .select('*')
        .eq('project_id' as never, projectId!)
        .order('division', { ascending: true })
      if (error) throw error
      return data as BudgetItem[]
    },
    enabled: !!projectId,
  })
}
