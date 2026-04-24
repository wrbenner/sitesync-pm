import { supabase } from '../../lib/supabase'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuditedMutation } from './createAuditedMutation'
import { meetingSchema,
} from '../../components/forms/schemas'

import type { Database } from '../../types/database'
type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
const from = (table: AnyTableName) => supabase.from(table as keyof Database['public']['Tables'])

// ── Meetings ──────────────────────────────────────────────

export function useCreateMeeting() {
  return useAuditedMutation<{ data: Record<string, unknown>; projectId: string }, { data: Record<string, unknown>; projectId: string }>({
    permission: 'meetings.create',
    schema: meetingSchema,
    action: 'create_meeting',
    entityType: 'meeting',
    getEntityTitle: (p) => (p.data.title as string) || undefined,
    getNewValue: (p) => p.data,
    mutationFn: async (params) => {
      const { data, error } = await from('meetings').insert(params.data).select().single()
      if (error) throw error
      return { data, projectId: params.projectId }
    },
    analyticsEvent: 'meeting_created',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to create meeting',
  })
}

export function useUpdateMeeting() {
  return useAuditedMutation<{ id: string; updates: Record<string, unknown>; projectId: string }, { projectId: string; id: string }>({
    permission: 'meetings.create',
    schema: meetingSchema.partial(),
    schemaKey: 'updates',
    action: 'update_meeting',
    entityType: 'meeting',
    getEntityId: (p) => p.id,
    getNewValue: (p) => p.updates,
    mutationFn: async ({ id, updates, projectId }) => {
      const { error } = await from('meetings').update(updates).eq('id', id).eq('project_id', projectId)
      if (error) throw error
      return { projectId, id }
    },
    analyticsEvent: 'meeting_updated',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to update meeting',
  })
}

// ── Attendees ─────────────────────────────────────────────

export interface AddAttendeeInput {
  meeting_id: string
  user_id?: string | null
  role?: string | null
  company?: string | null
  attended?: boolean
}

export function useAddAttendee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: AddAttendeeInput) => {
      const payload = {
        meeting_id: input.meeting_id,
        user_id: input.user_id ?? null,
        role: input.role ?? null,
        company: input.company ?? null,
        attended: input.attended ?? false,
      }
      const { data, error } = await from('meeting_attendees').insert(payload).select().single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['meeting_attendees', vars.meeting_id] })
      qc.invalidateQueries({ queryKey: ['meeting_attendee_counts'] })
      toast.success('Attendee added')
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to add attendee'),
  })
}

export function useRemoveAttendee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, meeting_id }: { id: string; meeting_id: string }) => {
      const { error } = await from('meeting_attendees').delete().eq('id', id)
      if (error) throw error
      return { meeting_id }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['meeting_attendees', vars.meeting_id] })
      qc.invalidateQueries({ queryKey: ['meeting_attendee_counts'] })
      toast.success('Attendee removed')
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to remove attendee'),
  })
}

export function useUpdateAttendee() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, meeting_id, updates }: { id: string; meeting_id: string; updates: Partial<Omit<AddAttendeeInput, 'meeting_id'>> }) => {
      const { error } = await from('meeting_attendees').update(updates).eq('id', id)
      if (error) throw error
      return { meeting_id }
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['meeting_attendees', vars.meeting_id] })
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to update attendee'),
  })
}

export function useDeleteMeeting() {
  return useAuditedMutation<{ id: string; projectId: string }, { projectId: string }>({
    permission: 'meetings.delete',
    action: 'delete_meeting',
    entityType: 'meeting',
    getEntityId: (p) => p.id,
    mutationFn: async ({ id, projectId }) => {
      const { error } = await from('meetings').delete().eq('id', id).eq('project_id', projectId)
      if (error) throw error
      return { projectId }
    },
    analyticsEvent: 'meeting_deleted',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to delete meeting',
  })
}
