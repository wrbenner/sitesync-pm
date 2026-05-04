import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'



// ── Safety Inspections ───────────────────────────────────

export function useSafetyInspections(projectId: string | undefined) {
  return useQuery({
    queryKey: ['safety_inspections', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('safety_inspections')
        .select('*')
        .eq('project_id' as never, projectId!)
        .order('date', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}
