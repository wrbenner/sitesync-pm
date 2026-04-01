import { supabase, transformSupabaseError } from '../client'
import { assertProjectAccess } from '../middleware/projectScope'
import type { MappedSchedulePhase } from '../../types/entities'

export const getSchedulePhases = async (projectId: string): Promise<MappedSchedulePhase[]> => {
  await assertProjectAccess(projectId)
  const { data, error } = await supabase.from('schedule_phases').select('*').eq('project_id', projectId).order('start_date')
  if (error) throw transformSupabaseError(error)
  return (data || []).map((raw): MappedSchedulePhase => {
    const baselineEnd = raw.baseline_end ?? null
    const endDate = raw.end_date ?? ''
    const slippageDays = baselineEnd && endDate
      ? Math.ceil((new Date(endDate).getTime() - new Date(baselineEnd).getTime()) / 86400000)
      : 0
    const scheduleVarianceDays = baselineEnd && endDate
      ? Math.ceil((new Date(baselineEnd).getTime() - new Date(endDate).getTime()) / 86400000)
      : 0
    return {
      ...raw,
      // Extended domain fields not yet in DB schema — default null
      baseline_start_date: null,
      baseline_end_date: null,
      baseline_percent_complete: null,
      is_milestone: null,
      predecessor_ids: raw.dependencies ?? null,
      work_type: null,
      location: null,
      assigned_trade: null,
      planned_labor_hours: null,
      actual_labor_hours: null,
      // Camelcase convenience
      startDate: raw.start_date ?? '',
      endDate,
      progress: raw.percent_complete ?? 0,
      critical: raw.is_critical_path ?? false,
      completed: (raw.percent_complete ?? 0) >= 100 || raw.status === 'completed',
      baselineStartDate: raw.baseline_start ?? null,
      baselineEndDate: baselineEnd,
      baselineProgress: 0,
      slippageDays,
      earnedValue: raw.earned_value ?? 0,
      // Computed
      isOnCriticalPath: raw.is_critical_path ?? false,
      floatDays: raw.float_days ?? 0,
      scheduleVarianceDays,
      // New domain camelCase
      isMilestone: false,
      predecessorIds: raw.dependencies ?? [],
      plannedLaborHours: 0,
      actualLaborHours: 0,
    }
  })
}
