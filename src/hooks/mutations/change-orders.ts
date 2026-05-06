import { fromTable, selectScoped } from '../../lib/db/queries'
import { useAuditedMutation } from './createAuditedMutation'
import { changeOrderSchema,
} from '../../components/forms/schemas'
import { validateChangeOrderStatusTransition } from './state-machine-validation-helpers'

// ── Change Orders ─────────────────────────────────────────

export function useCreateChangeOrder() {
  return useAuditedMutation<{ data: Record<string, unknown>; projectId: string }, { data: Record<string, unknown>; projectId: string }>({
    permission: 'change_orders.create',
    schema: changeOrderSchema,
    action: 'create',
    entityType: 'change_order',
    getEntityTitle: (p: { data: Record<string, unknown> }) => (p.data.title as string) || undefined,
    getAfterState: (p: { data: Record<string, unknown> }) => p.data,
    mutationFn: async (params) => {
      const { data, error } = await fromTable('change_orders').insert(params.data as never).select().single()
      if (error) throw error
      return { data: data as unknown as Record<string, unknown>, projectId: params.projectId }
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
      const { error } = await fromTable('change_orders').update(updates as never).eq('id' as never, id).eq('project_id' as never, projectId)
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
      const { data: updated, error: updateError } = await fromTable('change_orders')
        .update({
          type: nextType,
          status: 'draft',
          updated_at: new Date().toISOString(),
        } as never)
        .eq('id' as never, sourceId)
        .eq('project_id' as never, projectId)
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
      const { error } = await fromTable('change_orders').update({
        status: 'pending_review',
        submitted_by: userId,
        submitted_at: new Date().toISOString(),
      } as never).eq('id' as never, id).eq('project_id' as never, projectId)
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
    action: 'approve',
    entityType: 'change_order',
    getEntityId: (p: { id: string }) => p.id,
    getAfterState: (p: { approvedCost?: number }) => ({ status: 'approved', approved_amount: p.approvedCost }),
    mutationFn: async ({ id, userId, comments, approvedCost, projectId }) => {
      // 1. Fetch the CO so we know its amount and cost_code for budget propagation
      const { data: co, error: fetchErr } = await fromTable('change_orders')
        .select('amount, cost_code, approved_amount').eq('id' as never, id).single()
      if (fetchErr) throw fetchErr
      const coRow = co as unknown as { amount: number | null; cost_code: string | null; approved_amount: number | null }

      // Determine the financial impact: explicit approvedCost param > existing approved_amount > amount
      const impactAmount = approvedCost ?? coRow.approved_amount ?? coRow.amount ?? 0

      // 2. Mark the CO as approved
      const updates: Record<string, unknown> = {
        status: 'approved',
        approved_by: userId,
        approved_date: new Date().toISOString().slice(0, 10),
      }
      if (approvedCost !== undefined) updates.approved_amount = approvedCost
      if (comments) updates.approval_comments = comments
      const { error } = await fromTable('change_orders').update(updates as never).eq('id' as never, id).eq('project_id' as never, projectId)
      if (error) throw error

      // 3. Propagate to budget: update the matching budget_items row by cost_code
      if (impactAmount !== 0 && coRow.cost_code) {
        const { data: budgetRow } = await selectScoped('budget_items', projectId, 'id, forecast_amount, original_amount')
          .eq('cost_code' as never, coRow.cost_code)
          .limit(1)
          .single()

        if (budgetRow) {
          const budgetItem = budgetRow as unknown as { id: string; forecast_amount: number | null; original_amount: number | null }
          const currentForecast = budgetItem.forecast_amount ?? budgetItem.original_amount ?? 0
          await fromTable('budget_items')
            .update({
              forecast_amount: currentForecast + impactAmount,
              updated_at: new Date().toISOString(),
            } as never)
            .eq('id' as never, budgetItem.id)
        }
      }

      // 4. Also update budget_line_items.approved_changes if a matching row exists
      if (impactAmount !== 0 && coRow.cost_code) {
        try {
          const { data: lineRow } = await selectScoped('budget_line_items', projectId, 'id, approved_changes, original_amount')
            .eq('csi_code' as never, coRow.cost_code)
            .limit(1)
            .single()

          if (lineRow) {
            const lineItem = lineRow as unknown as { id: string; approved_changes: number | null; original_amount: number | null }
            const prevChanges = lineItem.approved_changes ?? 0
            const origAmt = lineItem.original_amount ?? 0
            const newApproved = prevChanges + impactAmount
            await fromTable('budget_line_items')
              .update({
                approved_changes: newApproved,
                revised_budget: origAmt + newApproved,
                updated_at: new Date().toISOString(),
              } as never)
              .eq('id' as never, lineItem.id)
          }
        } catch {
          // budget_line_items table may not exist — non-fatal
        }
      }

      // 5. Update the project's contract_value by adding this CO's impact.
      // contract_value is a running revised total — each approved CO increments it.
      if (impactAmount !== 0) {
        try {
          const { data: proj } = await fromTable('projects')
            .select('contract_value').eq('id' as never, projectId).single()
          if (proj) {
            const projRow = proj as unknown as { contract_value: number | null }
            const currentValue = projRow.contract_value ?? 0
            await fromTable('projects')
              .update({ contract_value: currentValue + impactAmount } as never)
              .eq('id' as never, projectId)
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
    action: 'reject',
    entityType: 'change_order',
    getEntityId: (p: { id: string }) => p.id,
    getAfterState: (p: { comments: string }) => ({ status: 'rejected', comments: p.comments }),
    mutationFn: async ({ id, userId, comments, projectId }) => {
      const { error } = await fromTable('change_orders').update({
        status: 'rejected',
        rejected_by: userId,
        rejected_at: new Date().toISOString(),
        rejection_comments: comments,
      } as never).eq('id' as never, id).eq('project_id' as never, projectId)
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
    action: 'delete',
    entityType: 'change_order',
    getEntityId: (p: { id: string }) => p.id,
    mutationFn: async ({ id, projectId }) => {
      const { error } = await fromTable('change_orders').delete().eq('id' as never, id).eq('project_id' as never, projectId)
      if (error) throw error
      return { projectId }
    },
    invalidateKeys: () => [['costData']],
    analyticsEvent: 'change_order_deleted',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to delete change order',
  })
}
