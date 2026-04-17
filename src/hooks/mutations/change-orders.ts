import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import posthog from '../../lib/analytics'
import { useAuditedMutation, createOnError } from './createAuditedMutation'
import { invalidateEntity } from '../../api/invalidation'
import { changeOrderSchema,
} from '../../components/forms/schemas'

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
    action: 'update_change_order',
    entityType: 'change_order',
    getEntityId: (p) => p.id,
    getNewValue: (p) => p.updates,
    mutationFn: async ({ id, updates, projectId }) => {
      const { error } = await from('change_orders').update(updates).eq('id', id)
      if (error) throw error
      return { projectId, id }
    },
    analyticsEvent: 'change_order_updated',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to update change order',
  })
}

export function usePromoteChangeOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ sourceId, projectId, nextType }: { sourceId: string; projectId: string; nextType: 'cor' | 'co' }) => {
      // Fetch the source CO
      const { data: source, error: fetchError } = await supabase.from('change_orders').select('*').eq('id', sourceId).single()
      if (fetchError) throw fetchError
      const src = source as Record<string, unknown>
      // Create new CO at the next pipeline stage
      const { data: promoted, error: createError } = await from('change_orders').insert({
        project_id: projectId,
        type: nextType,
        title: src.title || src.description,
        description: src.description,
        amount: src.amount,
        estimated_cost: src.estimated_cost || src.amount,
        submitted_cost: src.submitted_cost || src.amount,
        reason_code: src.reason_code,
        schedule_impact_days: src.schedule_impact_days,
        cost_code: src.cost_code,
        budget_line_item_id: src.budget_line_item_id,
        promoted_from_id: sourceId,
        status: 'draft',
        requested_by: src.requested_by,
      }).select().single()
      if (createError) throw createError
      // Mark source as promoted
      await from('change_orders').update({ promoted_at: new Date().toISOString() }).eq('id', sourceId)
      return { data: promoted, projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      invalidateEntity('change_order', result.projectId)
      queryClient.invalidateQueries({ queryKey: ['costData'] })
      queryClient.invalidateQueries({ queryKey: ['earned_value', result.projectId] })
      posthog.capture('change_order_promoted', { project_id: result.projectId })
    },
    onError: createOnError('promote_change_order'),
  })
}

export function useSubmitChangeOrder() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, userId, projectId }: { id: string; userId: string; projectId: string }) => {
      const { error } = await from('change_orders').update({
        status: 'pending_review',
        submitted_by: userId,
        submitted_at: new Date().toISOString(),
      }).eq('id', id)
      if (error) throw error
      return { projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      invalidateEntity('change_order', result.projectId)
      queryClient.invalidateQueries({ queryKey: ['costData'] })
      posthog.capture('change_order_submitted', { project_id: result.projectId })
    },
    onError: createOnError('submit_change_order'),
  })
}

export function useApproveChangeOrder() {
  return useAuditedMutation<{ id: string; userId: string; comments?: string; approvedCost?: number; projectId: string }, { projectId: string }>({
    permission: 'change_orders.approve',
    action: 'approve_change_order',
    entityType: 'change_order',
    getEntityId: (p) => p.id,
    getNewValue: (p) => ({ status: 'approved', approved_by: p.userId, approved_cost: p.approvedCost }),
    mutationFn: async ({ id, userId, comments, approvedCost, projectId }) => {
      const updates: Record<string, unknown> = {
        status: 'approved', approved_by: userId,
        approved_at: new Date().toISOString(),
        approved_date: new Date().toISOString().slice(0, 10),
      }
      if (comments) updates.approval_comments = comments
      if (approvedCost !== undefined) updates.approved_cost = approvedCost
      const { error } = await from('change_orders').update(updates).eq('id', id)
      if (error) throw error
      return { projectId }
    },
    invalidateKeys: (_, r) => [['costData'], ['earned_value', r.projectId]],
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
    getNewValue: (p) => ({ status: 'rejected', rejected_by: p.userId, comments: p.comments }),
    mutationFn: async ({ id, userId, comments, projectId }) => {
      const { error } = await from('change_orders').update({
        status: 'rejected', rejected_by: userId, rejected_at: new Date().toISOString(), rejection_comments: comments,
      }).eq('id', id)
      if (error) throw error
      return { projectId }
    },
    invalidateKeys: () => [['costData']],
    analyticsEvent: 'change_order_rejected',
    errorMessage: 'Failed to reject change order',
  })
}
