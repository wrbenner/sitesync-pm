import { supabase, createScopedClient, transformSupabaseError, buildPaginatedQuery } from '../client'
import { assertProjectAccess } from '../middleware/projectScope'
import type { CrewRow, DirectoryContactRow, MeetingRow, PaginationParams, PaginatedResult } from '../../types/api'

export const getCrews = async (projectId: string) => {
  await assertProjectAccess(projectId)
  const scoped = createScopedClient(supabase, projectId)
  const { data, error } = await scoped.from('crews').select('*')
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
  const scoped = createScopedClient(supabase, projectId)
  return buildPaginatedQuery<DirectoryContactRow, DirectoryContactRow & { contactName: string | null }>(
    (from, to) =>
      scoped
        .from('directory_contacts')
        .select('*', { count: 'exact' })
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
  const scoped = createScopedClient(supabase, projectId)
  return buildPaginatedQuery<MeetingRow, MeetingRow & { attendeeCount: number; time: string; hasMinutes: boolean; status: string }>(
    (from, to) =>
      scoped
        .from('meetings')
        .select('*', { count: 'exact' })
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
  const scoped = createScopedClient(supabase, projectId)
  const { data, error } = await scoped.from('meetings').select('*').gte('date', new Date().toISOString()).order('date')
  if (error) throw transformSupabaseError(error)
  return data || []
}
