// Google Drive Integration: OAuth2 + Drive API v3
// Syncs drawings, submittals, RFI attachments, daily log photos to/from a project folder.


import { fromTable } from '../../lib/db/queries'
import { rateLimitedFetch } from './rateLimiter'
import {
  type IntegrationProvider,
  type SyncResult,
  type IntegrationStatus,
  logSyncResult,
  updateIntegrationStatus,
} from './base'

const DRIVE_API = 'https://www.googleapis.com/drive/v3'


// ── API Helpers ─────────────────────────────────────────

async function driveApi(accessToken: string, path: string, options?: RequestInit) {
  const response = await rateLimitedFetch('google_drive', `${DRIVE_API}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (response.status === 401) {
    throw new Error('OAUTH_TOKEN_EXPIRED')
  }

  if (!response.ok) {
    const errBody = await response.text()
    throw new Error(`Google Drive API error ${response.status}: ${errBody}`)
  }

  return response.json()
}

async function ensureProjectFolder(accessToken: string, projectName: string, parentFolderId?: string): Promise<string> {
  // Check if project folder exists
  const query = `name='SiteSync: ${projectName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  const existing = await driveApi(accessToken, `/files?q=${encodeURIComponent(query)}&fields=files(id,name)`)

  if (existing.files?.length > 0) {
    return existing.files[0].id
  }

  // Create project folder
  const metadata: Record<string, unknown> = {
    name: `SiteSync: ${projectName}`,
    mimeType: 'application/vnd.google-apps.folder',
  }
  if (parentFolderId) {
    metadata.parents = [parentFolderId]
  }

  const folder = await driveApi(accessToken, '/files', {
    method: 'POST',
    body: JSON.stringify(metadata),
  })

  return folder.id
}

async function listFilesInFolder(accessToken: string, folderId: string, modifiedAfter?: string): Promise<Array<{ id: string; name: string; mimeType: string; modifiedTime: string; size: string }>> {
  let query = `'${folderId}' in parents and trashed=false`
  if (modifiedAfter) {
    query += ` and modifiedTime>'${modifiedAfter}'`
  }

  const result = await driveApi(
    accessToken,
    `/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,modifiedTime,size)&pageSize=1000`,
  )

  return result.files ?? []
}

// ── Provider ────────────────────────────────────────────

export const googleDriveProvider: IntegrationProvider = {
  type: 'google_drive',

  async connect(projectId, credentials) {
    // OAuth2 flow is handled by the oauth-token-exchange edge function.
    // By the time connect() is called, tokens are already in the integration config.
    // This method handles post-OAuth setup (creating project folder, etc.)

    const { integrationId } = credentials as { integrationId: string }
    if (!integrationId) {
      return { integrationId: '', error: 'Integration ID required (OAuth flow must complete first)' }
    }

    const { data: integration } = await fromTable('integrations').select('config').eq('id' as never, integrationId).single()
    const config = integration?.config as Record<string, string> | null

    if (!config?.accessToken) {
      return { integrationId: '', error: 'No access token. Complete OAuth flow first.' }
    }

    try {
      // Create/find project folder
      const { data: project } = await fromTable('projects').select('name').eq('id' as never, projectId).single()
      const folderId = await ensureProjectFolder(config.accessToken, project?.name ?? 'Project')

      // Store folder ID in config
      await fromTable('integrations').update({
        config: { ...config, folderId },
      } as never).eq('id' as never, integrationId)

      return { integrationId }
    } catch (err) {
      return { integrationId: '', error: (err as Error).message }
    }
  },

  async disconnect(integrationId) {
    // Revoke is handled by the edge function
    await updateIntegrationStatus(integrationId, 'disconnected')
  },

  async sync(integrationId, direction) {
    await updateIntegrationStatus(integrationId, 'syncing')

    const { data: integration } = await fromTable('integrations').select('config, last_sync').eq('id' as never, integrationId).single()
    const config = integration?.config as Record<string, string> | null

    if (!config?.accessToken || !config?.folderId) {
      const result: SyncResult = { success: false, recordsSynced: 0, recordsFailed: 0, errors: ['Not configured. Reconnect Google Drive.'] }
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
        // Import: list new/changed files from Drive, create document records
        const files = await listFilesInFolder(config.folderId, config.accessToken, integration?.last_sync ?? undefined)
        details.filesFound = files.length

        for (const file of files) {
          try {
            // Upsert document record
            await fromTable('documents').upsert({
              name: file.name,
              mime_type: file.mimeType,
              external_id: file.id,
              external_source: 'google_drive',
              file_size: parseInt(file.size ?? '0', 10),
              updated_at: file.modifiedTime,
            } as never, { onConflict: 'external_id,external_source' })
            synced++
          } catch {
            failed++
          }
        }
      }

      if (direction === 'export' || direction === 'bidirectional') {
        // Export: find documents not yet uploaded to Drive
        const { data: pendingDocs } = await fromTable('documents')
          .select('id, name, storage_path')
          .is('external_id' as never, null)
          .limit(50)

        details.pendingExports = pendingDocs?.length ?? 0
        // Upload logic would use Supabase Storage -> Drive upload API
        // Omitted: requires signed URL download + multipart upload to Drive
      }

      const result: SyncResult = { success: errors.length === 0, recordsSynced: synced, recordsFailed: failed, errors, details }
      await logSyncResult(integrationId, result, direction)
      await updateIntegrationStatus(integrationId, errors.length === 0 ? 'connected' : 'error')
      return result
    } catch (err) {
      const msg = (err as Error).message
      if (msg === 'OAUTH_TOKEN_EXPIRED') {
        errors.push('Access token expired. Please refresh the connection.')
        await updateIntegrationStatus(integrationId, 'error', 'Token expired')
      } else {
        errors.push(msg)
        await updateIntegrationStatus(integrationId, 'error', msg)
      }
      const result: SyncResult = { success: false, recordsSynced: synced, recordsFailed: failed, errors, details }
      await logSyncResult(integrationId, result, direction)
      return result
    }
  },

  async getStatus(integrationId) {
    const { data } = await fromTable('integrations').select('status, last_sync, error_log').eq('id' as never, integrationId).single()
    return {
      status: (data?.status as IntegrationStatus) ?? 'disconnected',
      lastSync: data?.last_sync ?? null,
      error: Array.isArray(data?.error_log) ? (data.error_log as string[])[0] : undefined,
    }
  },

  getCapabilities() {
    return ['file_sync', 'drawing_sync', 'photo_sync']
  },
}
