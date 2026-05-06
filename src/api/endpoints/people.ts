import { supabase, createScopedClient, transformSupabaseError, buildPaginatedQuery } from '../client'
import { assertProjectAccess } from '../middleware/projectScope'
import type { CrewRow, DirectoryContactRow, MeetingRow, PaginationParams, PaginatedResult } from '../../types/api'

export const getCrews = async (projectId: string) => {
  await assertProjectAccess(projectId)
  const scoped = createScopedClient(supabase, projectId)
  const { data, error } = await scoped.from('crews').select('*')
  if (error) throw transformSupabaseError(error)
  const rows = (data || []) as unknown as CrewRow[]
  return rows.map((c) => ({
    ...c,
    productivity: c.productivity_score ?? 0,
    task: c.current_task || '',
    eta: (c.productivity_score ?? 0) < 75 ? 'Behind schedule' : 'On track',
    location: c.location || '',
  }))
}

export const getDirectory = async (
  projectId: string,
  pagination?: PaginationParams,
  search?: string
): Promise<PaginatedResult<DirectoryContactRow & { contactName: string | null; companyGroup: string }>> => {
  await assertProjectAccess(projectId)
  const scoped = createScopedClient(supabase, projectId)
  return buildPaginatedQuery<DirectoryContactRow, DirectoryContactRow & { contactName: string | null; companyGroup: string }>(
    (from, to) => {
      let q = scoped
        .from('directory_contacts')
        .select('*', { count: 'exact' })
      if (search && search.trim()) {
        q = q.or(`name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,company.ilike.%${search}%,trade.ilike.%${search}%`)
      }
      return q
        .order('company', { ascending: true, nullsFirst: false })
        .order('name', { ascending: true })
        .range(from, to) as never
    },
    pagination,
    (d) => ({ ...d, contactName: d.name ?? null, companyGroup: d.company ?? 'Unaffiliated' })
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
        .range(from, to) as never,
    pagination,
    (m) => ({
      ...m,
      attendeeCount: 0,
      time: m.date && !isNaN(new Date(m.date).getTime()) ? new Date(m.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : '',
      hasMinutes: !!m.notes,
      status: m.date && new Date(m.date) < new Date() ? 'completed' : 'scheduled',
    })
  )
}

export const getUpcomingMeetings = async (projectId: string) => {
  await assertProjectAccess(projectId)
  const scoped = createScopedClient(supabase, projectId)
  const { data, error } = await scoped.from('meetings').select('*').gte('date' as never, new Date().toISOString()).order('date')
  if (error) throw transformSupabaseError(error)
  return data || []
}
