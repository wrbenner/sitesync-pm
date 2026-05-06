/**
 * Notification preferences — channel routing + DND.
 *
 * shouldDeliver decides:
 *   - Whether to deliver this event right now
 *   - Which channel (in_app | email | push | digest | none)
 *   - A human-readable reason
 *
 * Critical-tier (severity === 'critical') ALWAYS bypasses DND, unless the
 * user explicitly opts out via bypass_dnd_for_critical: false. Default is
 * true (DND respected for non-critical, ignored for critical).
 *
 * DND windows are expressed as HH:MM in user's IANA timezone. We compute
 * the user's local hour via Intl.DateTimeFormat — this handles DST
 * correctly without string-math.
 */

import type {
  NotificationEvent,
  UserNotificationPreferences,
  DeliveryDecision,
  NotificationChannel,
  ChannelMatrixEntry,
} from '../../types/notifications'

const DEFAULT_CHANNELS: ChannelMatrixEntry = {
  in_app: true,
  email: true,
  push: false,
  digest: false,
}

export function shouldDeliver(
  event: NotificationEvent,
  prefs: UserNotificationPreferences,
  now: Date,
): DeliveryDecision {
  const matrix = prefs.channels[event.event_type] ?? DEFAULT_CHANNELS

  if (!matrix.in_app && !matrix.email && !matrix.push && !matrix.digest) {
    return { deliver: false, channel: 'none', reason: 'User disabled all channels for this event type' }
  }

  const inDnd = isInDnd(prefs, now)
  if (inDnd) {
    if (event.severity === 'critical' && prefs.bypass_dnd_for_critical) {
      return { deliver: true, channel: pickChannel(matrix, 'critical'), reason: 'Critical event bypasses DND' }
    }
    if (matrix.digest) {
      return { deliver: true, channel: 'digest', reason: 'In DND window — queued for digest' }
    }
    return { deliver: false, channel: 'none', reason: 'In DND window' }
  }

  return { deliver: true, channel: pickChannel(matrix, event.severity), reason: 'Within delivery window' }
}

function pickChannel(matrix: ChannelMatrixEntry, severity: NotificationEvent['severity']): NotificationChannel {
  if (severity === 'critical') {
    if (matrix.push) return 'push'
    if (matrix.email) return 'email'
    if (matrix.in_app) return 'in_app'
    return 'none'
  }
  if (matrix.in_app) return 'in_app'
  if (matrix.push) return 'push'
  if (matrix.email) return 'email'
  if (matrix.digest) return 'digest'
  return 'none'
}

export function isInDnd(prefs: UserNotificationPreferences, now: Date): boolean {
  if (!prefs.dnd_start || !prefs.dnd_end || !prefs.dnd_timezone) return false
  const localHm = getLocalHourMinute(now, prefs.dnd_timezone)
  if (localHm < 0) return false
  const startMin = parseHm(prefs.dnd_start)
  const endMin = parseHm(prefs.dnd_end)
  if (startMin === null || endMin === null) return false
  if (startMin === endMin) return false
  if (startMin < endMin) {
    return localHm >= startMin && localHm < endMin
  }
  return localHm >= startMin || localHm < endMin
}

export function getLocalHourMinute(now: Date, timezone: string): number {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const parts = fmt.formatToParts(now)
    let hour = 0
    let minute = 0
    for (const p of parts) {
      if (p.type === 'hour') hour = parseInt(p.value, 10)
      else if (p.type === 'minute') minute = parseInt(p.value, 10)
    }
    if (hour === 24) hour = 0
    return hour * 60 + minute
  } catch {
    return -1
  }
}

function parseHm(hm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (h < 0 || h > 23 || min < 0 || min > 59) return null
  return h * 60 + min
}

export function defaultPreferences(user_id: string): UserNotificationPreferences {
  return {
    user_id,
    channels: {},
    bypass_dnd_for_critical: true,
    suggestion_frequency: 'occasional',
  }
}
