import { supabase } from '../../lib/supabase'
import { useAuditedMutation } from './createAuditedMutation'
import { changeOrderSchema,
} from '../../components/forms/schemas'
import { validateChangeOrderStatusTransition } from './state-machine-validation-helpers'

import type { Database } from '../../types/database'
type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
const from = (table: AnyTableName) => supabase.from(table as keyof Database['public']['Tables'])

// ── Change Orders ─────────────────────────────────────────

export function useCreateChangeOrder() {
  return useAuditedMutation<{ data: Record<string, unknown>; projectId: string }, { data: Record<string, unknown>; projectId: string }>({
    permission: 'change_orders.create',
    schema: changeOrderSchema,
    action: 'create_change_order',
    entityType: 'change_order',
    getEntityTitle: (p) => (p.data.title as string) || undefined,
    getNewValue: (p) => p.data,
    mutationFn: async (params) => {
      const { data, error } = await from('change_orders').insert(params.data).select().single()
      if (error) throw error
      return { data, projectId: params.projectId }
    },
    analyticsEvent: 'change_order_created',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to create change order',
  })
}

export function useUpdateChangeOrder() {
  return useAuditedMutation<{ id: string; updates: Record<string, unknown>; projectId: string }, { projectId: string; id: string }>({
    permission: 'change_orders.edit',
    schema: changeOrderSchema.partial(),
    schemaKey: 'updates',
    action: 'update',
    entityType: 'change_order',
    getEntityId: (p) => p.id,
    getAfterState: (p) => p.updates,
    mutationFn: async ({ id, updates, projectId }) => {
      // State-machine gate: any status change must pass role-aware transition rules.
      if (typeof updates.status === 'string') {
        await validateChangeOrderStatusTransition(id, projectId, updates.status)
      }
      const { error } = await from('change_orders').update(updates).eq('id', id).eq('project_id', projectId)
      if (error) throw error
      return { projectId, id }
    },
    analyticsEvent: 'change_order_updated',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to update change order',
  })
}

export function usePromoteChangeOrder() {
  return useAuditedMutation<{ sourceId: string; projectId: string; nextType: 'cor' | 'co' }, { data: unknown; projectId: string }>({
    permission: 'change_orders.promote',
    action: 'update',
    entityType: 'change_order',
    getEntityId: (p) => p.sourceId,
    getAuditMetadata: (p) => ({ nextType: p.nextType }),
    mutationFn: async ({ sourceId, projectId, nextType }) => {
      // Promote in-place: mutate the original record's type to the next tier.
      // This preserves a single source of truth — no duplicate rows.
      // The promotion chain is PCO → COR → CO. Status resets to 'draft'
      // so the promoted item goes through its own review cycle at the new tier.
      const { data: updated, error: updateError } = await supabase
        .from('change_orders')
        .update({
          type: nextType,
          status: 'draft',
          updated_at: new Date().toISOString(),
        })
        .eq('id', sourceId)
        .eq('project_id', projectId)
        .select()
        .single()
      if (updateError) throw updateError
      return { data: updated, projectId }
    },
    invalidateKeys: (p) => [['costData'], [`costData-${p.projectId}`], ['earned_value', p.projectId]],
    analyticsEvent: 'change_order_promoted',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to promote change order',
  })
}

export function useSubmitChangeOrder() {
  return useAuditedMutation<{ id: string; userId: string; projectId: string }, { projectId: string }>({
    permission: 'change_orders.create',
    action: 'submit',
    entityType: 'change_order',
    getEntityId: (p) => p.id,
    mutationFn: async ({ id, userId, projectId }) => {
      // State-machine gate: only allow draft → pending_review for eligible roles.
      await validateChangeOrderStatusTransition(id, projectId, 'pending_review')
      const { error } = await from('change_orders').update({
        status: 'pending_review',
        submitted_by: userId,
        submitted_at: new Date().toISOString(),
      }).eq('id', id).eq('project_id', projectId)
      if (error) throw error
      return { projectId }
    },
    invalidateKeys: () => [['costData']],
    analyticsEvent: 'change_order_submitted',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to submit change order',
  })
}

export function useApproveChangeOrder() {
  return useAuditedMutation<{ id: string; userId: string; comments?: string; approvedCost?: number; projectId: string }, { projectId: string }>({
    permission: 'change_orders.approve',
    action: 'approve_change_order',
    entityType: 'change_order',
    getEntityId: (p) => p.id,
    getNewValue: (p) => ({ status: 'approved', approved_amount: p.approvedCost }),
    mutationFn: async ({ id, userId, comments, approvedCost, projectId }) => {
      // 1. Fetch the CO so we know its amount and cost_code for budget propagation
      const { data: co, error: fetchErr } = await supabase
        .from('change_orders').select('amount, cost_code, approved_amount').eq('id', id).single()
      if (fetchErr) throw fetchErr

      // Determine the financial impact: explicit approvedCost param > existing approved_amount > amount
      const impactAmount = approvedCost ?? ((co as Record<string, unknown>).approved_amount as number | null) ?? (co.amount as number | null) ?? 0

      // 2. Mark the CO as approved
      const updates: Record<string, unknown> = {
        status: 'approved',
        approved_by: userId,
        approved_date: new Date().toISOString().slice(0, 10),
      }
      if (approvedCost !== undefined) updates.approved_amount = approvedCost
      if (comments) updates.approval_comments = comments
      const { error } = await from('change_orders').update(updates).eq('id', id).eq('project_id', projectId)
      if (error) throw error

      // 3. Propagate to budget: update the matching budget_items row by cost_code
      if (impactAmount !== 0 && co.cost_code) {
        const { data: budgetRow } = await supabase
          .from('budget_items')
          .select('id, forecast_amount, original_amount')
          .eq('project_id', projectId)
          .eq('cost_code', co.cost_code)
          .limit(1)
          .single()

        if (budgetRow) {
          const currentForecast = (budgetRow.forecast_amount as number | null) ?? (budgetRow.original_amount as number | null) ?? 0
          await supabase
            .from('budget_items')
            .update({
              forecast_amount: currentForecast + impactAmount,
              updated_at: new Date().toISOString(),
            })
            .eq('id', budgetRow.id)
        }
      }

      // 4. Also update budget_line_items.approved_changes if a matching row exists
      if (impactAmount !== 0 && co.cost_code) {
        try {
          const { data: lineRow } = await supabase
            .from('budget_line_items')
            .select('id, approved_changes, original_amount')
            .eq('project_id', projectId)
            .eq('csi_code', co.cost_code)
            .limit(1)
            .single()

          if (lineRow) {
            const prevChanges = (lineRow.approved_changes as number | null) ?? 0
            const origAmt = (lineRow.original_amount as number | null) ?? 0
            const newApproved = prevChanges + impactAmount
            await supabase
              .from('budget_line_items')
              .update({
                approved_changes: newApproved,
                revised_budget: origAmt + newApproved,
                updated_at: new Date().toISOString(),
              })
              .eq('id', lineRow.id)
          }
        } catch {
          // budget_line_items table may not exist — non-fatal
        }
      }

      // 5. Update the project's contract_value by adding this CO's impact.
      // contract_value is a running revised total — each approved CO increments it.
      if (impactAmount !== 0) {
        try {
          const { data: proj } = await supabase
            .from('projects').select('contract_value').eq('id', projectId).single()
          if (proj) {
            const currentValue = (proj.contract_value as number | null) ?? 0
            await supabase
              .from('projects')
              .update({ contract_value: currentValue + impactAmount })
              .eq('id', projectId)
          }
        } catch {
          // Non-fatal — contract_value update is best-effort
        }
      }

      return { projectId }
    },
    invalidateKeys: (_, r) => [
      ['costData'],
      [`costData-${r.projectId}`],
      ['earned_value', r.projectId],
      ['projects'],
      ['budget_line_items', r.projectId],
    ],
    analyticsEvent: 'change_order_approved',
    errorMessage: 'Failed to approve change order',
  })
}

export function useRejectChangeOrder() {
  return useAuditedMutation<{ id: string; userId: string; comments: string; projectId: string }, { projectId: string }>({
    permission: 'change_orders.approve',
    action: 'reject_change_order',
    entityType: 'change_order',
    getEntityId: (p) => p.id,
    getNewValue: (p) => ({ status: 'rejected', comments: p.comments }),
    mutationFn: async ({ id, userId, comments, projectId }) => {
      const { error } = await from('change_orders').update({
        status: 'rejected',
        rejected_by: userId,
        rejected_at: new Date().toISOString(),
        rejection_comments: comments,
      }).eq('id', id).eq('project_id', projectId)
      if (error) throw error
      return { projectId }
    },
    invalidateKeys: () => [['costData']],
    analyticsEvent: 'change_order_rejected',
    errorMessage: 'Failed to reject change order',
  })
}

export function useDeleteChangeOrder() {
  return useAuditedMutation<{ id: string; projectId: string }, { projectId: string }>({
    permission: 'change_orders.delete',
    action: 'delete_change_order',
    entityType: 'change_order',
    getEntityId: (p) => p.id,
    mutationFn: async ({ id, projectId }) => {
      const { error } = await from('change_orders').delete().eq('id', id).eq('project_id', projectId)
      if (error) throw error
      return { projectId }
    },
    invalidateKeys: () => [['costData']],
    analyticsEvent: 'change_order_deleted',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to delete change order',
  })
}
