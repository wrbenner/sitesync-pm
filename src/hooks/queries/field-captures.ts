import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type {
  FieldCapture,
} from '../../types/database'

// ── Field Captures ────────────────────────────────────────

export function useFieldCaptures(projectId: string | undefined) {
  return useQuery({
    queryKey: ['field_captures', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('field_captures')
        .select('*')
        .eq('project_id', projectId!)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as FieldCapture[]
    },
    enabled: !!projectId,
  })
}
