// Slack Integration: Webhook + bot for construction notifications
// Sends real-time alerts for RFI responses, submittal reviews, daily log approvals, schedule changes.

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

// ── Slack Block Kit Helpers ─────────────────────────────

interface SlackBlock {
  type: string
  text?: { type: string; text: string; emoji?: boolean }
  elements?: Array<{ type: string; text?: { type: string; text: string }; url?: string }>
  fields?: Array<{ type: string; text: string }>
  accessory?: Record<string, unknown>
}

function headerBlock(text: string): SlackBlock {
  return { type: 'header', text: { type: 'plain_text', text, emoji: true } }
}

function sectionBlock(text: string): SlackBlock {
  return { type: 'section', text: { type: 'mrkdwn', text } }
}

function fieldsBlock(fields: Array<{ label: string; value: string }>): SlackBlock {
  return {
    type: 'section',
    fields: fields.map((f) => ({ type: 'mrkdwn', text: `*${f.label}*\n${f.value}` })),
  }
}

function dividerBlock(): SlackBlock {
  return { type: 'divider' }
}

function contextBlock(text: string): SlackBlock {
  return {
    type: 'context',
    elements: [{ type: 'mrkdwn', text }],
  }
}

// ── Notification Builders ───────────────────────────────

function rfiResponseBlocks(rfi: { number: string; title: string; respondedBy: string; status: string; projectUrl?: string }): SlackBlock[] {
  return [
    headerBlock(`RFI ${rfi.number} Response`),
    sectionBlock(`*${rfi.title}*`),
    fieldsBlock([
      { label: 'Responded By', value: rfi.respondedBy },
      { label: 'Status', value: rfi.status },
    ]),
    ...(rfi.projectUrl ? [{
      type: 'actions' as const,
      elements: [{ type: 'button', text: { type: 'plain_text', text: 'View in SiteSync' }, url: rfi.projectUrl }],
    }] : []),
    contextBlock('Sent from SiteSync PM'),
  ]
}

function submittalReviewBlocks(sub: { number: string; title: string; reviewedBy: string; status: string; specSection: string }): SlackBlock[] {
  const emoji = sub.status === 'approved' ? ':white_check_mark:' : sub.status === 'rejected' ? ':x:' : ':hourglass:'
  return [
    headerBlock(`${emoji} Submittal ${sub.number} ${sub.status.replace(/_/g, ' ')}`),
    sectionBlock(`*${sub.title}*`),
    fieldsBlock([
      { label: 'Spec Section', value: sub.specSection },
      { label: 'Reviewed By', value: sub.reviewedBy },
      { label: 'Status', value: sub.status.replace(/_/g, ' ').toUpperCase() },
    ]),
    contextBlock('Sent from SiteSync PM'),
  ]
}

function dailyLogApprovalBlocks(log: { date: string; approvedBy: string; workers: number; incidents: number }): SlackBlock[] {
  return [
    headerBlock(`:clipboard: Daily Log Approved: ${log.date}`),
    fieldsBlock([
      { label: 'Approved By', value: log.approvedBy },
      { label: 'Workers', value: String(log.workers) },
      { label: 'Incidents', value: log.incidents > 0 ? `:warning: ${log.incidents}` : '0' },
    ]),
    contextBlock('Sent from SiteSync PM'),
  ]
}

function scheduleChangeBlocks(change: { task: string; field: string; oldValue: string; newValue: string; changedBy: string }): SlackBlock[] {
  return [
    headerBlock(':calendar: Schedule Change'),
    sectionBlock(`*${change.task}*`),
    fieldsBlock([
      { label: 'Changed', value: `${change.field}: ${change.oldValue} → ${change.newValue}` },
      { label: 'By', value: change.changedBy },
    ]),
    contextBlock('Sent from SiteSync PM'),
  ]
}

// ── Send to Slack ───────────────────────────────────────

async function postToSlack(webhookUrl: string, blocks: SlackBlock[], text: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await rateLimitedFetch('slack', webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, blocks }),
    })

    if (!response.ok) {
      const body = await response.text()
      return { success: false, error: `Slack webhook error ${response.status}: ${body}` }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// ── Provider ────────────────────────────────────────────

export const slackProvider: IntegrationProvider = {
  type: 'slack',

  async connect(projectId, credentials) {
    const { webhookUrl, channelName } = credentials as { webhookUrl: string; channelName?: string }
    if (!webhookUrl) {
      return { integrationId: '', error: 'Webhook URL is required' }
    }

    // Verify webhook works by sending a test message
    const test = await postToSlack(webhookUrl, [
      sectionBlock(':white_check_mark: *SiteSync PM connected!*\nYou will receive project notifications in this channel.'),
    ], 'SiteSync PM connected')

    if (!test.success) {
      return { integrationId: '', error: test.error ?? 'Failed to verify Slack webhook' }
    }

    const { data: { user } } = await supabase.auth.getUser()
    const integrationId = await createIntegrationRecord('slack', projectId, {
      webhookUrl,
      channelName: channelName ?? 'Unknown',
      notifications: ['rfi_response', 'submittal_review', 'daily_log_approval', 'schedule_change'],
    }, user?.id ?? '')

    return { integrationId }
  },

  async disconnect(integrationId) {
    await updateIntegrationStatus(integrationId, 'disconnected')
  },

  async sync(integrationId, _direction) {
    // Slack is event-driven, not sync-based
    const result: SyncResult = {
      success: true,
      recordsSynced: 0,
      recordsFailed: 0,
      errors: [],
    }
    await logSyncResult(integrationId, result, 'export')
    await updateIntegrationStatus(integrationId, 'connected')
    return result
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
    return ['rfi_notifications', 'submittal_notifications', 'daily_log_notifications', 'schedule_notifications']
  },
}

// ── Public Send Functions ───────────────────────────────

export async function sendSlackRFINotification(
  integrationId: string,
  rfi: { number: string; title: string; respondedBy: string; status: string; projectUrl?: string },
): Promise<{ success: boolean; error?: string }> {
  const { data } = await supabase.from('integrations').select('config').eq('id', integrationId).single()
  const config = data?.config as Record<string, string> | null
  if (!config?.webhookUrl) return { success: false, error: 'Slack not configured' }
  return postToSlack(config.webhookUrl, rfiResponseBlocks(rfi), `RFI ${rfi.number} response from ${rfi.respondedBy}`)
}

export async function sendSlackSubmittalNotification(
  integrationId: string,
  sub: { number: string; title: string; reviewedBy: string; status: string; specSection: string },
): Promise<{ success: boolean; error?: string }> {
  const { data } = await supabase.from('integrations').select('config').eq('id', integrationId).single()
  const config = data?.config as Record<string, string> | null
  if (!config?.webhookUrl) return { success: false, error: 'Slack not configured' }
  return postToSlack(config.webhookUrl, submittalReviewBlocks(sub), `Submittal ${sub.number} ${sub.status}`)
}

export async function sendSlackDailyLogNotification(
  integrationId: string,
  log: { date: string; approvedBy: string; workers: number; incidents: number },
): Promise<{ success: boolean; error?: string }> {
  const { data } = await supabase.from('integrations').select('config').eq('id', integrationId).single()
  const config = data?.config as Record<string, string> | null
  if (!config?.webhookUrl) return { success: false, error: 'Slack not configured' }
  return postToSlack(config.webhookUrl, dailyLogApprovalBlocks(log), `Daily log approved: ${log.date}`)
}

export async function sendSlackScheduleChangeNotification(
  integrationId: string,
  change: { task: string; field: string; oldValue: string; newValue: string; changedBy: string },
): Promise<{ success: boolean; error?: string }> {
  const { data } = await supabase.from('integrations').select('config').eq('id', integrationId).single()
  const config = data?.config as Record<string, string> | null
  if (!config?.webhookUrl) return { success: false, error: 'Slack not configured' }
  return postToSlack(config.webhookUrl, scheduleChangeBlocks(change), `Schedule change: ${change.task}`)
}
