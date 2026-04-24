import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'

export interface TimesheetInput {
  project_id: string
  worker_id: string
  work_date: string
  hours: number
  activity?: string
}

export function useCreateTimesheet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: TimesheetInput) => {
      if (!isSupabaseConfigured) throw new Error('Supabase not configured')
      const { data, error } = await supabase
        .from('timesheets')
        .insert({
          project_id: input.project_id,
          worker_id: input.worker_id,
          work_date: input.work_date,
          hours: input.hours,
          activity: input.activity ?? '',
        })
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['timesheets', vars.project_id] })
      qc.invalidateQueries({ queryKey: ['timesheets', 'by_activity', vars.project_id] })
    },
  })
}

export function useUpdateTimesheet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; project_id: string; patch: Partial<TimesheetInput> }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase not configured')
      const { error } = await supabase
        .from('timesheets')
        .update(params.patch)
        .eq('id', params.id)
        .eq('project_id', params.project_id)
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['timesheets', vars.project_id] })
      qc.invalidateQueries({ queryKey: ['timesheets', 'by_activity', vars.project_id] })
    },
  })
}

export function useDeleteTimesheet() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; project_id: string }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase not configured')
      const { error } = await supabase
        .from('timesheets')
        .delete()
        .eq('id', params.id)
        .eq('project_id', params.project_id)
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['timesheets', vars.project_id] })
      qc.invalidateQueries({ queryKey: ['timesheets', 'by_activity', vars.project_id] })
    },
  })
}
