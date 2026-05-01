import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'



// ── Workforce ────────────────────────────────────────────

export function useWorkforceMembers(projectId: string | undefined) {
  return useQuery({
    queryKey: ['workforce_members', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('workforce_members').select('*').eq('project_id', projectId!).order('name')
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useTimeEntries(projectId: string | undefined) {
  return useQuery({
    queryKey: ['time_entries', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.from('time_entries').select('*, workforce_members(name)').eq('project_id', projectId!).order('date', { ascending: false }).limit(100)
      if (error) throw error
      return (data ?? []).map((d: Record<string, unknown>) => ({
        ...d,
        worker_name: (d.workforce_members as { name: string } | null)?.name ?? '',
      }))
    },
    enabled: !!projectId,
  })
}

// ── Mutations ────────────────────────────────────────────

export function useCreateWorkforceMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase.from('workforce_members').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['workforce_members', (vars as Record<string, unknown>).project_id] })
    },
  })
}

export function useDeleteWorkforceMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { id: string; project_id: string }) => {
      const { error } = await supabase.from('workforce_members').delete().eq('id', payload.id)
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['workforce_members', vars.project_id] })
    },
  })
}

export function useCreateTimeEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { data, error } = await supabase.from('time_entries').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['time_entries', (vars as Record<string, unknown>).project_id] })
    },
  })
}

export function useApproveTimeEntry() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { id: string; project_id: string; approved_by: string }) => {
      const { error } = await supabase.from('time_entries').update({ approved: true, approved_by: payload.approved_by }).eq('id', payload.id)
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['time_entries', vars.project_id] })
    },
  })
}
