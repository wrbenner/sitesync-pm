import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'



// ── Safety Certifications ────────────────────────────────

export function useSafetyCertifications(projectId: string | undefined) {
  return useQuery({
    queryKey: ['safety_certifications', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('safety_certifications')
        .select('*')
        .eq('project_id' as never, projectId!)
        .order('expiration_date', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}
