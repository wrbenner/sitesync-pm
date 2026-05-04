import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'
import type {
  ProjectSnapshot,
} from '../../types/database'

// ── Project Snapshots ─────────────────────────────────────

export function useProjectSnapshots(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project_snapshots', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('project_snapshots')
        .select('*')
        .eq('project_id' as never, projectId!)
        .order('snapshot_date', { ascending: false })
      if (error) throw error
      return data as ProjectSnapshot[]
    },
    enabled: !!projectId,
  })
}

export function useWeeklyDigests(projectId: string | undefined) {
  return useQuery({
    queryKey: ['weekly_digests', projectId],
    queryFn: async () => {
      // snapshot_type added by migration 00031 but not yet in generated DB types
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const query: any = fromTable('project_snapshots')
        .select('*')
        .eq('project_id' as never, projectId!)
      const { data, error } = await query
        .eq('snapshot_type' as never, 'weekly')
        .order('snapshot_date', { ascending: false })
        .limit(12)
      if (error) throw error
      return (data || []) as ProjectSnapshot[]
    },
    enabled: !!projectId,
  })
}
