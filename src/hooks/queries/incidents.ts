import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'



// ── Incidents ────────────────────────────────────────────

export function useIncidents(projectId: string | undefined) {
  return useQuery({
    queryKey: ['incidents', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('incidents')
        .select('*')
        .eq('project_id' as never, projectId!)
        .order('date', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}
