// Microsoft Teams Integration: Incoming webhook connector for channel notifications.
// Same notification types as Slack: RFI responses, submittal reviews, daily log approvals, schedule changes.

import { supabase } from '../../lib/supabase'
import { fromTable, asRow } from '../../lib/db/queries'
import { rateLimitedFetch } from './rateLimiter'
import {
  type IntegrationProvider,
  type SyncResult,
  type IntegrationStatus,
  logSyncResult,
  updateIntegrationStatus,
  createIntegrationRecord,
} from './base'

// ── Adaptive Card Helpers ───────────────────────────────
// Teams uses Adaptive Cards (JSON schema)

interface AdaptiveCard {
  type: 'AdaptiveCard'
  $schema: string
  version: string
  body: Array<Record<string, unknown>>
  actions?: Array<Record<string, unknown>>
}

function createCard(body: Array<Record<string, unknown>>, actions?: Array<Record<string, unknown>>): AdaptiveCard {
  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.4',
    body,
    actions,
  }
}

function heading(text: string, color?: string): Record<string, unknown> {
  return {
    type: 'TextBlock',
    text,
    size: 'Large',
    weight: 'Bolder',
    ...(color ? { color } : {}),
  }
}

function textBlock(text: string, opts?: { subtle?: boolean; size?: string; weight?: string }): Record<string, unknown> {
  return {
    type: 'TextBlock',
    text,
    wrap: true,
    ...(opts?.subtle ? { isSubtle: true } : {}),
    ...(opts?.size ? { size: opts.size } : {}),
    ...(opts?.weight ? { weight: opts.weight } : {}),
  }
}

function factSet(facts: Array<{ title: string; value: string }>): Record<string, unknown> {
  return { type: 'FactSet', facts }
}

// ── Send to Teams ───────────────────────────────────────

async function postToTeams(webhookUrl: string, card: AdaptiveCard, summary: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await rateLimitedFetch('teams', webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'message',
        attachments: [{
          contentType: 'application/vnd.microsoft.card.adaptive',
          contentUrl: null,
          content: card,
        }],
        summary,
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      return { success: false, error: `Teams webhook error ${response.status}: ${body}` }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// ── Provider ────────────────────────────────────────────

export const teamsProvider: IntegrationProvider = {
  type: 'teams',

  async connect(projectId, credentials) {
    const { webhookUrl, channelName } = credentials as { webhookUrl: string; channelName?: string }
    if (!webhookUrl) {
      return { integrationId: '', error: 'Teams Webhook URL is required' }
    }

    // Verify by sending test message
    const card = createCard([
      heading('SiteSync PM Connected'),
      textBlock('You will receive project notifications in this channel.'),
    ])
    const test = await postToTeams(webhookUrl, card, 'SiteSync PM connected')

    if (!test.success) {
      return { integrationId: '', error: test.error ?? 'Failed to verify Teams webhook' }
    }

    const { data: { user } } = await supabase.auth.getUser()
    const integrationId = await createIntegrationRecord('teams', projectId, {
      webhookUrl,
      channelName: channelName ?? 'Unknown',
      notifications: ['rfi_response', 'submittal_review', 'daily_log_approval', 'schedule_change'],
    }, user?.id ?? '')

    return { integrationId }
  },

  async disconnect(integrationId) {
    await updateIntegrationStatus(integrationId, 'disconnected')
  },

  async sync(integrationId) {
    const result: SyncResult = { success: true, recordsSynced: 0, recordsFailed: 0, errors: [] }
    await logSyncResult(integrationId, result, 'export')
    await updateIntegrationStatus(integrationId, 'connected')
    return result
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
    return ['rfi_notifications', 'submittal_notifications', 'daily_log_notifications', 'schedule_notifications']
  },
}

// ── Public Send Functions ───────────────────────────────

export async function sendTeamsRFINotification(
  integrationId: string,
  rfi: { number: string; title: string; respondedBy: string; status: string },
): Promise<{ success: boolean; error?: string }> {
  const { data } = await fromTable('integrations').select('config').eq('id' as never, integrationId).single()
  const integration = asRow<{ config: Record<string, string> | null }>(data)
  const config = integration?.config ?? null
  if (!config?.webhookUrl) return { success: false, error: 'Teams not configured' }

  const card = createCard([
    heading(`RFI ${rfi.number} Response`),
    textBlock(rfi.title, { weight: 'Bolder' }),
    factSet([
      { title: 'Responded By', value: rfi.respondedBy },
      { title: 'Status', value: rfi.status },
    ]),
    textBlock('Sent from SiteSync PM', { subtle: true, size: 'Small' }),
  ])

  return postToTeams(config.webhookUrl, card, `RFI ${rfi.number} response`)
}

export async function sendTeamsSubmittalNotification(
  integrationId: string,
  sub: { number: string; title: string; reviewedBy: string; status: string; specSection: string },
): Promise<{ success: boolean; error?: string }> {
  const { data } = await fromTable('integrations').select('config').eq('id' as never, integrationId).single()
  const integration = asRow<{ config: Record<string, string> | null }>(data)
  const config = integration?.config ?? null
  if (!config?.webhookUrl) return { success: false, error: 'Teams not configured' }

  const statusColor = sub.status === 'approved' ? 'Good' : sub.status === 'rejected' ? 'Attention' : 'Warning'
  const card = createCard([
    heading(`Submittal ${sub.number} ${sub.status.replace(/_/g, ' ')}`, statusColor),
    textBlock(sub.title, { weight: 'Bolder' }),
    factSet([
      { title: 'Spec Section', value: sub.specSection },
      { title: 'Reviewed By', value: sub.reviewedBy },
    ]),
    textBlock('Sent from SiteSync PM', { subtle: true, size: 'Small' }),
  ])

  return postToTeams(config.webhookUrl, card, `Submittal ${sub.number} ${sub.status}`)
}
