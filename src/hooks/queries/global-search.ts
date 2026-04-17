import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'



// ── Global Search ────────────────────────────────────────

export function useGlobalSearch(projectId: string | undefined, query: string) {
  return useQuery({
    queryKey: ['global_search', projectId, query],
    queryFn: async () => {
      if (!query || query.length < 2) return []
      const { data, error } = await supabase.rpc('search_project', {
        p_project_id: projectId!,
        p_query: query,
        p_limit: 20,
      })
      if (error) throw error
      return (data || []) as Array<{
        entity_type: string
        entity_id: string
        title: string
        subtitle: string
        link: string
        rank: number
      }>
    },
    enabled: !!projectId && !!query && query.length >= 2,
    staleTime: 1000 * 30, // 30 seconds
  })
}
