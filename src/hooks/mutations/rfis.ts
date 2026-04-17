import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import posthog from '../../lib/analytics'
import { useAuditedMutation, createOnError } from './createAuditedMutation'
import { invalidateEntity } from '../../api/invalidation'
import {
  rfiSchema,
} from '../../components/forms/schemas'
import { validateRfiStatusTransition } from './state-machine-validation-helpers'

import type { Database } from '../../types/database'
type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
const from = (table: AnyTableName) => supabase.from(table as keyof Database['public']['Tables'])

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
