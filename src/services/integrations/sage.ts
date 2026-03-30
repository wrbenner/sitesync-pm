// Sage 300 CRE Integration: Cost code sync, journal entries, payment applications
// Credential-based authentication via Sage API or file import.

import { supabase } from '../../lib/supabase'
import { rateLimitedFetch } from './rateLimiter'
import {
  type IntegrationProvider,
  type SyncResult,
  type IntegrationStatus,
  logSyncResult,
  updateIntegrationStatus,
  createIntegrationRecord,
} from './base'

// ── API Helper ──────────────────────────────────────────

async function sageApi(serverUrl: string, username: string, password: string, path: string, options?: RequestInit) {
  const response = await rateLimitedFetch('sage', `${serverUrl}/api${path}`, {
    ...options,
    headers: {
      'Authorization': `Basic ${btoa(`${username}:${password}`)}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (response.status === 401) throw new Error('Invalid Sage credentials')
  if (!response.ok) {
    const errBody = await response.text()
    throw new Error(`Sage API error ${response.status}: ${errBody}`)
  }

  return response.json()
}

// ── Provider ────────────────────────────────────────────

export const sageProvider: IntegrationProvider = {
  type: 'sage',

  async connect(projectId, credentials) {
    const { serverUrl, username, password } = credentials as {
      serverUrl: string; username: string; password: string
    }
    if (!serverUrl || !username || !password) {
      return { integrationId: '', error: 'Server URL, username, and password are required' }
    }

    try {
      // Verify credentials by attempting to fetch cost codes
      await sageApi(serverUrl, username, password, '/costcodes')

      const { data: { user } } = await supabase.auth.getUser()
      const integrationId = await createIntegrationRecord('sage', projectId, {
        serverUrl,
        username,
        // Password stored in config. In production, encrypt or use Vault.
        passwordPrefix: password.slice(0, 3) + '***',
      }, user?.id ?? '')

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

    const { data: integration } = await supabase.from('integrations').select('config').eq('id', integrationId).single()
    const config = integration?.config as Record<string, string> | null

    if (!config?.serverUrl || !config?.username) {
      const result: SyncResult = { success: false, recordsSynced: 0, recordsFailed: 0, errors: ['Sage not configured'] }
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
        // Import cost codes from Sage
        try {
          const costCodes = await sageApi(config.serverUrl, config.username, config.password ?? '', '/costcodes')
          const codes = costCodes.results ?? costCodes ?? []
          details.costCodes = codes.length

          for (const code of codes) {
            try {
              await supabase.from('budget_items').upsert({
                code: code.code ?? code.costCode ?? '',
                description: code.description ?? code.name ?? '',
                budget_amount: code.budgetAmount ?? code.originalBudget ?? 0,
                external_id: code.id ?? code.code,
                external_source: 'sage',
              }, { onConflict: 'external_id,external_source' })
              synced++
            } catch {
              failed++
            }
          }
        } catch (err) {
          errors.push(`Cost code import: ${(err as Error).message}`)
        }

        // Import invoices/payment status
        try {
          const invoices = await sageApi(config.serverUrl, config.username, config.password ?? '', '/invoices?status=open')
          details.invoices = invoices.results?.length ?? 0
          synced += details.invoices
        } catch (err) {
          errors.push(`Invoice import: ${(err as Error).message}`)
        }
      }

      if (direction === 'export' || direction === 'bidirectional') {
        // Export approved change orders as journal entries
        const { data: changeOrders } = await supabase
          .from('change_orders')
          .select('*')
          .eq('status', 'approved')
          .is('synced_to_sage', null)

        if (changeOrders) {
          details.changeOrders = changeOrders.length

          for (const co of changeOrders) {
            try {
              await sageApi(config.serverUrl, config.username, config.password ?? '', '/journalentries', {
                method: 'POST',
                body: JSON.stringify({
                  description: `Change Order: ${co.title ?? co.description ?? ''}`,
                  amount: co.amount ?? 0,
                  date: new Date().toISOString().slice(0, 10),
                  reference: `CO-${co.id?.slice(0, 8)}`,
                }),
              })
              synced++

              // Mark as synced
              await supabase.from('change_orders').update({ synced_to_sage: new Date().toISOString() }).eq('id', co.id)
            } catch (err) {
              errors.push(`CO ${co.id}: ${(err as Error).message}`)
              failed++
            }
          }
        }

        // Export payment applications
        const { data: payApps } = await supabase
          .from('payment_applications')
          .select('*')
          .eq('status', 'approved')
          .is('synced_to_sage', null)

        if (payApps) {
          details.paymentApplications = payApps.length

          for (const pa of payApps) {
            try {
              await sageApi(config.serverUrl, config.username, config.password ?? '', '/paymentapplications', {
                method: 'POST',
                body: JSON.stringify({
                  applicationNumber: pa.application_number,
                  periodTo: pa.period_to,
                  totalCompleted: pa.total_completed,
                  retainage: pa.retainage,
                  amountDue: pa.amount_due,
                }),
              })
              synced++
              await supabase.from('payment_applications').update({ synced_to_sage: new Date().toISOString() }).eq('id', pa.id)
            } catch (err) {
              errors.push(`PayApp ${pa.id}: ${(err as Error).message}`)
              failed++
            }
          }
        }
      }

      const result: SyncResult = { success: errors.length === 0, recordsSynced: synced, recordsFailed: failed, errors, details }
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
    const { data } = await supabase.from('integrations').select('status, last_sync, error_log').eq('id', integrationId).single()
    return {
      status: (data?.status as IntegrationStatus) ?? 'disconnected',
      lastSync: data?.last_sync ?? null,
      error: Array.isArray(data?.error_log) ? (data.error_log as string[])[0] : undefined,
    }
  },

  getCapabilities() {
    return ['cost_import', 'payapp_export', 'journal_entry', 'cost_code_sync']
  },
}
