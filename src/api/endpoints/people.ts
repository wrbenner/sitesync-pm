import { supabase, transformSupabaseError } from '../client'
import { validateProjectId } from '../middleware/projectScope'
import type { CrewRow, DirectoryContactRow, MeetingRow } from '../../types/api'

export const getCrews = async (projectId: string) => {
  validateProjectId(projectId)
  const { data, error } = await supabase.from('crews').select('*').eq('project_id', projectId)
  if (error) throw transformSupabaseError(error)
  return (data || []).map((c: CrewRow) => ({
    ...c,
    productivity: c.productivity_score ?? 0,
    task: c.current_task || '',
    eta: (c.productivity_score ?? 0) < 75 ? 'Behind schedule' : 'On track',
    location: c.location || '',
  }))
}

export const getDirectory = async (projectId: string) => {
  validateProjectId(projectId)
  const { data, error } = await supabase.from('directory_contacts').select('*').eq('project_id', projectId).order('name')
  if (error) throw transformSupabaseError(error)
  return (data || []).map((d: DirectoryContactRow) => ({
    ...d,
    contactName: d.name,
  }))
}

export const getMeetings = async (projectId: string) => {
  validateProjectId(projectId)
  const { data, error } = await supabase.from('meetings').select('*').eq('project_id', projectId).order('date', { ascending: false })
  if (error) throw transformSupabaseError(error)
  return (data || []).map((m: MeetingRow) => ({
    ...m,
    attendeeCount: 0,
    time: m.date ? new Date(m.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '',
    hasMinutes: !!m.notes,
    status: m.date && new Date(m.date) < new Date() ? 'completed' : 'scheduled',
  }))
}

export const getUpcomingMeetings = async (projectId: string) => {
  validateProjectId(projectId)
  const { data, error } = await supabase.from('meetings').select('*').eq('project_id', projectId).gte('date', new Date().toISOString()).order('date')
  if (error) throw transformSupabaseError(error)
  return data || []
}
