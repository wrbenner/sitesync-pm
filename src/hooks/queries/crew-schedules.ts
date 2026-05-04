import { useQuery } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'

export interface CrewScheduleRow {
  id: string
  project_id: string
  phase_id: string | null
  crew_name: string
  start_date: string
  end_date: string
  headcount: number
  created_at: string
  updated_at: string
  phase_name?: string
  phase_progress_pct?: number
}

export function useCrewSchedules(projectId: string | undefined) {
  return useQuery({
    queryKey: ['crew_schedules', projectId],
    queryFn: async (): Promise<CrewScheduleRow[]> => {
      if (!projectId || !isSupabaseConfigured) return []
      const { data, error } = await fromTable('crew_schedules')
        .select('*, schedule_phases(name, percent_complete)')
        .eq('project_id' as never, projectId)
        .order('start_date', { ascending: true })
      if (error) throw error
      return (data ?? []).map((r: Record<string, unknown>) => {
        const phase = r.schedule_phases as { name?: string; percent_complete?: number } | null
        return {
          id: r.id as string,
          project_id: r.project_id as string,
          phase_id: (r.phase_id as string | null) ?? null,
          crew_name: (r.crew_name as string) ?? '',
          start_date: r.start_date as string,
          end_date: r.end_date as string,
          headcount: Number(r.headcount ?? 0),
          created_at: r.created_at as string,
          updated_at: r.updated_at as string,
          phase_name: phase?.name,
          phase_progress_pct: phase?.percent_complete != null ? Number(phase.percent_complete) : undefined,
        }
      })
    },
    enabled: !!projectId && isSupabaseConfigured,
  })
}

export interface SchedulePhaseOption {
  id: string
  name: string
  start_date: string | null
  end_date: string | null
  percent_complete: number
}

export function useSchedulePhasesForAssignment(projectId: string | undefined) {
  return useQuery({
    queryKey: ['schedule_phases', 'for_assignment', projectId],
    queryFn: async (): Promise<SchedulePhaseOption[]> => {
      if (!projectId || !isSupabaseConfigured) return []
      const { data, error } = await fromTable('schedule_phases')
        .select('id, name, start_date, end_date, percent_complete')
        .eq('project_id' as never, projectId)
        .order('start_date', { ascending: true, nullsFirst: false })
      if (error) throw error
      return (data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        name: (r.name as string) ?? '',
        start_date: (r.start_date as string | null) ?? null,
        end_date: (r.end_date as string | null) ?? null,
        percent_complete: Number(r.percent_complete ?? 0),
      }))
    },
    enabled: !!projectId && isSupabaseConfigured,
  })
}
