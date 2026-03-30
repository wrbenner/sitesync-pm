import { supabase, transformSupabaseError } from '../client'
const PID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

export const getSchedulePhases = async () => {
  const { data, error } = await supabase.from('schedule_phases').select('*').eq('project_id', PID).order('start_date')
  if (error) throw transformSupabaseError({ message: error.message, code: error.code })
  return (data || []).map((p: any) => ({
    ...p,
    startDate: p.start_date || '',
    endDate: p.end_date || '',
    progress: p.percent_complete ?? 0,
    critical: p.is_critical_path || false,
    completed: (p.percent_complete ?? 0) >= 100 || p.status === 'completed',
  }))
}
