import { fromTable } from '../../lib/db/queries'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import posthog from '../../lib/analytics'
import { useAuditedMutation, createOnError } from './createAuditedMutation'
import { invalidateEntity } from '../../api/invalidation'
import { toast } from 'sonner'
import Sentry from '../../lib/sentry'
import { validateDailyLogStatusTransition } from './state-machine-validation-helpers'



// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
const from = (table: string) => fromTable(table as never)

// ── Daily Log Entries ─────────────────────────────────────

export function useCreateDailyLogEntry() {

  return useMutation({
    mutationFn: async (params: { data: Record<string, unknown>; projectId: string }) => {
      const { data, error } = await from('daily_log_entries').insert(params.data as never).select().single()
      if (error) throw error
      return { data, projectId: params.projectId }
    },
    onSuccess: (result: { data: unknown; projectId: string }) => {
      invalidateEntity('daily_log', result.projectId)
      posthog.capture('daily_log_entry_created', { project_id: result.projectId })

      // Cross-feature workflows: dispatch by entry type. Each chain is
      // fire-and-forget — failures never block the user's primary action.
      const entry = result.data as { id?: string; type?: string } | null
      if (entry?.id) {
        if (entry.type === 'incident') {
          // → create a tracked safety incident
          void import('../../lib/crossFeatureWorkflows')
            .then(({ runDailyLogIncidentChain }) => runDailyLogIncidentChain(entry.id!))
            .then((r) => {
              if (r.error) console.warn('[daily_log_incident chain]', r.error)
              else if (r.created) console.info('[daily_log_incident chain] created', r.created)
            })
            .catch((err) => console.warn('[daily_log_incident chain] dispatch failed:', err))
        } else if (entry.type === 'delay') {
          // → post a schedule-shift suggestion to activity_feed
          void import('../../lib/crossFeatureWorkflows')
            .then(({ runDailyLogDelayChain }) => runDailyLogDelayChain(entry.id!))
            .then((r) => {
              if (r.error) console.warn('[daily_log_delay chain]', r.error)
              else if (r.created) console.info('[daily_log_delay chain] created', r.created)
            })
            .catch((err) => console.warn('[daily_log_delay chain] dispatch failed:', err))
        }
      }
    },
    onError: createOnError('create_daily_log_entry'),
  })
}

export function useDeleteDailyLogEntry() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: { id: string; dailyLogId: string; projectId: string }) => {
      const { error } = await from('daily_log_entries').delete().eq('id' as never, params.id)
      if (error) throw error
      return { dailyLogId: params.dailyLogId, projectId: params.projectId }
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['daily_log_entries', result.dailyLogId] })
      invalidateEntity('daily_log', result.projectId)
      posthog.capture('daily_log_entry_deleted', { project_id: result.projectId })
    },
    onError: createOnError('delete_daily_log_entry'),
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
            const l = log as unknown as Record<string, unknown>
            return l.id === id ? { ...l, status: 'submitted', is_submitted: true } : l
          }),
        }
      })
      return { previous, key }
    },
    mutationFn: async ({ id, signatureUrl, projectId }: { id: string; signatureUrl?: string; projectId: string }) => {
      await validateDailyLogStatusTransition(id, projectId, 'submitted')
      // Note: only use columns that exist in the daily_logs table.
      // is_submitted and submitted_at are NOT real DB columns.
      const updates: Record<string, unknown> = {
        status: 'submitted',
        updated_at: new Date().toISOString(),
      }
      if (signatureUrl) updates.superintendent_signature_url = signatureUrl
      const { error } = await from('daily_logs').update(updates as never).eq('id' as never, id).eq('project_id' as never, projectId)
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
    action: 'approve',
    entityType: 'daily_log',
    getEntityId: (p: { id: string; projectId: string }) => p.id,
    getAfterState: (p: any) => ({ status: 'approved', approved_by: p.userId }),
    mutationFn: async ({ id, signatureUrl, userId, projectId }) => {
      await validateDailyLogStatusTransition(id, projectId, 'approved')
      const updates: Record<string, unknown> = {
        status: 'approved', approved: true, approved_at: new Date().toISOString(), approved_by: userId,
      }
      if (signatureUrl) updates.manager_signature_url = signatureUrl
      const { error } = await from('daily_logs').update(updates as never).eq('id' as never, id).eq('project_id' as never, projectId)
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
    action: 'reject',
    entityType: 'daily_log',
    getEntityId: (p: { id: string; projectId: string }) => p.id,
    getAfterState: (p: any) => ({ status: 'rejected', comments: p.comments, rejected_by: p.userId }),
    mutationFn: async ({ id, comments, userId: _userId, projectId }) => {
      await validateDailyLogStatusTransition(id, projectId, 'rejected')
      const { error } = await from('daily_logs').update({
        status: 'rejected',
        rejection_comments: comments,
        approved: false,
      } as never).eq('id' as never, id).eq('project_id' as never, projectId)
      if (error) throw error
      return { projectId }
    },
    invalidateKeys: (p) => [['daily_logs', 'detail', p.id]],
    analyticsEvent: 'daily_log_rejected',
    errorMessage: 'Failed to reject daily log',
  })
}
