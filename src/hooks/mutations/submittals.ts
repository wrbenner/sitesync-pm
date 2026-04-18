import { supabase } from '../../lib/supabase'
import { useAuditedMutation } from './createAuditedMutation'
import { submittalSchema,
} from '../../components/forms/schemas'
import { validateSubmittalStatusTransition } from './state-machine-validation-helpers'

import type { Database } from '../../types/database'
type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
const from = (table: AnyTableName) => supabase.from(table as keyof Database['public']['Tables'])

// ── Submittals ────────────────────────────────────────────

export function useCreateSubmittal() {
  return useAuditedMutation<{ data: Record<string, unknown>; projectId: string }, { data: Record<string, unknown>; projectId: string }>({
    permission: 'submittals.create',
    schema: submittalSchema,
    action: 'create_submittal',
    entityType: 'submittal',
    getEntityTitle: (p) => (p.data.title as string) || undefined,
    getNewValue: (p) => p.data,
    mutationFn: async (params) => {
      const { data, error } = await from('submittals').insert(params.data).select().single()
      if (error) throw error
      return { data, projectId: params.projectId }
    },
    analyticsEvent: 'submittal_created',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to create submittal',
  })
}

export function useUpdateSubmittal() {
  return useAuditedMutation<{ id: string; updates: Record<string, unknown>; projectId: string }, { projectId: string; id: string }>({
    permission: 'submittals.edit',
    schema: submittalSchema.partial(),
    schemaKey: 'updates',
    action: 'update_submittal',
    entityType: 'submittal',
    getEntityId: (p) => p.id,
    getNewValue: (p) => p.updates,
    mutationFn: async ({ id, updates, projectId }) => {
      // State machine enforcement: validate status transition before persisting
      if (typeof updates.status === 'string') {
        await validateSubmittalStatusTransition(id, projectId, updates.status)
      }
      const { error } = await from('submittals').update(updates).eq('id', id)
      if (error) throw error
      return { projectId, id }
    },
    invalidateKeys: (_, r) => [['submittals', 'detail', r.id]],
    analyticsEvent: 'submittal_updated',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to update submittal',
  })
}

export function useDeleteSubmittal() {
  return useAuditedMutation<{ id: string; projectId: string }, { projectId: string }>({
    permission: 'submittals.delete',
    action: 'delete_submittal',
    entityType: 'submittal',
    getEntityId: (p) => p.id,
    mutationFn: async ({ id, projectId }) => {
      const { error } = await from('submittals').delete().eq('id', id)
      if (error) throw error
      return { projectId }
    },
    analyticsEvent: 'submittal_deleted',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to delete submittal',
  })
}
