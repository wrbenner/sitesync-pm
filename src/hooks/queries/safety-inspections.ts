import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'



// ── Safety Inspections ───────────────────────────────────

export function useSafetyInspections(projectId: string | undefined) {
  return useQuery({
    queryKey: ['safety_inspections', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('safety_inspections')
        .select('*')
        .eq('project_id', projectId!)
        .order('date', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}
