import { supabase, transformSupabaseError } from '../client'
const PID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

export const getDailyLogs = async () => {
  const { data, error } = await supabase.from('daily_logs').select('*').eq('project_id', PID).order('log_date', { ascending: false })
  if (error) throw transformSupabaseError({ message: error.message, code: error.code })
  return (data || []).map((l: any) => ({
    ...l,
    date: l.log_date,
    workers: l.workers_onsite ?? 0,
    manHours: l.total_hours ?? 0,
    incidents: l.incidents ?? 0,
    weather: l.weather || 'N/A',
    summary: l.summary || '',
  }))
}

export const getFieldCaptures = async () => {
  const { data, error } = await supabase.from('field_captures').select('*').eq('project_id', PID).order('created_at', { ascending: false })
  if (error) throw transformSupabaseError({ message: error.message, code: error.code })
  return data || []
}

export const getPunchList = async () => {
  const { data, error } = await supabase.from('punch_items').select('*').eq('project_id', PID).order('number', { ascending: false })
  if (error) throw transformSupabaseError({ message: error.message, code: error.code })
  return (data || []).map((p: any) => ({
    ...p,
    itemNumber: p.number ? `PL-${String(p.number).padStart(3, '0')}` : p.id?.slice(0, 8),
    assigned: p.assigned_to || 'Unassigned',
    hasPhoto: (p.photos && Array.isArray(p.photos) && p.photos.length > 0) || false,
    dueDate: p.due_date || '',
  }))
}
