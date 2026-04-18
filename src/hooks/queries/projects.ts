import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type {
  Project,
} from '../../types/database'

// ── Projects ──────────────────────────────────────────────

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as Project[]
    },
  })
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ['projects', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', projectId!)
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as Project | null
    },
    enabled: !!projectId,
  })
}
