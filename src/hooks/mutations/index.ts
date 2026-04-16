import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import posthog from '../../lib/analytics'
import { useAuditedMutation, createOnError } from './createAuditedMutation'
import { invalidateEntity } from '../../api/invalidation'
import { toast } from 'sonner'
import Sentry from '../../lib/sentry'
import {
  rfiSchema, submittalSchema, punchItemSchema,
  taskSchema, changeOrderSchema, meetingSchema, dailyLogSchema,
} from '../../components/forms/schemas'
import { useOfflineMutation } from '../useOfflineMutation'
import { createDailyLog, updateDailyLog } from '../../api/endpoints/field'
import type { DailyLogPayload } from '../../types/api'
import { getValidTransitions } from '../../machines/rfiMachine'
import { getValidSubmittalStatusTransitions } from '../../machines/submittalMachine'
import type { RfiStatus } from '../../types/database'
import type { SubmittalStatus } from '../../types/submittal'

import type { Database } from '../../types/database'
type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
const from = (table: AnyTableName) => supabase.from(table as keyof Database['public']['Tables'])

// ── State machine validation helpers ─────────────────────

async function resolveUserRole(projectId: string): Promise<string> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (!userId || !projectId) return 'viewer'
    const { data } = await supabase
      .from('project_members')
      .select('role')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .single()
    return (data?.role as string) ?? 'viewer'
  } catch {
    return 'viewer'
  }
}

async function validateRfiStatusTransition(
  rfiId: string,
  projectId: string,
  newStatus: string,
): Promise<void> {
  const { data: rfi } = await supabase
    .from('rfis')
    .select('status')
    .eq('id', rfiId)
    .single()
  if (!rfi) return // Let DB handle missing entity
  const userRole = await resolveUserRole(projectId)
  const validTransitions = getValidTransitions(rfi.status as RfiStatus, userRole)
  // Map from machine action labels to status values
  const rfiActionToStatus: Record<string, string> = {
    'Submit': 'open',
    'Assign for Review': 'under_review',
    'Respond': 'answered',
    'Close': 'closed',
    'Reopen': 'open',
    'Void': 'void',
  }
  const allowedStatuses = validTransitions.map((action) => rfiActionToStatus[action]).filter(Boolean)
  if (!allowedStatuses.includes(newStatus)) {
    throw new Error(
      `Invalid RFI status transition: ${rfi.status} → ${newStatus} (role: ${userRole}). Valid transitions: ${validTransitions.join(', ')}`,
    )
  }
}

async function validateSubmittalStatusTransition(
  submittalId: string,
  projectId: string,
  newStatus: string,
): Promise<void> {
  const { data: submittal } = await supabase
    .from('submittals')
    .select('status')
    .eq('id', submittalId)
    .single()
  if (!submittal) return // Let DB handle missing entity
  const userRole = await resolveUserRole(projectId)
  const validNext = getValidSubmittalStatusTransitions(submittal.status as SubmittalStatus, userRole)
  if (!validNext.includes(newStatus as SubmittalStatus)) {
    throw new Error(
      `Invalid submittal status transition: ${submittal.status} → ${newStatus} (role: ${userRole}). Valid: ${validNext.join(', ')}`,
    )
  }
}

// ── RFIs (Permission-checked + Audited) ──────────────────

export function useCreateRFI() {
  return useAuditedMutation<{ data: Record<string, unknown>; projectId: string }, { data: Record<string, unknown>; projectId: string }>({
    permission: 'rfis.create',
    schema: rfiSchema,
    action: 'create_rfi',
    entityType: 'rfi',
    getEntityTitle: (p) => (p.data.title as string) || undefined,
    getNewValue: (p) => p.data,
    mutationFn: async (params) => {
      const { data, error } = await from('rfis').insert(params.data).select().single()
      if (error) throw error
      return { data, projectId: params.projectId }
    },
    optimistic: {
      queryKey: (p) => ['rfis', p.projectId],
      updater: (old: unknown, p) => {
        const prev = old as { data?: unknown[]; total?: number } | undefined
        return {
          ...prev,
          data: [...(prev?.data ?? []), { ...p.data, id: `temp-${Date.now()}` }],
          total: (prev?.total ?? 0) + 1,
        }
      },
    },
    analyticsEvent: 'rfi_created',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to create RFI',
  })
}

export function useUpdateRFI() {
  return useAuditedMutation<{ id: string; updates: Record<string, unknown>; projectId: string }, { projectId: string; id: string }>({
    permission: 'rfis.edit',
    schema: rfiSchema.partial(),
    schemaKey: 'updates',
    action: 'update_rfi',
    entityType: 'rfi',
    getEntityId: (p) => p.id,
    getNewValue: (p) => p.updates,
    mutationFn: async ({ id, updates, projectId }) => {
      // State machine enforcement: validate status transition before persisting
      if (typeof updates.status === 'string') {
        await validateRfiStatusTransition(id, projectId, updates.status)
      }
      const { error } = await from('rfis').update(updates).eq('id', id)
      if (error) throw error
      return { projectId, id }
    },
    optimistic: {
      queryKey: (p) => ['rfis', p.projectId],
      updater: (old: unknown, p) => {
        const prev = old as { data?: unknown[] } | undefined
        return {
          ...prev,
          data: (prev?.data ?? []).map((rfi: unknown) => {
            const r = rfi as Record<string, unknown>
            return r.id === p.id ? { ...r, ...p.updates } : r
          }),
        }
      },
    },
    analyticsEvent: 'rfi_updated',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to update RFI',
  })
}

export function useDeleteRFI() {
  return useAuditedMutation<{ id: string; projectId: string }, { projectId: string }>({
    permission: 'rfis.edit',
    action: 'delete_rfi',
    entityType: 'rfi',
    getEntityId: (p) => p.id,
    mutationFn: async ({ id, projectId }) => {
      const { error } = await from('rfis').delete().eq('id', id)
      if (error) throw error
      return { projectId }
    },
    analyticsEvent: 'rfi_deleted',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to delete RFI',
  })
}

export function useCreateRFIResponse() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { data: Record<string, unknown>; rfiId: string; projectId: string }) => {
      const { data, error } = await from('rfi_responses').insert(params.data).select().single()
      if (error) throw error
      return { data, rfiId: params.rfiId, projectId: params.projectId }
    },
    onSuccess: (result: { rfiId: string; projectId: string }) => {
      invalidateEntity('rfi', result.projectId)
      queryClient.invalidateQueries({ queryKey: ['rfis', 'detail', result.rfiId] })
      queryClient.invalidateQueries({ queryKey: ['rfi_responses', result.rfiId] })
      posthog.capture('rfi_response_created', { rfi_id: result.rfiId })
    },
    onError: createOnError('create_rfi_response'),
  })
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
      const { error } = await from('punch_items').update(updates).eq('id', id)
      if (error) throw error
      return { projectId, id }
    },
    analyticsEvent: 'punch_item_updated',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to update punch item',
  })
}

// ── Tasks ─────────────────────────────────────────────────

export function useCreateTask() {
  return useAuditedMutation<{ data: Record<string, unknown>; projectId: string }, { data: Record<string, unknown>; projectId: string }>({
    permission: 'tasks.create',
    schema: taskSchema,
    action: 'create_task',
    entityType: 'task',
    getEntityTitle: (p) => (p.data.title as string) || undefined,
    getNewValue: (p) => p.data,
    mutationFn: async (params) => {
      const { data, error } = await from('tasks').insert(params.data).select().single()
      if (error) throw error
      return { data, projectId: params.projectId }
    },
    analyticsEvent: 'task_created',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to create task',
  })
}

export function useUpdateTask() {
  return useAuditedMutation<{ id: string; updates: Record<string, unknown>; projectId: string }, { projectId: string; id: string }>({
    permission: 'tasks.edit',
    schema: taskSchema.partial(),
    schemaKey: 'updates',
    action: 'update_task',
    entityType: 'task',
    getEntityId: (p) => p.id,
    getNewValue: (p) => p.updates,
    mutationFn: async ({ id, updates, projectId }) => {
      const { error } = await from('tasks').update(updates).eq('id', id)
      if (error) throw error
      return { projectId, id }
    },
    analyticsEvent: 'task_updated',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to update task',
  })
}

export function useDeleteTask() {
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await from('tasks').delete().eq('id', id)
      if (error) throw error
      return { projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      invalidateEntity('task', result.projectId)
      posthog.capture('task_deleted', { project_id: result.projectId })
    },
    onError: createOnError('delete_task'),
  })
}

// ── Daily Logs ────────────────────────────────────────────

export function useCreateDailyLog() {
  return useAuditedMutation<{ data: Record<string, unknown>; projectId: string }, { data: Record<string, unknown>; projectId: string }>({
    permission: 'daily_log.create',
    schema: dailyLogSchema,
    action: 'create_daily_log',
    entityType: 'daily_log',
    getEntityTitle: (p) => (p.data.title as string) || undefined,
    getNewValue: (p) => p.data,
    mutationFn: async (params) => {
      const { data, error } = await from('daily_logs').insert(params.data).select().single()
      if (error) throw error
      return { data, projectId: params.projectId }
    },
    analyticsEvent: 'daily_log_created',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to create daily log',
  })
}

export function useUpdateDailyLog() {
  return useAuditedMutation<{ id: string; updates: Record<string, unknown>; projectId: string }, { projectId: string; id: string }>({
    permission: 'daily_log.edit',
    schema: dailyLogSchema.partial(),
    schemaKey: 'updates',
    action: 'update_daily_log',
    entityType: 'daily_log',
    getEntityId: (p) => p.id,
    getNewValue: (p) => p.updates,
    mutationFn: async ({ id, updates, projectId }) => {
      const { error } = await from('daily_logs').update(updates).eq('id', id)
      if (error) throw error
      return { projectId, id }
    },
    invalidateKeys: (_, r) => [['daily_logs', 'detail', r.id]],
    analyticsEvent: 'daily_log_updated',
    getAnalyticsProps: (p) => ({ project_id: p.projectId }),
    errorMessage: 'Failed to update daily log',
  })
}

// ── Daily Log Entries ─────────────────────────────────────

export function useCreateDailyLogEntry() {

  return useMutation({
    mutationFn: async (params: { data: Record<string, unknown>; projectId: string }) => {
      const { data, error } = await from('daily_log_entries').insert(params.data).select().single()
      if (error) throw error
      return { data, projectId: params.projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      invalidateEntity('daily_log', result.projectId)
      posthog.capture('daily_log_entry_created', { project_id: result.projectId })
    },
    onError: createOnError('create_daily_log_entry'),
  })
}

export function useSubmitDailyLog() {
  const queryClient = useQueryClient()
  return useMutation({
    onMutate: async ({ id, projectId }: { id: string; signatureUrl?: string; projectId: string }) => {
      const key = ['daily_logs', projectId]
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData(key)
      queryClient.setQueryData(key, (old: unknown) => {
        const prev = old as { data?: unknown[] } | undefined
        return {
          ...prev,
          data: (prev?.data ?? []).map((log: unknown) => {
            const l = log as Record<string, unknown>
            return l.id === id ? { ...l, status: 'submitted', is_submitted: true } : l
          }),
        }
      })
      return { previous, key }
    },
    mutationFn: async ({ id, signatureUrl, projectId }: { id: string; signatureUrl?: string; projectId: string }) => {
      const updates: Record<string, unknown> = { status: 'submitted', submitted_at: new Date().toISOString() }
      if (signatureUrl) updates.superintendent_signature_url = signatureUrl
      const { error } = await from('daily_logs').update(updates).eq('id', id)
      if (error) throw error
      return { projectId }
    },
    onError: (_err, _params, context) => {
      const ctx = context as { previous: unknown; key: unknown[] } | undefined
      if (ctx?.previous !== undefined) {
        queryClient.setQueryData(ctx.key, ctx.previous)
      }
      toast.error('Failed to submit daily log')
      Sentry.captureException(_err, { extra: { mutation: 'submit_daily_log' } })
    },
    onSuccess: (result: { projectId: string }) => {
      invalidateEntity('daily_log', result.projectId)
      posthog.capture('daily_log_submitted', { project_id: result.projectId })
    },
  })
}

export function useApproveDailyLog() {
  return useAuditedMutation<{ id: string; signatureUrl?: string; userId: string; projectId: string }, { projectId: string }>({
    permission: 'daily_log.approve',
    action: 'approve_daily_log',
    entityType: 'daily_log',
    getEntityId: (p) => p.id,
    getNewValue: (p) => ({ status: 'approved', approved_by: p.userId }),
    mutationFn: async ({ id, signatureUrl, userId, projectId }) => {
      const updates: Record<string, unknown> = {
        status: 'approved', approved: true, approved_at: new Date().toISOString(), approved_by: userId,
      }
      if (signatureUrl) updates.manager_signature_url = signatureUrl
      const { error } = await from('daily_logs').update(updates).eq('id', id)
      if (error) throw error
      return { projectId }
    },
    invalidateKeys: (p) => [['daily_logs', 'detail', p.id]],
    analyticsEvent: 'daily_log_approved',
    errorMessage: 'Failed to approve daily log',
  })
}

export function useRejectDailyLog() {
  return useAuditedMutation<{ id: string; comments: string; userId: string; projectId: string }, { projectId: string }>({
    permission: 'daily_log.approve',
    action: 'reject_daily_log',
    entityType: 'daily_log',
    getEntityId: (p) => p.id,
    getNewValue: (p) => ({ status: 'rejected', comments: p.comments, rejected_by: p.userId }),
    mutationFn: async ({ id, comments, userId, projectId }) => {
      // FIX: Add rejected_at and rejected_by (were missing)
      const { error } = await from('daily_logs').update({
        status: 'rejected',
        rejection_comments: comments,
        approved: false,
        rejected_at: new Date().toISOString(),
        rejected_by: userId,
      }).eq('id', id)
      if (error) throw error
      return { projectId }
    },
    invalidateKeys: (p) => [['daily_logs', 'detail', p.id]],
    analyticsEvent: 'daily_log_rejected',
    errorMessage: 'Failed to reject daily log',
  })
}

// ── Daily Log Offline-aware Mutation ──────────────────────
// Wraps createDailyLog with offline queue support. When the device is offline
// the payload is enqueued to syncManager and written optimistically to the
// local Dexie cache. On reconnect the SyncManager drains the queue automatically.

export function useDailyLogMutation(projectId: string) {
  return useOfflineMutation<unknown, { payload: DailyLogPayload }>({
    table: 'daily_logs',
    operation: 'insert',
    mutationFn: ({ payload }) => createDailyLog(projectId, payload),
    invalidateKeys: [['daily_logs', projectId]],
    getOfflinePayload: ({ payload }) => ({ project_id: projectId, ...payload }),
    analyticsEvent: 'daily_log_created',
  })
}

export function useDailyLogUpdateMutation(projectId: string) {
  return useOfflineMutation<unknown, { id: string; payload: Partial<DailyLogPayload> }>({
    table: 'daily_logs',
    operation: 'update',
    mutationFn: ({ id, payload }) => updateDailyLog(id, payload),
    invalidateKeys: [['daily_logs', projectId]],
    getOfflinePayload: ({ id, payload }) => ({ id, project_id: projectId, ...payload }),
    analyticsEvent: 'daily_log_updated',
  })
}

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

// ── Files ─────────────────────────────────────────────────

export function useCreateFile() {
  return useMutation({
    mutationFn: async (params: { data: Record<string, unknown>; projectId: string }) => {
      const { data, error } = await from('files').insert(params.data).select().single()
      if (error) throw error
      return { data, projectId: params.projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      invalidateEntity('file', result.projectId)
      posthog.capture('file_uploaded', { project_id: result.projectId })
    },
    onError: createOnError('upload_file'),
  })
}

export function useDeleteFile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await from('files').delete().eq('id', id)
      if (error) throw error
      return { projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      // exact:false catches ['files', projectId, folder] for all folder variations
      queryClient.invalidateQueries({ queryKey: ['files', result.projectId], exact: false })
      posthog.capture('file_deleted', { project_id: result.projectId })
    },
    onError: createOnError('delete_file'),
  })
}

// ── Field Captures ────────────────────────────────────────

export function useCreateFieldCapture() {
  return useMutation({
    mutationFn: async (params: { data: Record<string, unknown>; projectId: string }) => {
      const { data, error } = await from('field_captures').insert(params.data).select().single()
      if (error) throw error
      return { data, projectId: params.projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      invalidateEntity('field_capture', result.projectId)
      posthog.capture('field_capture_created', { project_id: result.projectId })
    },
    onError: createOnError('create_field_capture'),
  })
}

// ── Directory Contacts ────────────────────────────────────

export function useCreateDirectoryContact() {
  return useMutation({
    mutationFn: async (params: { data: Record<string, unknown>; projectId: string }) => {
      const { data, error } = await from('directory_contacts').insert(params.data).select().single()
      if (error) throw error
      return { data, projectId: params.projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      invalidateEntity('contact', result.projectId)
      posthog.capture('directory_contact_created', { project_id: result.projectId })
    },
    onError: createOnError('create_directory_contact'),
  })
}

// ── Crews ─────────────────────────────────────────────────

export function useCreateCrew() {
  return useMutation({
    mutationFn: async (params: { data: Record<string, unknown>; projectId: string }) => {
      const { data, error } = await from('crews').insert(params.data).select().single()
      if (error) throw error
      return { data, projectId: params.projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      invalidateEntity('crew', result.projectId)
      posthog.capture('crew_created', { project_id: result.projectId })
    },
    onError: createOnError('create_crew'),
  })
}

// ── Notifications ─────────────────────────────────────────

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, userId }: { id: string; userId: string }) => {
      const { error } = await from('notifications').update({ read: true }).eq('id', id)
      if (error) throw error
      return { userId }
    },
    onSuccess: (result: { userId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['notifications', result.userId] })
      posthog.capture('notification_read', { user_id: result.userId })
    },
    onError: createOnError('mark_notification_read'),
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false)
      if (error) throw error
      return { userId }
    },
    onSuccess: (result: { userId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['notifications', result.userId] })
      posthog.capture('all_notifications_read', { user_id: result.userId })
    },
    onError: createOnError('mark_all_notifications_read'),
  })
}

// ── Activity Feed ─────────────────────────────────────────

export function useCreateActivityFeedItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { data: Record<string, unknown>; projectId: string }) => {
      const { data, error } = await from('activity_feed').insert(params.data).select().single()
      if (error) throw error
      return { data, projectId: params.projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['activity_feed', result.projectId] })
      posthog.capture('activity_created', { project_id: result.projectId })
    },
    onError: createOnError('create_activity_feed_item'),
  })
}

// ── Safety ───────────────────────────────────────────────

export function useCreateCorrectiveAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { data: Record<string, unknown>; projectId: string }) => {
      const { data, error } = await from('corrective_actions').insert(params.data).select().single()
      if (error) throw error
      return { data, projectId: params.projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['corrective_actions', result.projectId] })
      queryClient.invalidateQueries({ queryKey: ['safety_overview', result.projectId] }) // FIX #7: cross-invalidate
      queryClient.invalidateQueries({ queryKey: ['project_snapshots', result.projectId] })
      posthog.capture('corrective_action_created', { project_id: result.projectId })
    },
    onError: createOnError('create_corrective_action'),
  })
}

export function useUpdateCorrectiveAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates, projectId }: { id: string; updates: Record<string, unknown>; projectId: string }) => {
      const { error } = await from('corrective_actions').update(updates).eq('id', id)
      if (error) throw error
      return { projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['corrective_actions', result.projectId] })
      posthog.capture('corrective_action_updated', { project_id: result.projectId })
    },
    onError: createOnError('update_corrective_action'),
  })
}

export function useCreateSafetyInspection() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { data: Record<string, unknown>; projectId: string }) => {
      const { data, error } = await from('safety_inspections').insert(params.data).select().single()
      if (error) throw error
      return { data, projectId: params.projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['safety_inspections', result.projectId] })
      queryClient.invalidateQueries({ queryKey: ['safety_overview', result.projectId] }) // FIX #7
      queryClient.invalidateQueries({ queryKey: ['corrective_actions', result.projectId] })
      posthog.capture('safety_inspection_created', { project_id: result.projectId })
    },
    onError: createOnError('create_safety_inspection'),
  })
}

export function useCreateIncident() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { data: Record<string, unknown>; projectId: string }) => {
      const { data, error } = await from('incidents').insert(params.data).select().single()
      if (error) throw error
      return { data, projectId: params.projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['incidents', result.projectId] })
      queryClient.invalidateQueries({ queryKey: ['safety_overview', result.projectId] }) // FIX #7
      queryClient.invalidateQueries({ queryKey: ['daily_logs', result.projectId] }) // Incidents affect daily logs
      queryClient.invalidateQueries({ queryKey: ['project_snapshots', result.projectId] })
      posthog.capture('incident_reported', { project_id: result.projectId })
    },
    onError: createOnError('create_incident'),
  })
}

// ── Documents ────────────────────────────────────────────

export function useCreateDrawingMarkup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { data: Record<string, unknown>; drawingId: string }) => {
      const { data, error } = await from('drawing_markups').insert(params.data).select().single()
      if (error) throw error
      return { data, drawingId: params.drawingId }
    },
    onSuccess: (result: { drawingId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['drawing_markups', result.drawingId] })
      posthog.capture('drawing_markup_created', { drawing_id: result.drawingId })
    },
    onError: createOnError('create_drawing_markup'),
  })
}

export function useCreateTransmittal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { data: Record<string, unknown>; projectId: string }) => {
      const { data, error } = await from('transmittals').insert(params.data).select().single()
      if (error) throw error
      return { data, projectId: params.projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['transmittals', result.projectId] })
      posthog.capture('transmittal_created', { project_id: result.projectId })
    },
    onError: createOnError('create_transmittal'),
  })
}

// ── AI Agents ────────────────────────────────────────────

export function useApproveAgentAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, projectId, userId }: { id: string; projectId: string; userId: string }) => {
      const { error } = await from('ai_agent_actions').update({
        status: 'approved',
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
        applied: true,
        applied_at: new Date().toISOString(),
      }).eq('id', id)
      if (error) throw error
      return { projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['ai_agent_actions', result.projectId] })
      posthog.capture('agent_action_approved', { project_id: result.projectId })
    },
    onError: createOnError('approve_agent_action'),
  })
}

export function useRejectAgentAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, projectId, userId }: { id: string; projectId: string; userId: string }) => {
      const { error } = await from('ai_agent_actions').update({
        status: 'rejected',
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      }).eq('id', id)
      if (error) throw error
      return { projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['ai_agent_actions', result.projectId] })
      posthog.capture('agent_action_rejected', { project_id: result.projectId })
    },
    onError: createOnError('reject_agent_action'),
  })
}

export function useUpdateAgentConfig() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, updates, projectId }: { id: string; updates: Record<string, unknown>; projectId: string }) => {
      const { error } = await from('ai_agents').update(updates).eq('id', id)
      if (error) throw error
      return { projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['ai_agents', result.projectId] })
      posthog.capture('agent_config_updated', { project_id: result.projectId })
    },
    onError: createOnError('update_agent_config'),
  })
}

export function useRunAgent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ agentType, projectId }: { agentType: string; projectId: string }) => {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      if (!supabaseUrl) throw new Error('Supabase not configured')

      const response = await fetch(`${supabaseUrl}/functions/v1/agent-runner`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_type: agentType, project_id: projectId, trigger: 'manual' }),
      })
      if (!response.ok) throw new Error('Agent execution failed')
      return await response.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['ai_agents', variables.projectId] })
      queryClient.invalidateQueries({ queryKey: ['ai_agent_actions', variables.projectId] })
      posthog.capture('agent_run_manual', { agent_type: _data?.agent_type, project_id: variables.projectId })
    },
    onError: createOnError('run_agent'),
  })
}

// ── Notification Preferences ─────────────────────────────

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, updates }: { userId: string; updates: Record<string, unknown> }) => {
      const { data, error } = await from('notification_preferences').upsert({ user_id: userId, ...updates }).select().single()
      if (error) throw error
      return { data, userId }
    },
    onSuccess: (result: { userId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['notification_preferences', result.userId] })
      posthog.capture('notification_preferences_updated')
    },
    onError: createOnError('update_notification_preferences'),
  })
}

// ── RFI Watchers ─────────────────────────────────────────

export function useAddRFIWatcher() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ rfiId, userId }: { rfiId: string; userId: string }) => {
      const { error } = await from('rfi_watchers').insert({ rfi_id: rfiId, user_id: userId })
      if (error) throw error
      return { rfiId }
    },
    onSuccess: (result: { rfiId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['rfi_watchers', result.rfiId] })
    },
    onError: createOnError('add_rfi_watcher'),
  })
}

export function useRemoveRFIWatcher() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ rfiId, userId }: { rfiId: string; userId: string }) => {
      const { error } = await from('rfi_watchers').delete().eq('rfi_id', rfiId).eq('user_id', userId)
      if (error) throw error
      return { rfiId }
    },
    onSuccess: (result: { rfiId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['rfi_watchers', result.rfiId] })
    },
    onError: createOnError('remove_rfi_watcher'),
  })
}

// ── Task Bulk Operations ─────────────────────────────────

export function useBulkUpdateTasks() {
  return useMutation({
    mutationFn: async ({ ids, updates, projectId }: { ids: string[]; updates: Record<string, unknown>; projectId: string }) => {
      const { error } = await from('tasks').update(updates).in('id', ids)
      if (error) throw error
      return { projectId, count: ids.length }
    },
    onSuccess: (result: { projectId: string; count: number }) => {
      invalidateEntity('task', result.projectId)
      posthog.capture('tasks_bulk_updated', { project_id: result.projectId, count: result.count })
    },
    onError: createOnError('bulk_update_tasks'),
  })
}

export function useBulkDeleteTasks() {
  return useMutation({
    mutationFn: async ({ ids, projectId }: { ids: string[]; projectId: string }) => {
      const { error } = await from('tasks').delete().in('id', ids)
      if (error) throw error
      return { projectId, count: ids.length }
    },
    onSuccess: (result: { projectId: string; count: number }) => {
      invalidateEntity('task', result.projectId)
      posthog.capture('tasks_bulk_deleted', { project_id: result.projectId, count: result.count })
    },
    onError: createOnError('bulk_delete_tasks'),
  })
}

export function useReorderTasks() {
  const queryClient = useQueryClient()
  return useMutation({
    // Optimistic: apply reorder instantly in the UI
    onMutate: async ({ updates, projectId }) => {
      await queryClient.cancelQueries({ queryKey: ['tasks', projectId] })
      const previousTasks = queryClient.getQueryData(['tasks', projectId])
      queryClient.setQueryData(['tasks', projectId], (old: unknown[]) => {
        if (!Array.isArray(old)) return old
        const orderMap = new Map(updates.map((u) => [u.id, u.sort_order]))
        return old.map((t) => orderMap.has(t.id) ? { ...t, sort_order: orderMap.get(t.id) } : t)
          .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      })
      return { previousTasks }
    },
    mutationFn: async ({ updates, projectId }: { updates: Array<{ id: string; sort_order: number }>; projectId: string }) => {
      // ATOMIC: Use Supabase RPC to update all sort_orders in a single transaction.
      // Falls back to individual updates if RPC not available.
      try {
        const { error } = await supabase.rpc('reorder_tasks', {
          task_ids: updates.map((u) => u.id),
          new_orders: updates.map((u) => u.sort_order),
        })
        if (error) throw error
      } catch {
        // Fallback: individual updates (non-atomic, last resort)
        for (const { id, sort_order } of updates) {
          const { error } = await from('tasks').update({ sort_order }).eq('id', id)
          if (error) throw error
        }
      }
      return { projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', result.projectId] })
    },
    onError: (_err, { projectId }, context) => {
      // Rollback optimistic update on failure
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks', projectId], context.previousTasks)
      }
      toast.error('Failed to reorder tasks')
      Sentry.captureException(_err, { extra: { mutation: 'reorder_tasks' } })
    },
  })
}

export function useUpdateTaskDependencies() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ taskId, predecessorIds, projectId }: { taskId: string; predecessorIds: string[]; projectId: string }) => {
      const { error } = await from('tasks').update({ predecessor_ids: predecessorIds }).eq('id', taskId)
      if (error) throw error
      return { projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['tasks', result.projectId] })
      queryClient.invalidateQueries({ queryKey: ['task_critical_path', result.projectId] })
      posthog.capture('task_dependencies_updated', { project_id: result.projectId })
    },
    onError: createOnError('update_task_dependencies'),
  })
}

export function useApplyTaskTemplate() {
  return useMutation({
    mutationFn: async ({ templateId, projectId }: { templateId: string; projectId: string }) => {
      // task_templates added by migration but not yet in generated DB types
      const { data: template, error: templateError } = await supabase
        .from('task_templates' as keyof Database['public']['Tables'])
        .select('*')
        .eq('id', templateId)
        .single()
      if (templateError) throw templateError

      const tmpl = template as Record<string, unknown>
      const taskData = (Array.isArray(tmpl.task_data) ? tmpl.task_data : []) as Array<Record<string, unknown>>

      // ATOMIC: Batch insert all tasks in a single operation
      const taskRows = taskData.map((task) => ({
        project_id: projectId,
        title: task.title as string,
        description: (task.description as string) || '',
        status: 'todo',
        priority: (task.priority as string) || 'medium',
        estimated_hours: (task.estimated_hours as number | null) || null,
        phase: tmpl.phase as string,
      }))

      const { data: created, error: insertError } = await from('tasks')
        .insert(taskRows)
        .select()
      if (insertError) throw insertError

      // Wire up predecessor relationships in a second pass
      const createdTasks = (created || []) as Array<Record<string, unknown>>
      const idMap = new Map<string, string>()
      taskData.forEach((task, i: number) => {
        if (createdTasks[i]) {
          idMap.set(String(task.id || task.title), String(createdTasks[i].id))
        }
      })

      for (const task of taskData) {
        const preds = task.predecessors as string[] | undefined
        if (preds?.length) {
          const createdId = idMap.get(String(task.id || task.title))
          const predIds = preds.map((p: string) => idMap.get(p)).filter(Boolean)
          if (createdId && predIds.length) {
            await from('tasks').update({ predecessor_ids: predIds }).eq('id', createdId)
          }
        }
      }

      return { projectId, count: taskData.length, phase: tmpl.phase as string }
    },
    onSuccess: (result: { projectId: string; count: number; phase: string }) => {
      invalidateEntity('task', result.projectId)
      posthog.capture('task_template_applied', { project_id: result.projectId, count: result.count, phase: result.phase })
    },
    onError: createOnError('apply_task_template'),
  })
}

// ── AI Insights ──────────────────────────────────────────

export function useDismissInsight() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, projectId }: { id: string; projectId: string }) => {
      const { error } = await from('ai_insights').update({ dismissed: true }).eq('id', id)
      if (error) throw error
      return { projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['ai_insights', result.projectId] })
      posthog.capture('insight_dismissed', { project_id: result.projectId })
    },
    onError: createOnError('dismiss_insight'),
  })
}

export function useActOnInsight() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, action, projectId }: { id: string; action: string; projectId: string }) => {
      const { error } = await from('ai_insights').update({
        acted_on_at: new Date().toISOString(),
        acted_on_action: action,
      }).eq('id', id)
      if (error) throw error
      return { projectId }
    },
    onSuccess: (result: { projectId: string }) => {
      queryClient.invalidateQueries({ queryKey: ['ai_insights', result.projectId] })
      posthog.capture('insight_acted_on', { project_id: result.projectId })
    },
    onError: createOnError('act_on_insight'),
  })
}

// ── Integrations ─────────────────────────────────────────

export function useConnectIntegration() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { type: string; projectId: string; credentials: Record<string, unknown> }) => {
      const { getProvider } = await import('../../services/integrations')
      const provider = getProvider(params.type)
      if (!provider) throw new Error(`No provider for integration type: ${params.type}`)
      const result = await provider.connect(params.projectId, params.credentials)
      if (result.error) throw new Error(result.error)
      return { integrationId: result.integrationId, type: params.type }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      posthog.capture('integration_connected', { type: result.type })
    },
    onError: createOnError('connect_integration'),
  })
}

export function useDisconnectIntegration() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { integrationId: string; type: string }) => {
      const { getProvider } = await import('../../services/integrations')
      const provider = getProvider(params.type)
      if (!provider) {
        await from('integrations').update({ status: 'disconnected' }).eq('id', params.integrationId)
      } else {
        await provider.disconnect(params.integrationId)
      }
      return params
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      posthog.capture('integration_disconnected', { type: result.type })
    },
    onError: createOnError('disconnect_integration'),
  })
}

export function useSyncIntegration() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { integrationId: string; type: string; direction?: 'import' | 'export' | 'bidirectional' }) => {
      const { getProvider } = await import('../../services/integrations')
      const provider = getProvider(params.type)
      if (!provider) throw new Error(`No provider for integration type: ${params.type}`)
      const result = await provider.sync(params.integrationId, params.direction ?? 'bidirectional')
      return { ...result, type: params.type, integrationId: params.integrationId }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['integrations'] })
      queryClient.invalidateQueries({ queryKey: ['integration_sync_log'] })
      posthog.capture('integration_synced', { type: result.type, synced: result.recordsSynced, failed: result.recordsFailed })
    },
    onError: createOnError('sync_integration'),
  })
}

export function useUpdateBudgetItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      projectId,
      updates,
    }: {
      id: string
      projectId: string
      updates: { actual_amount?: number; percent_complete?: number }
    }) => {
      const { data, error } = await from('budget_items')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('project_id', projectId)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (_data, { projectId }) => {
      void qc.invalidateQueries({ queryKey: [`costData-${projectId}`] })
    },
    onError: () => {
      toast.error('Failed to save budget update')
    },
  })
}
