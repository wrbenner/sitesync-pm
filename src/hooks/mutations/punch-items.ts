import { supabase } from '../../lib/supabase'
import { useAuditedMutation } from './createAuditedMutation'
import { punchItemSchema,
} from '../../components/forms/schemas'
import { validatePunchItemStatusTransition } from './state-machine-validation-helpers'

import type { Database } from '../../types/database'
type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
const from = (table: AnyTableName) => supabase.from(table as keyof Database['public']['Tables'])

// ── Punch Items ───────────────────────────────────────────

export function useCreatePunchItem() {
  return useAuditedMutation<{ data: Record<string, unknown>; projectId: string }, { data: Record<string, unknown>; projectId: string }>({
    permission: 'punch_list.create',
    schema: punchItemSchema,
    action: 'create_punch_item',
    entityType: 'punch_item',
    getEntityTitle: (p) => (p.data.title as string) || undefined,
    getNewValue: (p) => p.data,
    mutationFn: async (params) => {
      const { data, error } = await from('punch_items').insert(params.data).select().single()
      if (error) throw error
      return { data, projectId: params.projectId }
    },
    analyticsEvent: 'punch_item_created',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to create punch item',
  })
}

export function useUpdatePunchItem() {
  return useAuditedMutation<{ id: string; updates: Record<string, unknown>; projectId: string }, { projectId: string; id: string }>({
    permission: 'punch_list.edit',
    schema: punchItemSchema.partial(),
    schemaKey: 'updates',
    action: 'update_punch_item',
    entityType: 'punch_item',
    getEntityId: (p) => p.id,
    getNewValue: (p) => p.updates,
    mutationFn: async ({ id, updates, projectId }) => {
      if (typeof updates.status === 'string') {
        await validatePunchItemStatusTransition(id, projectId, updates.status)
      }
      const { error } = await from('punch_items').update(updates).eq('id', id)
      if (error) throw error
      return { projectId, id }
    },
    analyticsEvent: 'punch_item_updated',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to update punch item',
  })
}

export function useDeletePunchItem() {
  return useAuditedMutation<{ id: string; projectId: string }, { projectId: string }>({
    permission: 'punch_list.delete',
    action: 'delete_punch_item',
    entityType: 'punch_item',
    getEntityId: (p) => p.id,
    mutationFn: async ({ id, projectId }) => {
      const { error } = await from('punch_items').delete().eq('id', id)
      if (error) throw error
      return { projectId }
    },
    analyticsEvent: 'punch_item_deleted',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to delete punch item',
  })
}
