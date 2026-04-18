import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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

export function useCreatePermit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { projectId: string; data: Record<string, unknown> }) => {
      const { data, error } = await supabase
        .from('permits')
        .insert({ ...params.data, project_id: params.projectId })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['permits', vars.projectId] })
    },
  })
}

export function useUpdatePermit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; projectId: string; updates: Record<string, unknown> }) => {
      const { data, error } = await supabase
        .from('permits')
        .update(params.updates)
        .eq('id', params.id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['permits', vars.projectId] })
    },
  })
}

export function useDeletePermit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; projectId: string }) => {
      const { error } = await supabase.from('permits').delete().eq('id', params.id)
      if (error) throw error
      return { id: params.id, projectId: params.projectId }
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['permits', result.projectId] })
    },
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
