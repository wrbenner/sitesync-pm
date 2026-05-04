import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'



// ── Safety Observations ──────────────────────────────────

export function useSafetyObservations(projectId: string | undefined) {
  return useQuery({
    queryKey: ['safety_observations', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('safety_observations')
        .select('*')
        .eq('project_id' as never, projectId!)
        .order('date', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}
