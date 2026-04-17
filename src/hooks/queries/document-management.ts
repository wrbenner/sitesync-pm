import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'



// ── Document Management ──────────────────────────────────

export function useDrawingMarkups(drawingId: string | undefined) {
  return useQuery({
    queryKey: ['drawing_markups', drawingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('drawing_markups')
        .select('*')
        .eq('drawing_id', drawingId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!drawingId,
  })
}

export function useTransmittals(projectId: string | undefined) {
  return useQuery({
    queryKey: ['transmittals', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transmittals')
        .select('*')
        .eq('project_id', projectId!)
        .order('transmittal_number', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}
