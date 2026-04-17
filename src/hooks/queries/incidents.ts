import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'



// ── Incidents ────────────────────────────────────────────

export function useIncidents(projectId: string | undefined) {
  return useQuery({
    queryKey: ['incidents', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('incidents')
        .select('*')
        .eq('project_id', projectId!)
        .order('date', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}
