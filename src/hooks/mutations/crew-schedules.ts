import { useMutation, useQueryClient } from '@tanstack/react-query'
import { isSupabaseConfigured } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'

export interface CrewScheduleInput {
  project_id: string
  phase_id?: string | null
  crew_name: string
  start_date: string
  end_date: string
  headcount: number
}

export function useCreateCrewSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CrewScheduleInput) => {
      if (!isSupabaseConfigured) throw new Error('Supabase not configured')
      const { data, error } = await fromTable('crew_schedules')
        .insert({
          project_id: input.project_id,
          phase_id: input.phase_id ?? null,
          crew_name: input.crew_name,
          start_date: input.start_date,
          end_date: input.end_date,
          headcount: input.headcount,
        } as never)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['crew_schedules', vars.project_id] })
    },
  })
}

export function useUpdateCrewSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; project_id: string; patch: Partial<CrewScheduleInput> }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase not configured')
      const { error } = await fromTable('crew_schedules')
        .update(params.patch)
        .eq('id' as never, params.id)
        .eq('project_id' as never, params.project_id)
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['crew_schedules', vars.project_id] })
    },
  })
}

export function useDeleteCrewSchedule() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; project_id: string }) => {
      if (!isSupabaseConfigured) throw new Error('Supabase not configured')
      const { error } = await fromTable('crew_schedules')
        .delete()
        .eq('id' as never, params.id)
        .eq('project_id' as never, params.project_id)
      if (error) throw error
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['crew_schedules', vars.project_id] })
    },
  })
}
