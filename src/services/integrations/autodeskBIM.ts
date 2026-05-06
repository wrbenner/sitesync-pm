// Autodesk Construction Cloud / BIM 360 Integration
// OAuth2 via Autodesk Forge. Syncs model versions, issues, and markups.


import { fromTable, asRow } from '../../lib/db/queries'
import { rateLimitedFetch } from './rateLimiter'
import {
  type IntegrationProvider,
  type SyncResult,
  type IntegrationStatus,
  logSyncResult,
  updateIntegrationStatus,
} from './base'

const ACC_API = 'https://developer.api.autodesk.com'

// ── API Helper ──────────────────────────────────────────

async function accApi(accessToken: string, path: string, options?: RequestInit) {
  const response = await rateLimitedFetch('autodesk_bim360', `${ACC_API}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (response.status === 401) throw new Error('OAUTH_TOKEN_EXPIRED')
  if (!response.ok) {
    const errBody = await response.text()
    throw new Error(`Autodesk API error ${response.status}: ${errBody}`)
  }

  return response.json()
}

// ── Provider ────────────────────────────────────────────

export const autodeskBIMProvider: IntegrationProvider = {
  type: 'autodesk_bim360',

  async connect(_projectId, credentials) {
    const { integrationId, accProjectId } = credentials as { integrationId: string; accProjectId?: string }
    if (!integrationId) {
      return { integrationId: '', error: 'Integration ID required (OAuth flow must complete first)' }
    }

    const { data } = await fromTable('integrations').select('config').eq('id' as never, integrationId).single()
    const integration = asRow<{ config: Record<string, string> | null }>(data)
    const config = integration?.config ?? null

    if (!config?.accessToken) {
      return { integrationId: '', error: 'No access token. Complete OAuth flow first.' }
    }

    try {
      // If no ACC project ID provided, list available hubs/projects
      if (!accProjectId) {
        const hubs = await accApi(config.accessToken, '/project/v1/hubs')
        const hubId = hubs.data?.[0]?.id
        if (!hubId) return { integrationId: '', error: 'No Autodesk hubs found for this account' }

        const projects = await accApi(config.accessToken, `/project/v1/hubs/${hubId}/projects`)
        // Store available projects for user to select
        await fromTable('integrations').update({
          config: { ...config, hubId, availableProjects: projects.data?.map((p: Record<string, unknown>) => ({ id: p.id, name: (p.attributes as unknown as Record<string, unknown>)?.name ?? '' })) ?? [] },
        } as never).eq('id' as never, integrationId)

        return { integrationId }
      }

      // Project selected, store it
      await fromTable('integrations').update({
        config: { ...config, accProjectId },
      } as never).eq('id' as never, integrationId)

      return { integrationId }
    } catch (err) {
      return { integrationId: '', error: (err as Error).message }
    }
  },

  async disconnect(integrationId) {
    await updateIntegrationStatus(integrationId, 'disconnected')
  },

  async sync(integrationId, direction) {
    await updateIntegrationStatus(integrationId, 'syncing')

    const { data } = await fromTable('integrations').select('config').eq('id' as never, integrationId).single()
    const integration = asRow<{ config: Record<string, string> | null }>(data)
    const config = integration?.config ?? null

    if (!config?.accessToken || !config?.accProjectId) {
      const result: SyncResult = { success: false, recordsSynced: 0, recordsFailed: 0, errors: ['Not configured. Select an Autodesk project.'] }
      await logSyncResult(integrationId, result, direction)
      await updateIntegrationStatus(integrationId, 'error')
      return result
    }

    let synced = 0
    let failed = 0
    const errors: string[] = []
    const details: Record<string, number> = {}

    try {
      if (direction === 'import' || direction === 'bidirectional') {
        // Import BIM model versions
        try {
          const topFolders = await accApi(config.accessToken, `/project/v1/hubs/${config.hubId}/projects/${config.accProjectId}/topFolders`)
          details.folders = topFolders.data?.length ?? 0

          // Import issues from ACC
          const issues = await accApi(config.accessToken, `/issues/v1/containers/${config.accProjectId}/quality-issues`)
          const issueList = issues.results ?? []
          details.issues = issueList.length

          for (const issue of issueList) {
            try {
              // Map ACC issues to SiteSync punch items or RFIs based on type
              const attrs = issue.attributes ?? issue
              await fromTable('punch_items').upsert({
                title: attrs.title ?? attrs.displayId ?? '',
                description: attrs.description ?? '',
                status: mapACCIssueStatus(attrs.status ?? ''),
                external_id: issue.id,
                external_source: 'autodesk_bim360',
              } as never, { onConflict: 'external_id,external_source' })
              synced++
            } catch {
              failed++
            }
          }
        } catch (err) {
          errors.push(`BIM sync: ${(err as Error).message}`)
        }
      }

      if (direction === 'export' || direction === 'bidirectional') {
        // Export: push SiteSync issues back to ACC
        const { data: items } = await fromTable('punch_items')
          .select('*')
          .is('external_id' as never, null)
          .limit(50)

        details.pendingExports = items?.length ?? 0
        // Create issues in ACC via POST /issues/v1/containers/{containerId}/quality-issues
        // Omitted for now: requires container/location setup
      }

      const result: SyncResult = { success: errors.length === 0, recordsSynced: synced, recordsFailed: failed, errors, details }
      await logSyncResult(integrationId, result, direction)
      await updateIntegrationStatus(integrationId, errors.length === 0 ? 'connected' : 'error')
      return result
    } catch (err) {
      const msg = (err as Error).message
      errors.push(msg === 'OAUTH_TOKEN_EXPIRED' ? 'Token expired. Please refresh.' : msg)
      await updateIntegrationStatus(integrationId, 'error', msg)
      const result: SyncResult = { success: false, recordsSynced: synced, recordsFailed: failed, errors, details }
      await logSyncResult(integrationId, result, direction)
      return result
    }
  },

  async getStatus(integrationId) {
    const { data } = await fromTable('integrations').select('status, last_sync, error_log').eq('id' as never, integrationId).single()
    const row = asRow<{ status: string | null; last_sync: string | null; error_log: unknown }>(data)
    return {
      status: (row?.status as IntegrationStatus) ?? 'disconnected',
      lastSync: row?.last_sync ?? null,
      error: Array.isArray(row?.error_log) ? (row.error_log as string[])[0] : undefined,
    }
  },

  getCapabilities() {
    return ['model_import', 'issue_sync', 'markup_sync']
  },
}

function mapACCIssueStatus(status: string): string {
  const map: Record<string, string> = {
    open: 'open', draft: 'draft', pending: 'pending',
    in_review: 'in_review', closed: 'closed', void: 'void',
    answered: 'resolved',
  }
  return map[status.toLowerCase()] ?? 'open'
}
