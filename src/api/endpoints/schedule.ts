import { supabase, transformSupabaseError } from '../client'
import { validateProjectId } from '../middleware/projectScope'
import type { SchedulePhaseRow } from '../../types/api'

export const getSchedulePhases = async (projectId: string) => {
  validateProjectId(projectId)
  const { data, error } = await supabase.from('schedule_phases').select('*').eq('project_id', projectId).order('start_date')
  if (error) throw transformSupabaseError(error)
  return (data || []).map((p: SchedulePhaseRow) => ({
    ...p,
    startDate: p.start_date || '',
    endDate: p.end_date || '',
    progress: p.percent_complete ?? 0,
    critical: p.is_critical_path || false,
    completed: (p.percent_complete ?? 0) >= 100 || p.status === 'completed',
  }))
}
