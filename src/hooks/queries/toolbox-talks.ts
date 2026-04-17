import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'



// ── Toolbox Talks ────────────────────────────────────────

export function useToolboxTalks(projectId: string | undefined) {
  return useQuery({
    queryKey: ['toolbox_talks', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('toolbox_talks')
        .select('*')
        .eq('project_id', projectId!)
        .order('date', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}
