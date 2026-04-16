// Email Integration (Resend): Send RFI responses, submittal transmittals, daily log summaries

import { supabase } from '../../lib/supabase'
import { colors } from '../../styles/theme'
import {
  type IntegrationProvider,
  type SyncResult,
  type IntegrationStatus,
  logSyncResult,
  updateIntegrationStatus,
  createIntegrationRecord,
} from './base'

interface EmailParams {
  to: string[]
  subject: string
  html: string
}

async function sendEmail(apiKey: string, from: string, params: EmailParams): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      return { success: false, error: `Resend API error ${response.status}: ${body}` }
    }

    return { success: true }
  } catch (err) {
    return { success: false, error: (err as Error).message }
  }
}

// ── Email Templates ──────────────────────────────────────

function rfiResponseEmailHtml(rfi: { number: string; title: string; response: string; respondedBy: string; projectName: string }): string {
  return `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
      <div style="border-bottom: 2px solid ${colors.primaryOrange}; padding-bottom: 16px; margin-bottom: 24px;">
        <h2 style="color: ${colors.textPrimary}; margin: 0;">SiteSync PM</h2>
        <p style="color: ${colors.textSecondary}; margin: 4px 0 0; font-size: 13px;">${rfi.projectName}</p>
      </div>
      <h3 style="color: ${colors.textPrimary}; margin: 0 0 8px;">RFI ${rfi.number} Response</h3>
      <p style="color: ${colors.textSecondary}; font-size: 14px; margin: 0 0 16px;">${rfi.title}</p>
      <div style="background: ${colors.surfacePage}; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
        <p style="color: ${colors.textSecondary}; font-size: 12px; margin: 0 0 4px;">Response from ${rfi.respondedBy}:</p>
        <p style="color: ${colors.textPrimary}; font-size: 14px; margin: 0; line-height: 1.6;">${rfi.response}</p>
      </div>
      <p style="color: ${colors.textTertiary}; font-size: 12px; margin: 24px 0 0; border-top: 1px solid ${colors.borderDefault}; padding-top: 12px;">
        Sent via SiteSync PM. Do not reply to this email.
      </p>
    </div>
  `
}

function submittalTransmittalHtml(submittal: { number: string; title: string; status: string; specSection: string; projectName: string }): string {
  const statusColor = submittal.status === 'approved' ? colors.statusActive : submittal.status === 'rejected' ? colors.statusCritical : colors.statusPending
  return `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
      <div style="border-bottom: 2px solid ${colors.primaryOrange}; padding-bottom: 16px; margin-bottom: 24px;">
        <h2 style="color: ${colors.textPrimary}; margin: 0;">SiteSync PM</h2>
        <p style="color: ${colors.textSecondary}; margin: 4px 0 0; font-size: 13px;">${submittal.projectName}</p>
      </div>
      <h3 style="color: ${colors.textPrimary}; margin: 0 0 8px;">Submittal Transmittal</h3>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
        <tr><td style="padding: 8px; color: ${colors.textSecondary}; font-size: 13px; border-bottom: 1px solid ${colors.borderDefault};">Submittal #</td><td style="padding: 8px; color: ${colors.textPrimary}; font-size: 13px; border-bottom: 1px solid ${colors.borderDefault}; font-weight: 600;">${submittal.number}</td></tr>
        <tr><td style="padding: 8px; color: ${colors.textSecondary}; font-size: 13px; border-bottom: 1px solid ${colors.borderDefault};">Title</td><td style="padding: 8px; color: ${colors.textPrimary}; font-size: 13px; border-bottom: 1px solid ${colors.borderDefault};">${submittal.title}</td></tr>
        <tr><td style="padding: 8px; color: ${colors.textSecondary}; font-size: 13px; border-bottom: 1px solid ${colors.borderDefault};">Spec Section</td><td style="padding: 8px; color: ${colors.textPrimary}; font-size: 13px; border-bottom: 1px solid ${colors.borderDefault};">${submittal.specSection}</td></tr>
        <tr><td style="padding: 8px; color: ${colors.textSecondary}; font-size: 13px;">Status</td><td style="padding: 8px;"><span style="color: ${statusColor}; font-weight: 600; font-size: 13px;">${submittal.status.replace(/_/g, ' ').toUpperCase()}</span></td></tr>
      </table>
      <p style="color: ${colors.textTertiary}; font-size: 12px; margin: 24px 0 0; border-top: 1px solid ${colors.borderDefault}; padding-top: 12px;">
        Sent via SiteSync PM. Do not reply to this email.
      </p>
    </div>
  `
}

function dailyLogSummaryHtml(log: { date: string; workers: number; manHours: number; incidents: number; weather: string; summary: string; projectName: string }): string {
  return `
    <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
      <div style="border-bottom: 2px solid ${colors.primaryOrange}; padding-bottom: 16px; margin-bottom: 24px;">
        <h2 style="color: ${colors.textPrimary}; margin: 0;">SiteSync PM</h2>
        <p style="color: ${colors.textSecondary}; margin: 4px 0 0; font-size: 13px;">${log.projectName}</p>
      </div>
      <h3 style="color: ${colors.textPrimary}; margin: 0 0 16px;">Daily Log Summary: ${log.date}</h3>
      <div style="display: flex; gap: 16px; margin-bottom: 20px;">
        <div style="flex: 1; background: ${colors.surfacePage}; border-radius: 8px; padding: 12px; text-align: center;">
          <p style="font-size: 24px; font-weight: 700; color: ${colors.textPrimary}; margin: 0;">${log.workers}</p>
          <p style="font-size: 12px; color: ${colors.textSecondary}; margin: 4px 0 0;">Workers</p>
        </div>
        <div style="flex: 1; background: ${colors.surfacePage}; border-radius: 8px; padding: 12px; text-align: center;">
          <p style="font-size: 24px; font-weight: 700; color: ${colors.textPrimary}; margin: 0;">${log.manHours}</p>
          <p style="font-size: 12px; color: ${colors.textSecondary}; margin: 4px 0 0;">Man Hours</p>
        </div>
        <div style="flex: 1; background: ${log.incidents > 0 ? colors.statusCriticalSubtle : colors.surfacePage}; border-radius: 8px; padding: 12px; text-align: center;">
          <p style="font-size: 24px; font-weight: 700; color: ${log.incidents > 0 ? colors.statusCritical : colors.statusActive}; margin: 0;">${log.incidents}</p>
          <p style="font-size: 12px; color: ${colors.textSecondary}; margin: 4px 0 0;">Incidents</p>
        </div>
      </div>
      ${log.weather ? `<p style="color: ${colors.textSecondary}; font-size: 13px; margin: 0 0 12px;">Weather: ${log.weather}</p>` : ''}
      ${log.summary ? `<p style="color: ${colors.textPrimary}; font-size: 14px; margin: 0; line-height: 1.6;">${log.summary}</p>` : ''}
      <p style="color: ${colors.textTertiary}; font-size: 12px; margin: 24px 0 0; border-top: 1px solid ${colors.borderDefault}; padding-top: 12px;">
        Sent via SiteSync PM. Do not reply to this email.
      </p>
    </div>
  `
}

// ── Provider ─────────────────────────────────────────────

export const emailProvider: IntegrationProvider = {
  type: 'email_resend',

  async connect(projectId, credentials) {
    const { apiKey, fromEmail, fromName } = credentials as {
      apiKey: string; fromEmail: string; fromName?: string
    }
    if (!apiKey || !fromEmail) {
      return { integrationId: '', error: 'API Key and From Email are required' }
    }

    // Verify API key works
    const test = await sendEmail(apiKey, `${fromName || 'SiteSync PM'} <${fromEmail}>`, {
      to: [fromEmail],
      subject: 'SiteSync PM Email Integration Connected',
      html: '<p>Your email integration has been successfully connected.</p>',
    })

    if (!test.success) {
      return { integrationId: '', error: test.error ?? 'Failed to verify email credentials' }
    }

    const { data: { user } } = await supabase.auth.getUser()
    const integrationId = await createIntegrationRecord('email_resend', projectId, {
      apiKeyPrefix: apiKey.slice(0, 8) + '...',
      fromEmail,
      fromName: fromName || 'SiteSync PM',
    }, user?.id ?? '')

    return { integrationId }
  },

  async disconnect(integrationId) {
    await updateIntegrationStatus(integrationId, 'disconnected')
  },

  async sync(integrationId) {
    // Email is outbound only, no sync needed
    // This would be called to send pending email queue
    await updateIntegrationStatus(integrationId, 'syncing')

    const result: SyncResult = {
      success: true,
      recordsSynced: 0,
      recordsFailed: 0,
      errors: [],
      details: { emails_queued: 0 },
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
    }
  },

  getCapabilities() {
    return ['rfi_email', 'submittal_email', 'daily_log_email']
  },
}

// ── Public Send Functions ────────────────────────────────

export async function sendRFIResponseEmail(
  integrationId: string,
  to: string[],
  rfi: { number: string; title: string; response: string; respondedBy: string; projectName: string }
): Promise<{ success: boolean; error?: string }> {
  const { data: integration } = await supabase.from('integrations').select('config').eq('id', integrationId).single()
  if (!integration?.config) return { success: false, error: 'Email integration not configured' }

  const config = integration.config as Record<string, string>
  const from = `${config.fromName || 'SiteSync PM'} <${config.fromEmail}>`

  return sendEmail(config.apiKey ?? '', from, {
    to,
    subject: `[RFI ${rfi.number}] Response: ${rfi.title}`,
    html: rfiResponseEmailHtml(rfi),
  })
}

export async function sendSubmittalTransmittal(
  integrationId: string,
  to: string[],
  submittal: { number: string; title: string; status: string; specSection: string; projectName: string }
): Promise<{ success: boolean; error?: string }> {
  const { data: integration } = await supabase.from('integrations').select('config').eq('id', integrationId).single()
  if (!integration?.config) return { success: false, error: 'Email integration not configured' }

  const config = integration.config as Record<string, string>
  const from = `${config.fromName || 'SiteSync PM'} <${config.fromEmail}>`

  return sendEmail(config.apiKey ?? '', from, {
    to,
    subject: `[Submittal ${submittal.number}] Transmittal: ${submittal.title}`,
    html: submittalTransmittalHtml(submittal),
  })
}

export async function sendDailyLogSummaryEmail(
  integrationId: string,
  to: string[],
  log: { date: string; workers: number; manHours: number; incidents: number; weather: string; summary: string; projectName: string }
): Promise<{ success: boolean; error?: string }> {
  const { data: integration } = await supabase.from('integrations').select('config').eq('id', integrationId).single()
  if (!integration?.config) return { success: false, error: 'Email integration not configured' }

  const config = integration.config as Record<string, string>
  const from = `${config.fromName || 'SiteSync PM'} <${config.fromEmail}>`

  return sendEmail(config.apiKey ?? '', from, {
    to,
    subject: `Daily Log Summary: ${log.date} | ${log.projectName}`,
    html: dailyLogSummaryHtml(log),
  })
}
