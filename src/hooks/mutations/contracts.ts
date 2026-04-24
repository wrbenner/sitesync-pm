import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

type ContractPayload = Record<string, unknown>

export function useCreateContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: ContractPayload) => {
      const { data, error } = await supabase
        .from('contracts')
        .insert(payload)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['contracts', (vars as ContractPayload).project_id] })
    },
  })
}

export function useUpdateContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; projectId: string; updates: ContractPayload }) => {
      const { data, error } = await supabase
        .from('contracts')
        .update(params.updates)
        .eq('id', params.id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['contracts', vars.projectId] })
      qc.invalidateQueries({ queryKey: ['contracts', 'detail', vars.id] })
    },
  })
}

export function useDeleteContract() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; projectId: string }) => {
      const { error } = await supabase.from('contracts').delete().eq('id', params.id)
      if (error) throw error
      return params
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['contracts', vars.projectId] })
    },
  })
}
