import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type {
  Project,
} from '../../types/database'

// ── Projects ──────────────────────────────────────────────

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: async ({ signal }) => {
      // Cap each attempt at 5s. Without this, undici's TCP connect timeout is
      // ~7s per attempt, making the skeleton stick for 14+ seconds on bad networks.
      const timeout = AbortSignal.timeout(5_000)
      const combined = AbortSignal.any([signal, timeout])
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })
        .abortSignal(combined)
      if (error) throw error
      return (data ?? []) as Project[]
    },
    retry: 0,
    // Always attempt the fetch regardless of navigator.onLine (relevant in
    // headless / CI environments where onLine may be false or unreliable).
    networkMode: 'always',
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
