import { supabase, transformSupabaseError, buildPaginatedQuery } from '../client'
import { assertProjectAccess } from '../middleware/projectScope'
import type { CrewRow, DirectoryContactRow, MeetingRow, PaginationParams, PaginatedResult } from '../../types/api'

export const getCrews = async (projectId: string) => {
  await assertProjectAccess(projectId)
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

export const getDirectory = async (
  projectId: string,
  pagination?: PaginationParams
): Promise<PaginatedResult<DirectoryContactRow & { contactName: string | null }>> => {
  await assertProjectAccess(projectId)
  return buildPaginatedQuery<DirectoryContactRow, DirectoryContactRow & { contactName: string | null }>(
    (from, to) =>
      supabase
        .from('directory_contacts')
        .select('*', { count: 'exact' })
        .eq('project_id', projectId)
        .order('name')
        .range(from, to),
    pagination,
    (d) => ({ ...d, contactName: d.name })
  )
}

export const getMeetings = async (
  projectId: string,
  pagination?: PaginationParams
): Promise<PaginatedResult<MeetingRow & { attendeeCount: number; time: string; hasMinutes: boolean; status: string }>> => {
  await assertProjectAccess(projectId)
  return buildPaginatedQuery<MeetingRow, MeetingRow & { attendeeCount: number; time: string; hasMinutes: boolean; status: string }>(
    (from, to) =>
      supabase
        .from('meetings')
        .select('*', { count: 'exact' })
        .eq('project_id', projectId)
        .order('date', { ascending: false })
        .range(from, to),
    pagination,
    (m) => ({
      ...m,
      attendeeCount: 0,
      time: m.date ? new Date(m.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '',
      hasMinutes: !!m.notes,
      status: m.date && new Date(m.date) < new Date() ? 'completed' : 'scheduled',
    })
  )
}

export const getUpcomingMeetings = async (projectId: string) => {
  await assertProjectAccess(projectId)
  const { data, error } = await supabase.from('meetings').select('*').eq('project_id', projectId).gte('date', new Date().toISOString()).order('date')
  if (error) throw transformSupabaseError(error)
  return data || []
}
