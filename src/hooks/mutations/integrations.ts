import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import type { Database } from '../../types/database'
import {
  integrationConnectionsKey,
  integrationSyncJobsKey,
  type IntegrationProvider,
  type IntegrationConnection,
  type IntegrationSyncJob,
  type SyncEntityType,
  type SyncDirection,
} from '../queries/integrations'

// Dynamic table access helper — mirrors the pattern used across the
// mutations layer for tables whose generated types may lag the schema.
type AnyTableName = keyof Database['public']['Tables'] | (string & Record<never, never>)
const from = (table: AnyTableName) => supabase.from(table as keyof Database['public']['Tables'])

// ── Integration Connections ────────────────────────────────────
//
// Real OAuth handshake is deliberately NOT wired. The UX stub is:
//   1. `useCreateConnection` inserts a row in status='pending_auth'
//   2. `useConfirmConnection` flips it to 'connected'
// The encrypted-token columns stay null until a real OAuth callback
// is implemented in a later phase.

export interface CreateConnectionInput {
  organizationId: string
  provider: IntegrationProvider
  accountName?: string | null
  scope?: string | null
}

export function useCreateConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CreateConnectionInput) => {
      const { data, error } = await from('integration_connections')
        .insert({
          organization_id: input.organizationId,
          provider: input.provider,
          account_name: input.accountName ?? null,
          scope: input.scope ?? null,
          status: 'pending_auth',
        })
        .select()
        .single()
      if (error) throw error
      return data as IntegrationConnection
    },
    onSuccess: (_row, vars) => {
      qc.invalidateQueries({ queryKey: integrationConnectionsKey(vars.organizationId) })
      toast.success('Connection created. Confirm to finish the stub flow.')
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to create connection'),
  })
}

export interface ConfirmConnectionInput {
  id: string
  organizationId: string
  accountName?: string | null
}

/** Stub for the eventual OAuth callback — flips 'pending_auth' → 'connected'. */
export function useConfirmConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: ConfirmConnectionInput) => {
      const updates: Record<string, unknown> = { status: 'connected' }
      if (input.accountName !== undefined) updates.account_name = input.accountName ?? null
      const { data, error } = await from('integration_connections')
        .update(updates)
        .eq('id', input.id)
        .eq('organization_id', input.organizationId)
        .select()
        .single()
      if (error) throw error
      return data as IntegrationConnection
    },
    onSuccess: (_row, vars) => {
      qc.invalidateQueries({ queryKey: integrationConnectionsKey(vars.organizationId) })
      toast.success('Connection confirmed')
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to confirm connection'),
  })
}

export interface DisconnectConnectionInput {
  id: string
  organizationId: string
}

export function useDisconnectConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: DisconnectConnectionInput) => {
      const { data, error } = await from('integration_connections')
        .update({
          status: 'disconnected',
          // Clear tokens on disconnect — a future reconnect starts over.
          oauth_token_encrypted: null,
          oauth_refresh_token_encrypted: null,
          expires_at: null,
        })
        .eq('id', input.id)
        .eq('organization_id', input.organizationId)
        .select()
        .single()
      if (error) throw error
      return data as IntegrationConnection
    },
    onSuccess: (_row, vars) => {
      qc.invalidateQueries({ queryKey: integrationConnectionsKey(vars.organizationId) })
      toast.success('Connection disconnected')
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to disconnect'),
  })
}

/**
 * Revoke is a harder disconnect — the connection is explicitly revoked by
 * the remote provider (or flagged revoked by us). We keep the row for
 * audit; status reflects the state.
 */
export function useRevokeConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: DisconnectConnectionInput) => {
      const { data, error } = await from('integration_connections')
        .update({ status: 'revoked' })
        .eq('id', input.id)
        .eq('organization_id', input.organizationId)
        .select()
        .single()
      if (error) throw error
      return data as IntegrationConnection
    },
    onSuccess: (_row, vars) => {
      qc.invalidateQueries({ queryKey: integrationConnectionsKey(vars.organizationId) })
      toast.success('Connection revoked')
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to revoke connection'),
  })
}

export interface DeleteConnectionInput {
  id: string
  organizationId: string
}

export function useDeleteConnection() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: DeleteConnectionInput) => {
      const { error } = await from('integration_connections')
        .delete()
        .eq('id', input.id)
        .eq('organization_id', input.organizationId)
      if (error) throw error
      return input
    },
    onSuccess: (_row, vars) => {
      qc.invalidateQueries({ queryKey: integrationConnectionsKey(vars.organizationId) })
      toast.success('Connection deleted')
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to delete connection'),
  })
}

// ── Sync Jobs ──────────────────────────────────────────────────

export interface TriggerSyncInput {
  organizationId: string
  connectionId: string
  entityType: SyncEntityType
  direction?: SyncDirection
}

/**
 * "Trigger manual sync" — inserts a sync_jobs row in status='queued'.
 * A worker picks it up later; no client-side polling here beyond the
 * react-query invalidation so the history table refreshes immediately.
 */
export function useTriggerSyncJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: TriggerSyncInput) => {
      const { data, error } = await from('integration_sync_jobs')
        .insert({
          connection_id: input.connectionId,
          entity_type: input.entityType,
          direction: input.direction ?? 'bidirectional',
          status: 'queued',
        })
        .select()
        .single()
      if (error) throw error
      return data as IntegrationSyncJob
    },
    onSuccess: (_row, vars) => {
      qc.invalidateQueries({ queryKey: integrationSyncJobsKey(vars.connectionId) })
      qc.invalidateQueries({ queryKey: integrationConnectionsKey(vars.organizationId) })
      toast.success('Sync queued')
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to queue sync'),
  })
}

// ── Budget item update (unrelated legacy helper) ──────────────
//
// `useUpdateBudgetItem` was historically co-located here and is imported
// by src/pages/Budget.tsx via the hooks/mutations barrel. Moving it would
// break that import path — scope for this session is only this file, so
// it stays where callers expect it.

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
