import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'



// ── Safety Observations ──────────────────────────────────

export function useSafetyObservations(projectId: string | undefined) {
  return useQuery({
    queryKey: ['safety_observations', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('safety_observations')
        .select('*')
        .eq('project_id', projectId!)
        .order('date', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}
