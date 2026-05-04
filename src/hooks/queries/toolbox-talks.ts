import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'



// ── Toolbox Talks ────────────────────────────────────────

export function useToolboxTalks(projectId: string | undefined) {
  return useQuery({
    queryKey: ['toolbox_talks', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('toolbox_talks')
        .select('*')
        .eq('project_id' as never, projectId!)
        .order('date', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}
