// _shared/slackAlert.ts — BRT subsystem 7 §4.4
//
// Posts a structured alert to Slack via incoming-webhook. Used by:
//   - cron-conversion-alert (daily digest + drop alerts)
//   - cron-error-rate-alert (hourly 5xx check)
//   - audit_incidents triggers (P0 paging path)
//
// Non-blocking: a Slack outage never crashes the calling function.
//
// Env: SLACK_ALERTS_WEBHOOK   (P1/P2 channel — #brt-alerts)
//      SLACK_PAGE_WEBHOOK     (P0 only — pages founder via push channel)

export type AlertSeverity = 'page' | 'alert' | 'digest'

export interface SlackAlert {
  /** One-line title; goes in the bold header */
  title: string
  /** Optional extended body — shown in markdown block */
  body?: string
  /** Optional URL the user should look at to triage */
  link?: { text: string; url: string }
  /** Optional flat key-value context table */
  context?: Record<string, string | number>
  /** Severity; selects which webhook the message goes to */
  severity: AlertSeverity
}

const COLORS: Record<AlertSeverity, string> = {
  page: '#B91C1C',  // red — pages someone
  alert: '#B45309', // amber — needs attention this hour
  digest: '#0066FF', // blue — informational
}

const EMOJI: Record<AlertSeverity, string> = {
  page: ':rotating_light:',
  alert: ':warning:',
  digest: ':bar_chart:',
}

interface SlackBlock {
  type: string
  text?: { type: string; text: string }
  fields?: Array<{ type: string; text: string }>
  elements?: Array<{ type: string; text?: string; url?: string; action_id?: string }>
}

export async function postSlackAlert(alert: SlackAlert): Promise<boolean> {
  const url = alert.severity === 'page'
    ? (Deno.env.get('SLACK_PAGE_WEBHOOK') ?? Deno.env.get('SLACK_ALERTS_WEBHOOK'))
    : Deno.env.get('SLACK_ALERTS_WEBHOOK')

  if (!url) {
    console.warn(`[slack] no webhook configured for severity=${alert.severity}`)
    return false
  }

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${EMOJI[alert.severity]} ${alert.title}` },
    },
  ]

  if (alert.body) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: alert.body },
    })
  }

  if (alert.context && Object.keys(alert.context).length > 0) {
    const fields = Object.entries(alert.context).map(([k, v]) => ({
      type: 'mrkdwn',
      text: `*${k}*\n${String(v)}`,
    }))
    blocks.push({ type: 'section', fields })
  }

  if (alert.link) {
    blocks.push({
      type: 'actions',
      elements: [{
        type: 'button',
        text: alert.link.text,
        url: alert.link.url,
        action_id: 'open_link',
      }],
    })
  }

  const payload = {
    attachments: [{
      color: COLORS[alert.severity],
      blocks,
    }],
  }

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      console.error(`[slack] webhook ${res.status}:`, await res.text().catch(() => ''))
      return false
    }
    return true
  } catch (err) {
    console.error('[slack] post failed:', err)
    return false
  }
}

/** Convenience for the common "P0 audit incident" path. */
export async function pageAuditIncident(category: string, summary: string, link?: string): Promise<boolean> {
  return postSlackAlert({
    severity: 'page',
    title: `P0 audit_incident: ${category}`,
    body: summary,
    link: link ? { text: 'Open incident', url: link } : undefined,
  })
}
