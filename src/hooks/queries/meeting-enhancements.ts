import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'



// ── Meeting Enhancements ─────────────────────────────────

export function useMeetingAgendaItems(meetingId: string | undefined) {
  return useQuery({
    queryKey: ['meeting_agenda_items', meetingId],
    queryFn: async () => {
      const { data, error } = await supabase.from('meeting_agenda_items').select('*').eq('meeting_id', meetingId!).order('sort_order')
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
      const { data, error } = await supabase.from('meeting_action_items').select('*').eq('meeting_id', meetingId!).order('due_date')
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
      const { data, error } = await supabase.from('meeting_series').select('*').eq('project_id', projectId!).eq('active', true).order('title')
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
      const { data, error } = await supabase.from('meeting_action_items').select('*, meetings!inner(project_id)').eq('meetings.project_id', projectId!).eq('status', 'open').order('due_date')
      if (error) throw error
      return data
    },
    enabled: !!projectId,
  })
}
