import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'
import type { PaginationParams, PaginatedResult } from '../../types/api'
import type {
  Meeting,
} from '../../types/database'

// ── Meetings ──────────────────────────────────────────────

export function useMeetings(projectId: string | undefined, pagination?: PaginationParams) {
  const { page = 1, pageSize = 50 } = pagination ?? {}
  return useQuery({
    queryKey: ['meetings', projectId, page, pageSize],
    queryFn: async (): Promise<PaginatedResult<Meeting>> => {
      const from = (page - 1) * pageSize
      const to = from + pageSize - 1
      const { data, error, count } = await fromTable('meetings')
        .select('*', { count: 'exact' })
        .eq('project_id' as never, projectId!)
        .order('date', { ascending: false })
        .range(from, to)
      if (error) throw error
      return { data: (data ?? []) as unknown as Meeting[], total: count ?? 0, page, pageSize }
    },
    enabled: !!projectId,
  })
}

// ── Attendees ─────────────────────────────────────────────

export interface MeetingAttendeeRow {
  id: string
  meeting_id: string
  user_id: string | null
  role: string | null
  company: string | null
  attended: boolean | null
  sign_in_time: string | null
  signature_url: string | null
}

export function useMeetingAttendees(meetingId: string | undefined) {
  return useQuery({
    queryKey: ['meeting_attendees', meetingId],
    queryFn: async (): Promise<MeetingAttendeeRow[]> => {
      const { data, error } = await fromTable('meeting_attendees')
        .select('id, meeting_id, user_id, role, company, attended, sign_in_time, signature_url')
        .eq('meeting_id' as never, meetingId!)
      if (error) throw error
      return (data ?? []) as unknown as MeetingAttendeeRow[]
    },
    enabled: !!meetingId,
  })
}

/**
 * Attendee counts for many meetings in one round trip. Used on the list
 * view to render "X attendees" without fetching every attendee row.
 */
export function useMeetingAttendeeCounts(meetingIds: string[]) {
  const key = [...meetingIds].sort().join(',')
  return useQuery({
    queryKey: ['meeting_attendee_counts', key],
    queryFn: async (): Promise<Record<string, number>> => {
      if (meetingIds.length === 0) return {}
      const { data, error } = await fromTable('meeting_attendees')
        .select('meeting_id')
        .in('meeting_id' as never, meetingIds)
      if (error) throw error
      const counts: Record<string, number> = {}
      for (const row of (data ?? []) as Array<{ meeting_id: string }>) {
        counts[row.meeting_id] = (counts[row.meeting_id] ?? 0) + 1
      }
      return counts
    },
    enabled: meetingIds.length > 0,
  })
}

export function useMeeting(id: string | undefined) {
  return useQuery({
    queryKey: ['meetings', 'detail', id],
    queryFn: async () => {
      const [meetingResult, attendeesResult, actionItemsResult] = await Promise.all([
        fromTable('meetings').select('*').eq('id' as never, id!).single(),
        fromTable('meeting_attendees').select('*').eq('meeting_id' as never, id!),
        fromTable('meeting_action_items').select('*').eq('meeting_id' as never, id!).order('created_at'),
      ])
      if (meetingResult.error) throw meetingResult.error
      return {
        ...(meetingResult.data as Meeting),
        attendees: attendeesResult.data || [],
        action_items: actionItemsResult.data || [],
      }
    },
    enabled: !!id,
  })
}
