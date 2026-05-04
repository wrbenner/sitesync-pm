// ── Unified Notification Dispatcher ──────────────────────────
// Phase 7: Single entry point that fans a construction event to the
// channels a given user has opted into (in-app toast, email, Slack).
//
// Reads notification_preferences + organization_settings to respect
// per-user opt-ins. Channel failures are logged but never throw — a
// Slack outage must not block an in-app notification.

import { supabase, fromTable } from './supabase'
import { useUiStore } from '../stores/uiStore'

export type NotificationEvent =
  | 'new_discrepancy'
  | 'rfi_overdue'
  | 'analysis_complete'
  | 'safety_incident'
  | 'bid_submitted'
  | 'mention'
  | 'assignment'
  | 'approval_needed'

export interface DispatchPayload {
  event: NotificationEvent
  userId?: string
  organizationId?: string
  projectId?: string
  projectName?: string
  title: string
  message: string
  severity?: 'low' | 'medium' | 'high' | 'critical'
  details?: Record<string, string | number | boolean | null>
  actionRoute?: string
  resourceId?: string
  resourceUrl?: string
  toastType?: 'info' | 'success' | 'warning' | 'error'
  // Allow caller to override user prefs — e.g. force an email.
  channels?: Partial<Record<'in_app' | 'email' | 'slack', boolean>>
  emailTo?: string | string[]
}

interface UserPrefs {
  slack_enabled?: boolean
  mention_channel?: string
  assignment_channel?: string
  overdue_channel?: string
  approval_needed_channel?: string
  ai_insight_channel?: string
  system_channel?: string
  muted_projects?: string[]
}

const EVENT_TO_PREF: Record<NotificationEvent, keyof UserPrefs | null> = {
  new_discrepancy: 'ai_insight_channel',
  rfi_overdue: 'overdue_channel',
  analysis_complete: 'ai_insight_channel',
  safety_incident: 'system_channel',
  bid_submitted: 'system_channel',
  mention: 'mention_channel',
  assignment: 'assignment_channel',
  approval_needed: 'approval_needed_channel',
}

function typeFromSeverity(sev?: string): 'info' | 'success' | 'warning' | 'error' {
  if (sev === 'critical' || sev === 'high') return 'error'
  if (sev === 'medium') return 'warning'
  return 'info'
}

async function loadPrefs(userId: string): Promise<UserPrefs | null> {
  try {
    const { data } = await fromTable('notification_preferences')
      .select(
        'slack_enabled, mention_channel, assignment_channel, overdue_channel, approval_needed_channel, ai_insight_channel, system_channel, muted_projects',
      )
      .eq('user_id' as never, userId)
      .maybeSingle()
    return (data as unknown as UserPrefs) ?? null
  } catch {
    return null
  }
}

function resolveChannels(
  payload: DispatchPayload,
  prefs: UserPrefs | null,
): { in_app: boolean; email: boolean; slack: boolean } {
  const override = payload.channels ?? {}
  if (
    payload.projectId &&
    prefs?.muted_projects &&
    prefs.muted_projects.includes(payload.projectId)
  ) {
    return { in_app: false, email: false, slack: false }
  }

  const prefKey = EVENT_TO_PREF[payload.event]
  const channelPref = prefKey ? (prefs?.[prefKey] as string | undefined) : undefined

  // Default rules when caller doesn't override:
  // - in_app: on unless pref is 'off'
  // - email: on when pref is 'all' or 'email'
  // - slack: on when user has slack_enabled and pref is 'all' or 'slack' (treat 'all' as include slack)
  const in_app = override.in_app ?? channelPref !== 'off'
  const email = override.email ?? (channelPref === 'all' || channelPref === 'email')
  const slack = override.slack ?? Boolean(prefs?.slack_enabled) && (channelPref === 'all' || channelPref === 'slack' || channelPref === undefined)
  return { in_app, email, slack }
}

async function invokeFn(name: string, body: unknown): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke(name, { body })
    if (error) console.warn(`[notifications] ${name} failed`, error)
  } catch (e) {
    console.warn(`[notifications] ${name} threw`, e)
  }
}

export async function dispatchNotification(payload: DispatchPayload): Promise<void> {
  const { data: { user } = { user: null } } = await supabase.auth.getUser()
  const userId = payload.userId ?? user?.id

  const prefs = userId ? await loadPrefs(userId) : null
  const channels = resolveChannels(payload, prefs)

  // In-app toast — synchronous, no network round-trip.
  if (channels.in_app) {
    try {
      useUiStore.getState().addNotification({
        type: payload.toastType ?? typeFromSeverity(payload.severity),
        title: payload.title,
        message: payload.message,
        actionRoute: payload.actionRoute,
      })
    } catch (e) {
      console.warn('[notifications] in-app failed', e)
    }
  }

  const emailTo = payload.emailTo ?? user?.email
  if (channels.email && emailTo) {
    void invokeFn('send-email', {
      to: emailTo,
      subject: payload.title,
      html: `<div style="font-family:system-ui,sans-serif;max-width:600px;padding:24px">
        <h2 style="color:#1f2937;margin:0 0 8px">${payload.title}</h2>
        <p style="color:#4b5563;line-height:1.5">${payload.message}</p>
        ${payload.projectName ? `<p style="color:#6b7280;font-size:14px">Project: ${payload.projectName}</p>` : ''}
        ${payload.resourceUrl ? `<a href="${payload.resourceUrl}" style="display:inline-block;margin-top:16px;padding:10px 20px;background:#2563eb;color:#fff;text-decoration:none;border-radius:6px">View in SiteSync</a>` : ''}
      </div>`,
    })
  }

  if (channels.slack && isSlackEvent(payload.event)) {
    void invokeFn('send-slack-notification', {
      event: payload.event,
      message: payload.message,
      organization_id: payload.organizationId,
      project_id: payload.projectId,
      project_name: payload.projectName,
      severity: payload.severity,
      details: payload.details,
      resource_url: payload.resourceUrl,
      resource_id: payload.resourceId,
    })
  }
}

function isSlackEvent(
  e: NotificationEvent,
): e is 'new_discrepancy' | 'rfi_overdue' | 'analysis_complete' | 'safety_incident' | 'bid_submitted' {
  return (
    e === 'new_discrepancy' ||
    e === 'rfi_overdue' ||
    e === 'analysis_complete' ||
    e === 'safety_incident' ||
    e === 'bid_submitted'
  )
}

// Convenience helpers for the most common construction events.
export const notify = {
  newDiscrepancy: (p: Omit<DispatchPayload, 'event' | 'title'> & { count: number }) =>
    dispatchNotification({
      ...p,
      event: 'new_discrepancy',
      title: `${p.count} new discrepanc${p.count === 1 ? 'y' : 'ies'} detected`,
    }),
  rfiOverdue: (p: Omit<DispatchPayload, 'event' | 'title'> & { rfiNumber: string }) =>
    dispatchNotification({
      ...p,
      event: 'rfi_overdue',
      title: `RFI ${p.rfiNumber} is overdue`,
      severity: p.severity ?? 'high',
    }),
  analysisComplete: (p: Omit<DispatchPayload, 'event' | 'title'>) =>
    dispatchNotification({ ...p, event: 'analysis_complete', title: 'Drawing analysis complete' }),
  safetyIncident: (p: Omit<DispatchPayload, 'event' | 'title'>) =>
    dispatchNotification({
      ...p,
      event: 'safety_incident',
      title: 'Safety incident reported',
      severity: p.severity ?? 'critical',
    }),
  bidSubmitted: (p: Omit<DispatchPayload, 'event' | 'title'> & { bidderName: string }) =>
    dispatchNotification({ ...p, event: 'bid_submitted', title: `Bid submitted by ${p.bidderName}` }),
}
