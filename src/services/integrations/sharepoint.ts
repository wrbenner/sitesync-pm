// SharePoint/OneDrive Integration: Microsoft Graph API
// OAuth2 via MSAL. File sync with project document library.


import { fromTable } from '../../lib/db/queries'
import { rateLimitedFetch } from './rateLimiter'
import {
  type IntegrationProvider,
  type SyncResult,
  type IntegrationStatus,
  logSyncResult,
  updateIntegrationStatus,
} from './base'

const GRAPH_API = 'https://graph.microsoft.com/v1.0'

// ── API Helper ──────────────────────────────────────────

async function graphApi(accessToken: string, path: string, options?: RequestInit) {
  const response = await rateLimitedFetch('sharepoint', `${GRAPH_API}${path}`, {
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
    throw new Error(`Microsoft Graph API error ${response.status}: ${errBody}`)
  }

  return response.json()
}

// ── Provider ────────────────────────────────────────────

export const sharePointProvider: IntegrationProvider = {
  type: 'sharepoint',

  async connect(projectId, credentials) {
    // OAuth handled by edge function. Post-OAuth setup here.
    const { integrationId, siteUrl } = credentials as { integrationId: string; siteUrl?: string }
    if (!integrationId) {
      return { integrationId: '', error: 'Integration ID required (OAuth flow must complete first)' }
    }

    const { data: integrationData } = await fromTable('integrations').select('config').eq('id' as never, integrationId).single()
    const integration = integrationData as { config: Record<string, string> | null } | null
    const config = integration?.config ?? null

    if (!config?.accessToken) {
      return { integrationId: '', error: 'No access token. Complete OAuth flow first.' }
    }

    try {
      // Discover the SharePoint site or use OneDrive root
      let driveId: string

      if (siteUrl) {
        // Parse SharePoint site URL to get site ID
        const hostname = new URL(siteUrl).hostname
        const sitePath = new URL(siteUrl).pathname
        const site = await graphApi(config.accessToken, `/sites/${hostname}:${sitePath}`)
        const drives = await graphApi(config.accessToken, `/sites/${site.id}/drives`)
        driveId = drives.value?.[0]?.id ?? ''
      } else {
        // Use OneDrive personal drive
        const drive = await graphApi(config.accessToken, '/me/drive')
        driveId = drive.id
      }

      if (!driveId) {
        return { integrationId: '', error: 'Could not find a document library' }
      }

      // Create project folder
      const { data: projectData } = await fromTable('projects').select('name').eq('id' as never, projectId).single()
      const project = projectData as { name: string | null } | null
      const folderName = `SiteSync: ${project?.name ?? 'Project'}`

      let folderId: string
      try {
        const existing = await graphApi(config.accessToken, `/drives/${driveId}/root:/${encodeURIComponent(folderName)}`)
        folderId = existing.id
      } catch {
        // Folder doesn't exist, create it
        const created = await graphApi(config.accessToken, `/drives/${driveId}/root/children`, {
          method: 'POST',
          body: JSON.stringify({
            name: folderName,
            folder: {},
            '@microsoft.graph.conflictBehavior': 'rename',
          }),
        })
        folderId = created.id
      }

      await fromTable('integrations').update({
        config: { ...config, driveId, folderId, siteUrl: siteUrl ?? 'onedrive' },
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

    const { data: integrationData } = await fromTable('integrations').select('config, last_sync').eq('id' as never, integrationId).single()
    const integration = integrationData as { config: Record<string, string> | null; last_sync: string | null } | null
    const config = integration?.config ?? null

    if (!config?.accessToken || !config?.driveId || !config?.folderId) {
      const result: SyncResult = { success: false, recordsSynced: 0, recordsFailed: 0, errors: ['Not configured. Reconnect SharePoint.'] }
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
        // Use delta query for incremental sync
        const deltaPath = config.deltaLink
          ? config.deltaLink
          : `/drives/${config.driveId}/items/${config.folderId}/delta`

        const delta = await graphApi(config.accessToken, deltaPath)
        const items = delta.value?.filter((item: Record<string, unknown>) => item.file) ?? []
        details.filesFound = items.length

        for (const item of items) {
          try {
            await fromTable('documents').upsert({
              name: item.name,
              mime_type: (item.file as Record<string, string>)?.mimeType ?? 'application/octet-stream',
              external_id: item.id,
              external_source: 'sharepoint',
              file_size: item.size ?? 0,
              updated_at: item.lastModifiedDateTime,
            } as never, { onConflict: 'external_id,external_source' })
            synced++
          } catch {
            failed++
          }
        }

        // Store delta link for next incremental sync
        if (delta['@odata.deltaLink']) {
          await fromTable('integrations').update({
            config: { ...config, deltaLink: delta['@odata.deltaLink'] },
          } as never).eq('id' as never, integrationId)
        }
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
    const row = data as { status: string | null; last_sync: string | null; error_log: unknown } | null
    return {
      status: (row?.status as IntegrationStatus) ?? 'disconnected',
      lastSync: row?.last_sync ?? null,
      error: Array.isArray(row?.error_log) ? (row.error_log as string[])[0] : undefined,
    }
  },

  getCapabilities() {
    return ['file_sync', 'drawing_sync', 'sharepoint_library']
  },
}
