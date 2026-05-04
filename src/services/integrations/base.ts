// Base integration framework.
// All external service connectors implement IntegrationProvider.


import { fromTable } from '../../lib/db/queries'

// ── Types ────────────────────────────────────────────────

export type IntegrationStatus = 'connected' | 'disconnected' | 'syncing' | 'error'

export interface SyncResult {
  success: boolean
  recordsSynced: number
  recordsFailed: number
  errors: string[]
  details?: Record<string, number> // e.g. { rfis: 12, submittals: 5 }
}

export interface IntegrationProvider {
  readonly type: string

  // Connect: authenticate and store credentials
  connect(projectId: string, credentials: Record<string, unknown>): Promise<{ integrationId: string; error?: string }>

  // Disconnect: revoke tokens and mark disconnected
  disconnect(integrationId: string): Promise<void>

  // Sync: run the data sync operation
  sync(integrationId: string, direction: 'import' | 'export' | 'bidirectional'): Promise<SyncResult>

  // Status: check if connection is healthy
  getStatus(integrationId: string): Promise<{ status: IntegrationStatus; lastSync: string | null; error?: string }>

  // Capabilities this provider supports
  getCapabilities(): string[]
}

// ── Shared Helpers ───────────────────────────────────────

export async function logSyncResult(integrationId: string, result: SyncResult, direction: string): Promise<void> {
  await fromTable('integration_sync_log').insert({
    integration_id: integrationId,
    direction,
    records_synced: result.recordsSynced,
    records_failed: result.recordsFailed,
    status: result.success ? 'success' : (result.recordsFailed > 0 ? 'partial' : 'failed'),
    error_details: result.errors.length > 0 ? result.errors : null,
    started_at: new Date().toISOString(),
    completed_at: new Date().toISOString(),
  } as never)
}

export async function updateIntegrationStatus(integrationId: string, status: IntegrationStatus, errorLog?: string): Promise<void> {
  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
  if (status === 'connected' || status === 'syncing') {
    updates.last_sync = new Date().toISOString()
  }
  if (errorLog) {
    updates.error_log = [errorLog]
  }
  await fromTable('integrations').update(updates as never).eq('id' as never, integrationId)
}

export async function createIntegrationRecord(
  type: string,
  projectId: string,
  config: Record<string, unknown>,
  userId: string
): Promise<string> {
  const { data, error } = await fromTable('integrations').insert({
    type,
    status: 'connected',
    config,
    created_by: userId,
    last_sync: new Date().toISOString(),
  } as never).select('id').single()
  if (error) throw error
  return data.id
}

// ── Provider Registry ────────────────────────────────────

export interface IntegrationMeta {
  name: string
  description: string
  category: 'accounting' | 'scheduling' | 'documents' | 'communication' | 'storage' | 'automation'
  capabilities: string[]
  authType: 'oauth2' | 'api_key' | 'credentials' | 'none'
  fields: Array<{ key: string; label: string; type: 'text' | 'password' | 'url'; required: boolean; placeholder?: string }>
}

export const INTEGRATION_REGISTRY: Record<string, IntegrationMeta> = {
  procore_import: {
    name: 'Procore',
    description: 'Import projects, RFIs, and submittals from Procore',
    category: 'documents',
    capabilities: ['project_import', 'rfi_import', 'submittal_import'],
    authType: 'api_key',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true, placeholder: 'Procore API key' },
      { key: 'companyId', label: 'Company ID', type: 'text', required: true, placeholder: 'Procore company ID' },
    ],
  },
  ms_project: {
    name: 'Microsoft Project',
    description: 'Import and export project schedules (.mpp, .xml)',
    category: 'scheduling',
    capabilities: ['schedule_import', 'schedule_export'],
    authType: 'none',
    fields: [],
  },
  quickbooks: {
    name: 'QuickBooks Online',
    description: 'Sync budget items and change orders as journal entries',
    category: 'accounting',
    capabilities: ['cost_sync', 'invoice_export', 'journal_entry'],
    authType: 'oauth2',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', required: true, placeholder: 'QuickBooks OAuth client ID' },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true, placeholder: 'Client secret' },
      { key: 'realmId', label: 'Realm ID (Company)', type: 'text', required: true, placeholder: 'QuickBooks company realm ID' },
    ],
  },
  email_resend: {
    name: 'Email (Resend)',
    description: 'Send RFI responses, submittal transmittals, and daily log summaries',
    category: 'communication',
    capabilities: ['rfi_email', 'submittal_email', 'daily_log_email'],
    authType: 'api_key',
    fields: [
      { key: 'apiKey', label: 'Resend API Key', type: 'password', required: true, placeholder: 're_xxxxxxxxxxxxx' },
      { key: 'fromEmail', label: 'From Email', type: 'text', required: true, placeholder: 'notifications@yourdomain.com' },
      { key: 'fromName', label: 'From Name', type: 'text', required: false, placeholder: 'SiteSync PM' },
    ],
  },
  sage: {
    name: 'Sage 300 CRE',
    description: 'Import and export accounting data with Sage',
    category: 'accounting',
    capabilities: ['cost_import', 'payapp_export'],
    authType: 'credentials',
    fields: [
      { key: 'serverUrl', label: 'Server URL', type: 'url', required: true },
      { key: 'username', label: 'Username', type: 'text', required: true },
      { key: 'password', label: 'Password', type: 'password', required: true },
    ],
  },
  autodesk_bim360: {
    name: 'Autodesk Build',
    description: 'Sync BIM models, drawings, and issues',
    category: 'documents',
    capabilities: ['model_import', 'drawing_sync', 'issue_sync'],
    authType: 'oauth2',
    fields: [
      { key: 'clientId', label: 'Client ID', type: 'text', required: true },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
    ],
  },
  google_drive: {
    name: 'Google Drive',
    description: 'Browse and sync files from Google Drive',
    category: 'storage',
    capabilities: ['file_sync'],
    authType: 'oauth2',
    fields: [],
  },
  dropbox: {
    name: 'Dropbox',
    description: 'Browse and sync files from Dropbox',
    category: 'storage',
    capabilities: ['file_sync'],
    authType: 'oauth2',
    fields: [],
  },
  bluebeam: {
    name: 'Bluebeam Revu',
    description: 'Sync markups and document reviews',
    category: 'documents',
    capabilities: ['markup_sync', 'review_sync'],
    authType: 'api_key',
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'password', required: true },
    ],
  },
  docusign: {
    name: 'DocuSign',
    description: 'Send documents for electronic signature',
    category: 'documents',
    capabilities: ['esignature'],
    authType: 'oauth2',
    fields: [
      { key: 'clientId', label: 'Integration Key', type: 'text', required: true },
      { key: 'clientSecret', label: 'Client Secret', type: 'password', required: true },
    ],
  },
  slack: {
    name: 'Slack',
    description: 'Send project notifications to Slack channels',
    category: 'communication',
    capabilities: ['rfi_notifications', 'submittal_notifications', 'daily_log_notifications', 'schedule_notifications'],
    authType: 'none',
    fields: [
      { key: 'webhookUrl', label: 'Webhook URL', type: 'url', required: true, placeholder: 'https://hooks.slack.com/services/...' },
      { key: 'channelName', label: 'Channel Name', type: 'text', required: false, placeholder: '#construction' },
    ],
  },
  teams: {
    name: 'Microsoft Teams',
    description: 'Send project notifications to Teams channels',
    category: 'communication',
    capabilities: ['rfi_notifications', 'submittal_notifications', 'daily_log_notifications', 'schedule_notifications'],
    authType: 'none',
    fields: [
      { key: 'webhookUrl', label: 'Incoming Webhook URL', type: 'url', required: true, placeholder: 'https://outlook.office.com/webhook/...' },
      { key: 'channelName', label: 'Channel Name', type: 'text', required: false, placeholder: 'General' },
    ],
  },
  sharepoint: {
    name: 'SharePoint / OneDrive',
    description: 'Sync files with SharePoint document libraries or OneDrive',
    category: 'storage',
    capabilities: ['file_sync', 'drawing_sync', 'sharepoint_library'],
    authType: 'oauth2',
    fields: [
      { key: 'siteUrl', label: 'SharePoint Site URL (leave blank for OneDrive)', type: 'url', required: false, placeholder: 'https://contoso.sharepoint.com/sites/construction' },
    ],
  },
  primavera_p6: {
    name: 'Primavera P6',
    description: 'Import schedules from Oracle Primavera P6 (.xer files)',
    category: 'scheduling',
    capabilities: ['schedule_import', 'xer_import'],
    authType: 'none',
    fields: [],
  },
  zapier_webhook: {
    name: 'Zapier / Webhooks',
    description: 'Connect to 5000+ apps via custom webhooks',
    category: 'automation',
    capabilities: ['webhook_receive', 'webhook_send'],
    authType: 'none',
    fields: [
      { key: 'webhookUrl', label: 'Webhook URL', type: 'url', required: false, placeholder: 'https://hooks.zapier.com/...' },
    ],
  },
}
