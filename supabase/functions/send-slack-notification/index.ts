// ── send-slack-notification Edge Function ────────────────────
// Phase 7: Slack Block Kit notifications with action buttons.
// Adapted/enhanced from sitesyncai-backend-main/src/slack/slack.service.ts.
//
// Supports critical events: new_discrepancy, rfi_overdue, analysis_complete,
// safety_incident, bid_submitted. Rich blocks include View/Assign/Dismiss
// buttons routed back to the SiteSync app via the interactions handler.


import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  authenticateRequest,
  HttpError,
  errorResponse,
} from '../shared/auth.ts'

type EventType =
  | 'new_discrepancy'
  | 'rfi_overdue'
  | 'analysis_complete'
  | 'safety_incident'
  | 'bid_submitted'

interface SlackRequest {
  event: EventType
  message: string
  organization_id?: string
  project_id?: string
  project_name?: string
  actor_name?: string
  severity?: 'low' | 'medium' | 'high' | 'critical'
  details?: Record<string, string | number | boolean | null>
  resource_url?: string
  resource_id?: string
  webhook_url?: string
}

const EVENT_META: Record<
  EventType,
  { emoji: string; title: string; color: string }
> = {
  new_discrepancy: {
    emoji: '⚠️',
    title: 'New Discrepancy Detected',
    color: '#f59e0b',
  },
  rfi_overdue: {
    emoji: '⏰',
    title: 'RFI Overdue',
    color: '#ef4444',
  },
  analysis_complete: {
    emoji: '✅',
    title: 'Drawing Analysis Complete',
    color: '#10b981',
  },
  safety_incident: {
    emoji: '🚨',
    title: 'Safety Incident Reported',
    color: '#dc2626',
  },
  bid_submitted: {
    emoji: '📝',
    title: 'Bid Submitted',
    color: '#3b82f6',
  },
}

function maskWebhook(url: string): string {
  try {
    const parts = url.replace('https://hooks.slack.com/services/', '').split('/')
    return parts.map((p, i) => (i === parts.length - 1 ? '***' : p.slice(0, 4) + '…')).join('/')
  } catch {
    return 'masked'
  }
}

function buildBlocks(body: SlackRequest) {
  const meta = EVENT_META[body.event]
  const appUrl = Deno.env.get('APP_URL') ?? 'https://app.sitesync.ai'

  const fields: { type: 'mrkdwn'; text: string }[] = []
  if (body.project_name) fields.push({ type: 'mrkdwn', text: `*Project:*\n${body.project_name}` })
  if (body.actor_name) fields.push({ type: 'mrkdwn', text: `*Triggered by:*\n${body.actor_name}` })
  if (body.severity) fields.push({ type: 'mrkdwn', text: `*Severity:*\n${body.severity.toUpperCase()}` })

  if (body.details) {
    for (const [k, v] of Object.entries(body.details)) {
      if (v === null || v === undefined || v === '') continue
      const label = k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
      fields.push({ type: 'mrkdwn', text: `*${label}:*\n${String(v)}` })
      if (fields.length >= 10) break
    }
  }

  const blocks: unknown[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${meta.emoji} ${meta.title}`, emoji: true },
    },
    { type: 'section', text: { type: 'mrkdwn', text: body.message } },
  ]

  if (fields.length > 0) blocks.push({ type: 'section', fields })

  // Action buttons — route to web app. Slack does not require interaction
  // signing for link buttons (url type), so these work with webhook senders.
  const actions: unknown[] = []
  if (body.resource_url) {
    actions.push({
      type: 'button',
      text: { type: 'plain_text', text: 'View in SiteSync', emoji: true },
      style: 'primary',
      url: body.resource_url.startsWith('http') ? body.resource_url : `${appUrl}${body.resource_url}`,
    })
  }
  if (body.project_id) {
    actions.push({
      type: 'button',
      text: { type: 'plain_text', text: 'Open Project', emoji: true },
      url: `${appUrl}/projects/${body.project_id}`,
    })
    actions.push({
      type: 'button',
      text: { type: 'plain_text', text: 'Assign', emoji: true },
      url: `${appUrl}/projects/${body.project_id}/assign?ref=${body.resource_id ?? ''}`,
    })
  }
  if (actions.length > 0) blocks.push({ type: 'actions', elements: actions })

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `SiteSync PM • <!date^${Math.floor(Date.now() / 1000)}^{date_short_pretty} at {time}|${new Date().toISOString()}>`,
      },
    ],
  })

  return { blocks, attachments: [{ color: meta.color }] }
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const corsHeaders = getCorsHeaders(req)

  if (req.method !== 'POST') {
    return errorResponse(new HttpError(405, 'Method not allowed'), corsHeaders)
  }

  try {
    await authenticateRequest(req)
    const body = await parseJsonBody<SlackRequest>(req)

    if (!body.event || !(body.event in EVENT_META)) {
      throw new HttpError(400, 'event must be one of: ' + Object.keys(EVENT_META).join(', '), 'validation_error')
    }
    if (!body.message) {
      throw new HttpError(400, 'message is required', 'validation_error')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, supabaseServiceKey)

    // Resolve webhook: explicit override > organization_settings.
    let webhook = body.webhook_url ?? null
    if (!webhook && body.organization_id) {
      const { data } = await admin
        .from('organization_settings')
        .select('slack_webhook_url, slack_enabled')
        .eq('organization_id', body.organization_id)
        .maybeSingle()
      if (data?.slack_enabled && data.slack_webhook_url) webhook = data.slack_webhook_url
    }

    const payload = buildBlocks(body)

    if (!webhook) {
      await admin.from('slack_delivery_log').insert({
        organization_id: body.organization_id ?? null,
        project_id: body.project_id ?? null,
        event_type: body.event,
        status: 'skipped',
        error_message: 'No webhook configured',
      })
      return new Response(JSON.stringify({ skipped: true, reason: 'no_webhook' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const ok = res.ok
    const errText = ok ? null : await res.text().catch(() => 'unknown')

    await admin.from('slack_delivery_log').insert({
      organization_id: body.organization_id ?? null,
      project_id: body.project_id ?? null,
      event_type: body.event,
      webhook_url_masked: maskWebhook(webhook),
      status: ok ? 'success' : 'failed',
      status_code: res.status,
      error_message: errText,
    })

    if (!ok) {
      throw new HttpError(502, `Slack webhook rejected: ${res.status} ${errText}`, 'slack_error')
    }

    return new Response(JSON.stringify({ delivered: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
