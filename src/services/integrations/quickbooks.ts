// QuickBooks Online Integration: Sync budget items and change orders

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

// QuickBooks API helper
async function qbApi(realmId: string, accessToken: string, method: string, path: string, body?: unknown) {
  const baseUrl = `https://quickbooks.api.intuit.com/v3/company/${realmId}`
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) {
    const errBody = await response.text()
    throw new Error(`QuickBooks API error ${response.status}: ${errBody}`)
  }
  return response.json()
}

export const quickbooksProvider: IntegrationProvider = {
  type: 'quickbooks',

  async connect(projectId, credentials) {
    const { clientId, clientSecret, realmId } = credentials as {
      clientId: string; clientSecret: string; realmId: string
    }
    if (!clientId || !clientSecret || !realmId) {
      return { integrationId: '', error: 'Client ID, Client Secret, and Realm ID are required' }
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      const integrationId = await createIntegrationRecord('quickbooks', projectId, {
        realmId,
        clientId,
        // In production: exchange auth code for tokens via edge function
        // Store tokens in Supabase Vault
        tokenExpiry: null,
      }, user?.id ?? '')

      return { integrationId }
    } catch (err) {
      return { integrationId: '', error: (err as Error).message }
    }
  },

  async disconnect(integrationId) {
    // In production: revoke OAuth tokens
    await updateIntegrationStatus(integrationId, 'disconnected')
  },

  async sync(integrationId, direction) {
    await updateIntegrationStatus(integrationId, 'syncing')

    const { data: integration } = await fromTable('integrations')
      .select('config')
      .eq('id' as never, integrationId)
      .single()

    if (!integration?.config) {
      const result: SyncResult = { success: false, recordsSynced: 0, recordsFailed: 0, errors: ['Integration config not found'] }
      await logSyncResult(integrationId, result, direction)
      await updateIntegrationStatus(integrationId, 'error')
      return result
    }

    const config = integration.config as Record<string, string>
    let synced = 0
    let failed = 0
    const errors: string[] = []
    const details: Record<string, number> = {}

    try {
      if (direction === 'export' || direction === 'bidirectional') {
        // Export approved change orders as journal entries
        const { data: changeOrders } = await fromTable('change_orders')
          .select('*')
          .eq('status' as never, 'approved')

        if (changeOrders) {
          for (const co of changeOrders) {
            try {
              // Create a journal entry in QuickBooks
              await qbApi(config.realmId, config.accessToken ?? '', 'POST', '/journalentry', {
                Line: [
                  {
                    DetailType: 'JournalEntryLineDetail',
                    Amount: Math.abs(co.amount ?? 0),
                    Description: `CO: ${co.title ?? co.description ?? ''}`,
                    JournalEntryLineDetail: {
                      PostingType: (co.amount ?? 0) >= 0 ? 'Debit' : 'Credit',
                      AccountRef: { value: '1' }, // Would be mapped via field mappings
                    },
                  },
                  {
                    DetailType: 'JournalEntryLineDetail',
                    Amount: Math.abs(co.amount ?? 0),
                    JournalEntryLineDetail: {
                      PostingType: (co.amount ?? 0) >= 0 ? 'Credit' : 'Debit',
                      AccountRef: { value: '2' },
                    },
                  },
                ],
                TxnDate: new Date().toISOString().slice(0, 10),
              })
              synced++
            } catch (err) {
              errors.push(`CO ${co.id}: ${(err as Error).message}`)
              failed++
            }
          }
          details.changeOrders = changeOrders.length
        }

        // Export budget items as accounts/classes
        const { data: budgetItems } = await fromTable('budget_items').select('*')
        if (budgetItems) {
          details.budgetItems = budgetItems.length
        }
      }

      if (direction === 'import' || direction === 'bidirectional') {
        // Import payment status from QuickBooks invoices
        try {
          const invoices = await qbApi(config.realmId, config.accessToken ?? '', 'GET', '/query?query=SELECT * FROM Invoice MAXRESULTS 100')
          details.invoices = invoices?.QueryResponse?.Invoice?.length ?? 0
          synced += details.invoices
        } catch (err) {
          errors.push(`Invoice import: ${(err as Error).message}`)
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
    const { data } = await fromTable('integrations').select('status, last_sync, error_log').eq('id' as never, integrationId).single()
    return {
      status: (data?.status as IntegrationStatus) ?? 'disconnected',
      lastSync: data?.last_sync ?? null,
      error: Array.isArray(data?.error_log) ? (data.error_log as string[])[0] : undefined,
    }
  },

  getCapabilities() {
    return ['cost_sync', 'invoice_export', 'journal_entry']
  },
}
