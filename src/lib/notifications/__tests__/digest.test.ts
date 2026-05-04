import { describe, it, expect } from 'vitest'
import { digest, renderDigestText } from '../digest'
import type { NotificationEvent } from '../../../types/notifications'

function evt(overrides: Partial<NotificationEvent>): NotificationEvent {
  return {
    id: overrides.id ?? Math.random().toString(),
    user_id: 'u1',
    event_type: 'rfi.assigned',
    severity: 'normal',
    title: 'something',
    occurred_at: '2026-04-29T12:00:00Z',
    entity_type: 'rfi',
    ...overrides,
  }
}

describe('digest', () => {
  it('returns empty digest when no events', () => {
    const d = digest('u1', [], new Date('2026-04-29T20:00:00Z'))
    expect(d.total_events).toBe(0)
    expect(d.critical_count).toBe(0)
    expect(d.groups).toEqual([])
  })

  it('groups events by entity_type', () => {
    const events = [
      evt({ entity_type: 'rfi', title: 'r1' }),
      evt({ entity_type: 'rfi', title: 'r2' }),
      evt({ entity_type: 'submittal', title: 's1' }),
    ]
    const d = digest('u1', events, new Date())
    expect(d.total_events).toBe(3)
    expect(d.groups.length).toBe(2)
    expect(d.groups[0].entity_type).toBe('rfi')
    expect(d.groups[0].count).toBe(2)
    expect(d.groups[1].entity_type).toBe('submittal')
  })

  it('excludes critical events from digest groups (delivered immediately)', () => {
    const events = [
      evt({ severity: 'critical', title: 'crit1' }),
      evt({ severity: 'critical', title: 'crit2' }),
      evt({ title: 'normal1' }),
    ]
    const d = digest('u1', events, new Date())
    expect(d.critical_count).toBe(2)
    expect(d.total_events).toBe(1)
    expect(d.groups[0].events[0].title).toBe('normal1')
  })

  it('puts ungrouped (no entity_type) events under "general"', () => {
    const events = [evt({ entity_type: undefined, title: 'orphan' })]
    const d = digest('u1', events, new Date())
    expect(d.groups[0].entity_type).toBe('general')
  })

  it('renders text digest with all groups', () => {
    const events = [evt({ entity_type: 'rfi', title: 'r1' }), evt({ entity_type: 'submittal', title: 's1' })]
    const d = digest('u1', events, new Date())
    const text = renderDigestText(d)
    expect(text).toContain('RFI')
    expect(text).toContain('SUBMITTAL')
    expect(text).toContain('r1')
    expect(text).toContain('s1')
  })

  it('renders empty-state digest', () => {
    const d = digest('u1', [], new Date())
    expect(renderDigestText(d)).toBe('No new notifications.')
  })

  it('mentions critical sidebar count in rendered text', () => {
    const events = [evt({ severity: 'critical', title: 'crit' }), evt({ title: 'normal' })]
    const d = digest('u1', events, new Date())
    const text = renderDigestText(d)
    expect(text).toContain('1 critical event')
  })
})
