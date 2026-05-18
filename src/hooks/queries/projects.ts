import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'
import type {
  Project,
} from '../../types/database'
import { useAuth } from '../useAuth'

// ── Projects ──────────────────────────────────────────────

// Both hooks below gate on `useAuth().user` so they don't fire on the
// /#/login page or any pre-auth boot path. PostgREST without a JWT returns
// 401, which floods the console with red errors before the user even has
// a session. Every other useQuery in src/hooks/queries gates on `!!user`
// already; these two were the outliers.

export function useProjects() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['projects', user?.id ?? null],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await fromTable('projects')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as Project[]
    },
  })
}

export function useProject(projectId: string | undefined) {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['projects', projectId, user?.id ?? null],
    enabled: !!projectId && !!user,
    queryFn: async () => {
      const { data, error } = await fromTable('projects')
        .select('*')
        .eq('id' as never, projectId!)
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as Project | null
    },
  })
}
