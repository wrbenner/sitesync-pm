import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'



// ── Meeting Enhancements ─────────────────────────────────

export function useMeetingAgendaItems(meetingId: string | undefined) {
  return useQuery({
    queryKey: ['meeting_agenda_items', meetingId],
    queryFn: async () => {
      const { data, error } = await fromTable('meeting_agenda_items').select('*').eq('meeting_id' as never, meetingId!).order('sort_order')
      if (error) throw error
      return data
    },
    enabled: !!meetingId,
  })
}

export function useMeetingActionItems(meetingId: string | undefined) {
  return useQuery({
    queryKey: ['meeting_action_items', meetingId],
    queryFn: async () => {
      const { data, error } = await fromTable('meeting_action_items').select('*').eq('meeting_id' as never, meetingId!).order('due_date')
      if (error) throw error
      return data
    },
    enabled: !!meetingId,
  })
}

export function useMeetingSeries(projectId: string | undefined) {
  return useQuery({
    queryKey: ['meeting_series', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('meeting_series').select('*').eq('project_id' as never, projectId!).eq('active' as never, true).order('title')
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useOpenActionItems(projectId: string | undefined) {
  return useQuery({
    queryKey: ['open_action_items', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('meeting_action_items').select('*, meetings!inner(project_id)').eq('meetings.project_id' as never, projectId!).eq('status' as never, 'open').order('due_date')
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}

export function useProjectActionItems(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project_action_items', projectId],
    queryFn: async () => {
      const { data, error } = await fromTable('meeting_action_items')
        .select('id, description, assigned_to, due_date, status, meetings!inner(project_id, title)')
        .eq('meetings.project_id' as never, projectId!)
        .order('due_date')
      if (error) throw error
      return data ?? []
    },
    enabled: !!projectId,
  })
}
