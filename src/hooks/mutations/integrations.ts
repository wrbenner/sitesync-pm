import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import posthog from '../../lib/analytics'
import { createOnError } from './createAuditedMutation'
import { toast } from 'sonner'



import type { Database } from '../../types/database'
type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
// Dynamic table access helper. Tables may include those added by migration but not yet in generated types.
const from = (table: AnyTableName) => supabase.from(table as keyof Database['public']['Tables'])

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
