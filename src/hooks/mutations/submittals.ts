import { supabase } from '../../lib/supabase'
import { useAuditedMutation } from './createAuditedMutation'
import { submittalSchema,
} from '../../components/forms/schemas'
import { validateSubmittalStatusTransition } from './state-machine-validation-helpers'

import type { Database } from '../../types/database'
type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
const from = (table: AnyTableName) => fromTable(table as keyof Database['public']['Tables'])

// ── Helpers ──────────────────────────────────────────────

/** Columns that actually exist on the submittals table */
const SUBMITTAL_COLUMNS = new Set([
  'title', 'spec_section', 'subcontractor', 'assigned_to', 'status', 'type',
  'description', 'related_rfi_id',
  'due_date', 'required_onsite_date', 'submit_by_date', 'lead_time_weeks',
  'revision_number', 'stamp', 'project_id', 'parent_submittal_id',
  'approved_date', 'submitted_date', 'days_in_review', 'created_by',
  'attachments',
])

/** Columns stored as numeric in Postgres — coerce string input or null out. */
const NUMERIC_COLUMNS = new Set([
  'lead_time_weeks', 'revision_number', 'days_in_review',
])

/** Columns that must reference a valid UUID — drop invalid values so they don't
 *  trigger FK violations and return NULL instead. */
const UUID_COLUMNS = new Set([
  'assigned_to', 'parent_submittal_id', 'created_by',
])
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Strip non-DB fields, coerce numerics, and null out empty/invalid values. */
function sanitizeSubmittalData(data: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(data)) {
    if (!SUBMITTAL_COLUMNS.has(key)) continue
    let v: unknown = value
    if (typeof v === 'string' && v.trim() === '') v = null
    if (NUMERIC_COLUMNS.has(key) && v !== null && v !== undefined) {
      const n = typeof v === 'number' ? v : Number(v)
      v = Number.isFinite(n) ? n : null
    }
    if (UUID_COLUMNS.has(key) && typeof v === 'string' && !UUID_RE.test(v)) {
      v = null
    }
    clean[key] = v
  }
  return clean
}

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
      const insertData = sanitizeSubmittalData(params.data)
      const { data, error } = await from('submittals').insert(insertData as never).select().single()
      if (error) throw error
      return { data, projectId: params.projectId }
    },
    analyticsEvent: 'submittal_created',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to create submittal',
    offlineQueue: {
      table: 'submittals',
      operation: 'insert',
      getData: (p) => ({ ...sanitizeSubmittalData(p.data), project_id: p.projectId }),
      getStubResult: (p) => ({ data: { ...sanitizeSubmittalData(p.data), id: `temp-${Date.now()}` }, projectId: p.projectId }),
    },
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
      const cleanUpdates = sanitizeSubmittalData(updates as Record<string, unknown>)
      const { error } = await from('submittals').update(cleanUpdates as never).eq('id' as never, id).eq('project_id' as never, projectId)
      if (error) throw error

      // Cross-feature trigger: a rejected submittal drafts a follow-up RFI to
      // the architect. Fire-and-forget — the chain is idempotent (skips when
      // an RFI for this submittal already exists) and fail-soft so it can
      // never break the user's primary mutation.
      // Mirrors the same dispatch in submittalService.transitionStatus —
      // some call sites (form Save, bulk edits) flow through this hook
      // instead of the service.
      if (typeof updates.status === 'string' && updates.status === 'rejected') {
        void import('../../lib/crossFeatureWorkflows')
          .then(({ runSubmittalRejectedChain }) => runSubmittalRejectedChain(id))
          .then((result) => {
            if (result.error) console.warn('[submittal_rejected chain]', result.error)
            else if (result.created) console.info('[submittal_rejected chain] created', result.created)
          })
          .catch((err) => console.warn('[submittal_rejected chain] dispatch failed:', err))
      }
      return { projectId, id }
    },
    invalidateKeys: (_, r) => [['submittals', 'detail', r.id]],
    analyticsEvent: 'submittal_updated',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to update submittal',
    offlineQueue: {
      table: 'submittals',
      operation: 'update',
      getData: (p) => ({ id: p.id, ...sanitizeSubmittalData(p.updates) }),
      getStubResult: (p) => ({ id: p.id, projectId: p.projectId }),
    },
  })
}

export function useDeleteSubmittal() {
  return useAuditedMutation<{ id: string; projectId: string }, { projectId: string }>({
    permission: 'submittals.delete',
    action: 'delete_submittal',
    entityType: 'submittal',
    getEntityId: (p) => p.id,
    mutationFn: async ({ id, projectId }) => {
      const { error } = await from('submittals').delete().eq('id' as never, id).eq('project_id' as never, projectId)
      if (error) throw error
      return { projectId }
    },
    analyticsEvent: 'submittal_deleted',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to delete submittal',
    offlineQueue: {
      table: 'submittals',
      operation: 'delete',
      getData: (p) => ({ id: p.id }),
      getStubResult: (p) => ({ projectId: p.projectId }),
    },
  })
}
