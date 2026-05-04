import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'



// ── Safety Enhancements ──────────────────────────────────

export function useSafetyInspectionTemplates() {
  return useQuery({
    queryKey: ['safety_inspection_templates'],
    queryFn: async () => {
      const { data, error } = await fromTable('safety_inspection_templates')
        .select('*')
        .order('name')
      if (error) throw error
      return data
    },
  })
}

export function useCorrectiveActions(projectId: string | undefined) {
  return useQuery({
    queryKey: ['corrective_actions', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('corrective_actions')
        .select('*')
        .eq('project_id' as never, projectId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}
