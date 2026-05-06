import { useQuery } from '@tanstack/react-query'

import { fromTable } from '../../lib/db/queries'

export type IntegrationProvider =
  | 'procore'
  | 'sage'
  | 'quickbooks'
  | 'autodesk_bim360'
  | 'oracle_aconex'

export type IntegrationStatus =
  | 'disconnected'
  | 'pending_auth'
  | 'connected'
  | 'error'
  | 'revoked'

export type SyncEntityType =
  | 'rfis'
  | 'submittals'
  | 'budget'
  | 'drawings'
  | 'schedule'
  | 'documents'

export type SyncDirection = 'import' | 'export' | 'bidirectional'

export type SyncStatus = 'queued' | 'running' | 'succeeded' | 'failed'

export interface IntegrationConnection {
  id: string
  organization_id: string
  provider: IntegrationProvider
  account_name: string | null
  status: IntegrationStatus
  oauth_token_encrypted: string | null
  oauth_refresh_token_encrypted: string | null
  expires_at: string | null
  last_sync_at: string | null
  scope: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface IntegrationSyncJob {
  id: string
  connection_id: string
  entity_type: SyncEntityType
  direction: SyncDirection
  status: SyncStatus
  records_processed: number
  records_failed: number
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export const integrationConnectionsKey = (orgId: string | undefined) =>
  ['integration_connections', orgId] as const

export const integrationSyncJobsKey = (connectionId: string | undefined) =>
  ['integration_sync_jobs', connectionId] as const

/**
 * Every connection row for an organization. The page groups these by
 * provider, so we sort by provider then newest first to make the
 * fallback-when-multiple case stable.
 */
export function useIntegrationConnections(organizationId: string | undefined) {
  return useQuery<IntegrationConnection[]>({
    queryKey: integrationConnectionsKey(organizationId),
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await fromTable('integration_connections')
        .select('*')
        .eq('organization_id' as never, organizationId!)
        .order('provider', { ascending: true })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as IntegrationConnection[]
    },
  })
}

/**
 * Last 20 sync jobs for a connection, newest first. Powers the sync
 * history table on the detail panel.
 */
export function useIntegrationSyncJobs(connectionId: string | undefined) {
  return useQuery<IntegrationSyncJob[]>({
    queryKey: integrationSyncJobsKey(connectionId),
    enabled: !!connectionId,
    queryFn: async () => {
      const { data, error } = await fromTable('integration_sync_jobs')
        .select('*')
        .eq('connection_id' as never, connectionId!)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return (data ?? []) as unknown as IntegrationSyncJob[]
    },
  })
}
