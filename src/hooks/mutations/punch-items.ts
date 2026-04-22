import { supabase } from '../../lib/supabase'
import { useAuditedMutation } from './createAuditedMutation'
import { punchItemSchema,
} from '../../components/forms/schemas'
import { validatePunchItemStatusTransition } from './state-machine-validation-helpers'

import type { Database } from '../../types/database'
type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
const from = (table: AnyTableName) => supabase.from(table as keyof Database['public']['Tables'])

// ── Helpers ───────────────────────────────────────────────

/** Columns that actually exist on the punch_items table */
const PUNCH_ITEM_COLUMNS = new Set([
  'title', 'description', 'location', 'floor', 'area', 'assigned_to',
  'priority', 'status', 'trade', 'photos', 'project_id', 'reported_by',
  'due_date', 'verified_date', 'resolved_date', 'number',
  // Extended verification columns (may exist from migrations)
  'verification_status', 'verified_by', 'verified_at', 'sub_completed_at',
  'before_photo_url', 'after_photo_url', 'rejection_reason',
])

/** Strip non-DB fields and convert empty strings to null */
function sanitizePunchData(data: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (!PUNCH_ITEM_COLUMNS.has(key)) continue
    clean[key] = typeof value === 'string' && value.trim() === '' ? null : value
  }
  return clean
}

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
      const insertData = sanitizePunchData(params.data)
      const { data, error } = await from('punch_items').insert(insertData).select().single()
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
      const cleanUpdates = sanitizePunchData(updates as Record<string, unknown>)
      const { error } = await from('punch_items').update(cleanUpdates).eq('id', id).eq('project_id', projectId)
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
      const { error } = await from('punch_items').delete().eq('id', id).eq('project_id', projectId)
      if (error) throw error
      return { projectId }
    },
    analyticsEvent: 'punch_item_deleted',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to delete punch item',
  })
}
