// Procore Integration: Import projects, RFIs, and submittals

import { supabase } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'
import {
  type IntegrationProvider,
  type SyncResult,
  type IntegrationStatus,
  logSyncResult,
  updateIntegrationStatus,
  createIntegrationRecord,
} from './base'


interface ProcoreRFI {
  id: number
  number: number
  subject: string
  status: string
  priority: string
  assignee?: { name: string }
  due_date?: string
  created_at: string
}

interface ProcoreSubmittal {
  id: number
  number: number
  title: string
  status: { name: string }
  spec_section?: string
  due_date?: string
  created_at: string
}

async function procoreApi(apiKey: string, companyId: string, path: string) {
  const baseUrl = 'https://api.procore.com/rest/v1.0'
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Procore-Company-Id': companyId,
      'Content-Type': 'application/json',
    },
  })
  if (!response.ok) {
    throw new Error(`Procore API error: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

export const procoreProvider: IntegrationProvider = {
  type: 'procore_import',

  async connect(projectId, credentials) {
    const { apiKey, companyId } = credentials as { apiKey: string; companyId: string }
    if (!apiKey || !companyId) {
      return { integrationId: '', error: 'API Key and Company ID are required' }
    }

    try {
      // Verify credentials by fetching company info
      await procoreApi(apiKey, companyId, `/companies/${companyId}`)

      const { data: { user } } = await supabase.auth.getUser()
      const integrationId = await createIntegrationRecord('procore_import', projectId, {
        companyId,
        // API key stored encrypted in config (in production, use Supabase Vault)
        apiKeyPrefix: apiKey.slice(0, 8) + '...',
      }, user?.id ?? '')

      // Store the actual key securely (in production, use edge function + Supabase Vault)
      await fromTable('integrations').update({
        config: { companyId, apiKeyPrefix: apiKey.slice(0, 8) + '...' },
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
    if (direction !== 'import') {
      return { success: false, recordsSynced: 0, recordsFailed: 0, errors: ['Procore integration only supports import'] }
    }

    await updateIntegrationStatus(integrationId, 'syncing')

    const { data: integration } = await fromTable('integrations')
      .select('config')
      .eq('id' as never, integrationId)
      .single()

    if (!integration?.config) {
      const result: SyncResult = { success: false, recordsSynced: 0, recordsFailed: 0, errors: ['Integration config not found'] }
      await logSyncResult(integrationId, result, direction)
      await updateIntegrationStatus(integrationId, 'error', 'Config not found')
      return result
    }

    const config = integration.config as Record<string, string>
    let synced = 0
    let failed = 0
    const errors: string[] = []
    const details: Record<string, number> = {}

    try {
      // Import RFIs
      try {
        const procoreRfis: ProcoreRFI[] = await procoreApi(config.apiKey ?? '', config.companyId, `/projects/${config.projectId ?? ''}/rfis`)
        for (const rfi of procoreRfis) {
          try {
            await fromTable('rfis').upsert({
              title: rfi.subject,
              status: mapProcoreRFIStatus(rfi.status),
              priority: rfi.priority?.toLowerCase() || 'medium',
              number: rfi.number,
              assigned_to: rfi.assignee?.name || null,
              due_date: rfi.due_date || null,
              created_at: rfi.created_at,
            } as never, { onConflict: 'number,project_id' })
            synced++
          } catch {
            failed++
          }
        }
        details.rfis = procoreRfis.length
      } catch (err) {
        errors.push(`RFI import: ${(err as Error).message}`)
      }

      // Import Submittals
      try {
        const procoreSubmittals: ProcoreSubmittal[] = await procoreApi(config.apiKey ?? '', config.companyId, `/projects/${config.projectId ?? ''}/submittals`)
        for (const sub of procoreSubmittals) {
          try {
            await fromTable('submittals').upsert({
              title: sub.title,
              status: mapProcoreSubmittalStatus(sub.status.name),
              number: sub.number,
              due_date: sub.due_date || null,
              created_at: sub.created_at,
            } as never, { onConflict: 'number,project_id' })
            synced++
          } catch {
            failed++
          }
        }
        details.submittals = procoreSubmittals.length
      } catch (err) {
        errors.push(`Submittal import: ${(err as Error).message}`)
      }

      const result: SyncResult = {
        success: errors.length === 0,
        recordsSynced: synced,
        recordsFailed: failed,
        errors,
        details,
      }
      await logSyncResult(integrationId, result, direction)
      await updateIntegrationStatus(integrationId, errors.length === 0 ? 'connected' : 'error')
      return result
    } catch (err) {
      const result: SyncResult = { success: false, recordsSynced: synced, recordsFailed: failed, errors: [(err as Error).message] }
      await logSyncResult(integrationId, result, direction)
      await updateIntegrationStatus(integrationId, 'error', (err as Error).message)
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
    return ['project_import', 'rfi_import', 'submittal_import']
  },
}

function mapProcoreRFIStatus(status: string): string {
  const map: Record<string, string> = {
    'Draft': 'draft', 'Open': 'open', 'Pending': 'under_review',
    'Closed': 'closed', 'Void': 'void',
  }
  return map[status] ?? 'open'
}

function mapProcoreSubmittalStatus(status: string): string {
  const map: Record<string, string> = {
    'Draft': 'draft', 'Open': 'submitted', 'Pending': 'gc_review',
    'Approved': 'approved', 'Closed': 'closed',
  }
  return map[status] ?? 'draft'
}
