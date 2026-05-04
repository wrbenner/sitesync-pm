import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'
import { useAuditedMutation } from './createAuditedMutation'
import { budgetLineItemSchema } from '../../components/forms/schemas'

import type { Database } from '../../types/database'
type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
const from = (table: AnyTableName) => fromTable(table as keyof Database['public']['Tables'])

// ── Budget line items (budget_line_items table) ──────────
//
// Supersedes the inline fromTable('budget_line_items').insert call that
// used to live in src/pages/Budget.tsx. Moving it into a mutation hook lets
// the audit harness verify create coverage.
//
// NOTE: a separate useUpdateBudgetItem in integrations.ts operates on the
// distinct budget_items table. Do not merge — the two tables have different
// schemas and call sites.

export function useCreateBudgetItem() {
  return useAuditedMutation<{ data: Record<string, unknown>; projectId: string }, { data: Record<string, unknown>; projectId: string }>({
    permission: 'budget.edit',
    schema: budgetLineItemSchema,
    action: 'create',
    entityType: 'budget_line_item',
    getEntityTitle: (p) => (p.data.description as string) || undefined,
    getAfterState: (p) => p.data,
    mutationFn: async (params) => {
      const payload = { ...params.data, project_id: params.projectId }
      const { data, error } = await from('budget_line_items').insert(payload as never).select().single()
      if (error) throw error
      return { data, projectId: params.projectId }
    },
    invalidateKeys: (p) => [
      [`costData-${p.projectId}`],
      ['earned_value', p.projectId],
    ],
    analyticsEvent: 'budget_item_created',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to create budget line item',
  })
}

export function useDeleteBudgetItem() {
  return useAuditedMutation<{ id: string; projectId: string }, { projectId: string }>({
    permission: 'budget.edit',
    action: 'delete',
    entityType: 'budget_line_item',
    getEntityId: (p) => p.id,
    mutationFn: async (params) => {
      const { error } = await from('budget_line_items').delete().eq('id' as never, params.id).eq('project_id' as never, params.projectId)
      if (error) throw error
      return { projectId: params.projectId }
    },
    invalidateKeys: (p) => [[`costData-${p.projectId}`]],
    analyticsEvent: 'budget_item_deleted',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to delete budget line item',
  })
}
