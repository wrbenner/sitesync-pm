import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'



// ── Document Management ──────────────────────────────────

export function useDrawingMarkups(drawingId: string | undefined) {
  return useQuery({
    queryKey: ['drawing_markups', drawingId],
    queryFn: async () => {
      const { data, error } = await fromTable('drawing_markups')
        .select('*')
        .eq('drawing_id' as never, drawingId!)
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
      const { data, error } = await fromTable('transmittals')
        .select('*')
        .eq('project_id' as never, projectId!)
        .order('transmittal_number', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}
