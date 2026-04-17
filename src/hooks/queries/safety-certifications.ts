import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'



// ── Safety Certifications ────────────────────────────────

export function useSafetyCertifications(projectId: string | undefined) {
  return useQuery({
    queryKey: ['safety_certifications', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('safety_certifications')
        .select('*')
        .eq('project_id', projectId!)
        .order('expiration_date', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}
