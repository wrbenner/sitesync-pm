import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'



// ── Permits ──────────────────────────────────────────────

export function usePermits(projectId: string | undefined) {
  return useQuery({
    queryKey: ['permits', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('permits').select('*').eq('project_id', projectId!).order('type')
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function usePermitInspections(permitId: string | undefined) {
  return useQuery({
    queryKey: ['permit_inspections', permitId],
    queryFn: async () => {
      const { data, error } = await supabase.from('permit_inspections').select('*').eq('permit_id', permitId!).order('scheduled_date')
      if (error) throw error
      return data
    },
    enabled: !!permitId,
  })
}
