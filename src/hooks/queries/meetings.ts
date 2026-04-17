import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
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
      const { data, error, count } = await supabase
        .from('meetings')
        .select('*', { count: 'exact' })
        .eq('project_id', projectId!)
        .order('date', { ascending: false })
        .range(from, to)
      if (error) throw error
      return { data: (data ?? []) as Meeting[], total: count ?? 0, page, pageSize }
    },
    enabled: !!projectId,
  })
}

export function useMeeting(id: string | undefined) {
  return useQuery({
    queryKey: ['meetings', 'detail', id],
    queryFn: async () => {
      const [meetingResult, attendeesResult, actionItemsResult] = await Promise.all([
        supabase.from('meetings').select('*').eq('id', id!).single(),
        supabase.from('meeting_attendees').select('*').eq('meeting_id', id!),
        supabase.from('meeting_action_items').select('*').eq('meeting_id', id!).order('created_at'),
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
