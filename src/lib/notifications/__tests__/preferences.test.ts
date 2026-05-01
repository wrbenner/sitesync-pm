import { describe, it, expect } from 'vitest'
import { shouldDeliver, isInDnd, getLocalHourMinute, defaultPreferences } from '../preferences'
import type { UserNotificationPreferences, NotificationEvent } from '../../../types/notifications'

const baseEvent: NotificationEvent = {
  id: 'e1',
  user_id: 'u1',
  event_type: 'rfi.assigned',
  severity: 'normal',
  title: 'New RFI assigned',
  occurred_at: '2026-04-29T12:00:00Z',
}

describe('shouldDeliver — base cases', () => {
  it('delivers in-app by default for normal-severity event', () => {
    const prefs = defaultPreferences('u1')
    const decision = shouldDeliver(baseEvent, prefs, new Date('2026-04-29T15:00:00Z'))
    expect(decision.deliver).toBe(true)
    expect(decision.channel).toBe('in_app')
  })

  it('returns none when all channels are disabled', () => {
    const prefs: UserNotificationPreferences = {
      ...defaultPreferences('u1'),
      channels: {
        'rfi.assigned': { in_app: false, email: false, push: false, digest: false },
      },
    }
    const d = shouldDeliver(baseEvent, prefs, new Date())
    expect(d.deliver).toBe(false)
    expect(d.channel).toBe('none')
  })

  it('prefers push for critical events', () => {
    const prefs: UserNotificationPreferences = {
      ...defaultPreferences('u1'),
      channels: { 'rfi.assigned': { in_app: true, email: true, push: true, digest: false } },
    }
    const d = shouldDeliver({ ...baseEvent, severity: 'critical' }, prefs, new Date('2026-04-29T15:00:00Z'))
    expect(d.deliver).toBe(true)
    expect(d.channel).toBe('push')
  })
})

describe('shouldDeliver — DND windows', () => {
  it('suppresses non-critical inside an overnight DND window (CST 23:00 = 05:00 UTC, in 20:00–07:00 CST)', () => {
    const prefs: UserNotificationPreferences = {
      ...defaultPreferences('u1'),
      dnd_start: '20:00',
      dnd_end: '07:00',
      dnd_timezone: 'America/Chicago',
    }
    const d = shouldDeliver(baseEvent, prefs, new Date('2026-04-29T05:00:00Z')) // 00:00 CST
    expect(d.deliver).toBe(false)
    expect(d.channel).toBe('none')
    expect(d.reason).toContain('DND')
  })

  it('still delivers critical inside DND when bypass is enabled (default)', () => {
    const prefs: UserNotificationPreferences = {
      ...defaultPreferences('u1'),
      dnd_start: '20:00',
      dnd_end: '07:00',
      dnd_timezone: 'America/Chicago',
    }
    const d = shouldDeliver({ ...baseEvent, severity: 'critical' }, prefs, new Date('2026-04-29T05:00:00Z'))
    expect(d.deliver).toBe(true)
    expect(d.reason).toContain('Critical')
  })

  it('suppresses critical inside DND when user opted out of critical bypass', () => {
    const prefs: UserNotificationPreferences = {
      ...defaultPreferences('u1'),
      bypass_dnd_for_critical: false,
      dnd_start: '20:00',
      dnd_end: '07:00',
      dnd_timezone: 'America/Chicago',
    }
    const d = shouldDeliver({ ...baseEvent, severity: 'critical' }, prefs, new Date('2026-04-29T05:00:00Z'))
    expect(d.deliver).toBe(false)
  })

  it('queues to digest when in DND and digest enabled', () => {
    const prefs: UserNotificationPreferences = {
      ...defaultPreferences('u1'),
      channels: { 'rfi.assigned': { in_app: true, email: true, push: false, digest: true } },
      dnd_start: '20:00',
      dnd_end: '07:00',
      dnd_timezone: 'America/Chicago',
    }
    const d = shouldDeliver(baseEvent, prefs, new Date('2026-04-29T05:00:00Z'))
    expect(d.deliver).toBe(true)
    expect(d.channel).toBe('digest')
  })

  it('handles same-day DND window', () => {
    const prefs: UserNotificationPreferences = {
      ...defaultPreferences('u1'),
      dnd_start: '13:00',
      dnd_end: '17:00',
      dnd_timezone: 'America/Chicago',
    }
    // 14:30 UTC → 09:30 CDT (out of window).
    expect(isInDnd(prefs, new Date('2026-04-29T14:30:00Z'))).toBe(false)
    // 19:00 UTC → 14:00 CDT (in 13:00–17:00 window).
    expect(isInDnd(prefs, new Date('2026-04-29T19:00:00Z'))).toBe(true)
    // 22:00 UTC → 17:00 CDT (boundary, not in [13,17)).
    expect(isInDnd(prefs, new Date('2026-04-29T22:00:00Z'))).toBe(false)
  })

  it('returns false when DND not configured', () => {
    expect(isInDnd(defaultPreferences('u1'), new Date())).toBe(false)
  })

  it('returns false when DND timezone is invalid', () => {
    const prefs: UserNotificationPreferences = {
      ...defaultPreferences('u1'),
      dnd_start: '20:00',
      dnd_end: '07:00',
      dnd_timezone: 'Not/Real',
    }
    expect(isInDnd(prefs, new Date())).toBe(false)
  })
})

describe('DST boundaries', () => {
  it('handles US spring-forward 2026 — 2:00 AM Mar 8 → 3:00 AM CDT', () => {
    // At 07:30 UTC on 2026-03-08, Chicago is 02:30 CST (DST transition; clock jumps).
    // Intl.DateTimeFormat handles the jump. After the jump, 07:30 UTC is 02:30 CST or 03:30 CDT depending on when the engine evaluates.
    // We assert the function returns SOMETHING in [0, 1440); behavioural correctness is that DND status reflects the actual local clock.
    const hm = getLocalHourMinute(new Date('2026-03-08T08:00:00Z'), 'America/Chicago')
    expect(hm).toBeGreaterThanOrEqual(0)
    expect(hm).toBeLessThan(1440)
    // 08:00 UTC after spring-forward = 03:00 CDT
    expect(hm).toBe(3 * 60)
  })

  it('handles US fall-back 2026 — 2:00 AM Nov 1 → 1:00 AM CST', () => {
    // 07:00 UTC on 2026-11-01 → 02:00 CDT or 01:00 CST.
    const hm = getLocalHourMinute(new Date('2026-11-01T08:00:00Z'), 'America/Chicago')
    // After fall-back, 08:00 UTC = 02:00 CST
    expect(hm).toBe(2 * 60)
  })

  it('respects DND across spring-forward boundary', () => {
    const prefs: UserNotificationPreferences = {
      ...defaultPreferences('u1'),
      dnd_start: '01:00',
      dnd_end: '06:00',
      dnd_timezone: 'America/Chicago',
    }
    // 07:30 UTC on Mar 8 = 02:30 CDT (after jump). In window.
    expect(isInDnd(prefs, new Date('2026-03-08T07:30:00Z'))).toBe(true)
    // 12:00 UTC on Mar 8 = 07:00 CDT. Out of window.
    expect(isInDnd(prefs, new Date('2026-03-08T12:00:00Z'))).toBe(false)
  })
})

describe('getLocalHourMinute', () => {
  it('returns minutes since midnight in target timezone', () => {
    // 2026-04-29T15:30:00Z → 10:30 CDT = 630 min
    expect(getLocalHourMinute(new Date('2026-04-29T15:30:00Z'), 'America/Chicago')).toBe(10 * 60 + 30)
    // UTC zone returns same as input
    expect(getLocalHourMinute(new Date('2026-04-29T15:30:00Z'), 'UTC')).toBe(15 * 60 + 30)
  })
})
