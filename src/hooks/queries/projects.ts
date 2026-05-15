import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'
import { isDevBypassActive } from '../../lib/devBypass'
import type {
  Project,
} from '../../types/database'

// ── Projects ──────────────────────────────────────────────

export function useProjects() {
  const devBypass = isDevBypassActive()
  return useQuery({
    queryKey: ['projects'],
    queryFn: async (): Promise<Project[]> => {
      // In DEV_BYPASS mode the Supabase URL is a stub that hangs — return
      // an empty list immediately so consumers see data = [] instead of
      // an infinite loading state.
      if (devBypass) return []
      const { data, error } = await fromTable('projects')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Project[]
    },
    retry: devBypass ? false : 3,
    staleTime: devBypass ? Infinity : undefined,
  })
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ['projects', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('projects')
        .select('*')
        .eq('id' as never, projectId!)
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as Project | null
    },
    enabled: !!projectId,
  })
}
