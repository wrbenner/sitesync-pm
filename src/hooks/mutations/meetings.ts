import { supabase } from '../../lib/supabase'
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
