import { supabase, transformSupabaseError } from '../client'
const PID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

export const getCrews = async () => {
  const { data, error } = await supabase.from('crews').select('*').eq('project_id', PID)
  if (error) throw transformSupabaseError({ message: error.message, code: error.code })
  return (data || []).map((c: any) => ({
    ...c,
    productivity: c.productivity_score ?? 0,
    task: c.current_task || '',
    eta: (c.productivity_score ?? 0) < 75 ? 'Behind schedule' : 'On track',
    location: c.location || '',
  }))
}

export const getDirectory = async () => {
  const { data, error } = await supabase.from('directory_contacts').select('*').eq('project_id', PID).order('name')
  if (error) throw transformSupabaseError({ message: error.message, code: error.code })
  return (data || []).map((d: any) => ({
    ...d,
    contactName: d.name,
  }))
}

export const getMeetings = async () => {
  const { data, error } = await supabase.from('meetings').select('*').eq('project_id', PID).order('date', { ascending: false })
  if (error) throw transformSupabaseError({ message: error.message, code: error.code })
  return (data || []).map((m: any) => ({
    ...m,
    attendeeCount: 0,
    time: m.date ? new Date(m.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '',
    hasMinutes: !!m.notes,
    status: m.date && new Date(m.date) < new Date() ? 'completed' : 'scheduled',
  }))
}

export const getUpcomingMeetings = async () => {
  const { data, error } = await supabase.from('meetings').select('*').eq('project_id', PID).gte('date', new Date().toISOString()).order('date')
  if (error) throw transformSupabaseError({ message: error.message, code: error.code })
  return data || []
}
