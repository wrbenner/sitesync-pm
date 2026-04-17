import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type {
  ProjectSnapshot,
} from '../../types/database'

// ── Project Snapshots ─────────────────────────────────────

export function useProjectSnapshots(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project_snapshots', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_snapshots')
        .select('*')
        .eq('project_id', projectId!)
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
      const query: any = supabase
        .from('project_snapshots')
        .select('*')
        .eq('project_id', projectId!)
      const { data, error } = await query
        .eq('snapshot_type', 'weekly')
        .order('snapshot_date', { ascending: false })
        .limit(12)
      if (error) throw error
      return (data || []) as ProjectSnapshot[]
    },
    enabled: !!projectId,
  })
}
