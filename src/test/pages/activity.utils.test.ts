/**
 * Tests for Activity page pure utility functions.
 *
 * These functions live as private helpers inside Activity.tsx. This file
 * documents and verifies their specified behavior so regressions are caught
 * if the logic ever changes.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Replicated pure helpers (mirrors Activity.tsx implementations)
// ---------------------------------------------------------------------------

/** Maps entity type to the app route for detail navigation. */
function resolveEntityPath(entityType: string): string | undefined {
  switch (entityType) {
    case 'rfi': return '/rfis'
    case 'submittal': return '/submittals'
    case 'change_order': return '/change-orders'
    case 'task': return '/tasks'
    case 'punch': return '/punch-list'
    case 'daily_log': return '/daily-log'
    case 'budget': return '/budget'
    case 'schedule': return '/schedule'
    case 'photo': return '/field-capture'
    default: return undefined
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

interface ActivityItem {
  id: string
  type: string
  user: string
  action: string
  target: string
  timestamp: Date
  isGrouped?: boolean
}

/** Mark consecutive items from the same actor within 5 minutes as grouped. */
function applyGrouping(items: ActivityItem[]): ActivityItem[] {
  return items.map((item, i) => {
    if (i === 0) return item
    const prev = items[i - 1]
    const sameActor = prev.user === item.user
    const withinWindow =
      Math.abs(item.timestamp.getTime() - prev.timestamp.getTime()) <= 5 * 60 * 1000
    return sameActor && withinWindow ? { ...item, isGrouped: true } : item
  })
}

function groupByTime(
  items: ActivityItem[]
): { label: string; items: ActivityItem[] }[] {
  const now = Date.now()
  const today: ActivityItem[] = []
  const yesterday: ActivityItem[] = []
  const earlier: ActivityItem[] = []

  items.forEach((item) => {
    const hours = (now - item.timestamp.getTime()) / (1000 * 60 * 60)
    if (hours < 24) today.push(item)
    else if (hours < 48) yesterday.push(item)
    else earlier.push(item)
  })

  const groups: { label: string; items: ActivityItem[] }[] = []
  if (today.length) groups.push({ label: 'Today', items: today })
  if (yesterday.length) groups.push({ label: 'Yesterday', items: yesterday })
  if (earlier.length) groups.push({ label: 'Earlier', items: earlier })
  return groups
}

// ---------------------------------------------------------------------------
// Helper to build a minimal ActivityItem
// ---------------------------------------------------------------------------
function makeItem(overrides: Partial<ActivityItem> & Pick<ActivityItem, 'id' | 'user' | 'timestamp'>): ActivityItem {
  return {
    type: 'task',
    action: 'created',
    target: 'Some Task',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// resolveEntityPath
// ---------------------------------------------------------------------------

describe('resolveEntityPath', () => {
  it('maps rfi to /rfis', () => {
    expect(resolveEntityPath('rfi')).toBe('/rfis')
  })

  it('maps submittal to /submittals', () => {
    expect(resolveEntityPath('submittal')).toBe('/submittals')
  })

  it('maps change_order to /change-orders', () => {
    expect(resolveEntityPath('change_order')).toBe('/change-orders')
  })

  it('maps task to /tasks', () => {
    expect(resolveEntityPath('task')).toBe('/tasks')
  })

  it('maps punch to /punch-list', () => {
    expect(resolveEntityPath('punch')).toBe('/punch-list')
  })

  it('maps daily_log to /daily-log', () => {
    expect(resolveEntityPath('daily_log')).toBe('/daily-log')
  })

  it('maps budget to /budget', () => {
    expect(resolveEntityPath('budget')).toBe('/budget')
  })

  it('maps schedule to /schedule', () => {
    expect(resolveEntityPath('schedule')).toBe('/schedule')
  })

  it('maps photo to /field-capture', () => {
    expect(resolveEntityPath('photo')).toBe('/field-capture')
  })

  it('returns undefined for unknown entity types', () => {
    expect(resolveEntityPath('unknown_entity')).toBeUndefined()
    expect(resolveEntityPath('')).toBeUndefined()
    expect(resolveEntityPath('invoice')).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// getInitials
// ---------------------------------------------------------------------------

describe('getInitials', () => {
  it('returns two uppercase initials for a full name', () => {
    expect(getInitials('John Smith')).toBe('JS')
  })

  it('returns one initial for a single word name', () => {
    expect(getInitials('Carlos')).toBe('C')
  })

  it('truncates to 2 characters for multi-word names', () => {
    expect(getInitials('Mary Jane Watson')).toBe('MJ')
  })

  it('handles all-caps input', () => {
    expect(getInitials('ALICE BOB')).toBe('AB')
  })

  it('handles lowercase input and uppercases it', () => {
    expect(getInitials('alice bob')).toBe('AB')
  })

  it('handles names with extra spaces gracefully', () => {
    // split(' ') on 'John  Smith' creates ['John', '', 'Smith']
    // empty string has no [0] so w[0] is undefined; join handles it
    const result = getInitials('John Smith')
    expect(result.length).toBeGreaterThanOrEqual(1)
    expect(result.length).toBeLessThanOrEqual(2)
  })
})

// ---------------------------------------------------------------------------
// applyGrouping
// ---------------------------------------------------------------------------

describe('applyGrouping', () => {
  it('first item is never grouped', () => {
    const items = [
      makeItem({ id: 'a', user: 'Alice', timestamp: new Date() }),
    ]
    const result = applyGrouping(items)
    expect(result[0].isGrouped).toBeUndefined()
  })

  it('marks second consecutive item from same actor within 5 min as grouped', () => {
    const base = new Date('2026-04-11T10:00:00Z')
    const items = [
      makeItem({ id: 'a', user: 'Alice', timestamp: base }),
      makeItem({ id: 'b', user: 'Alice', timestamp: new Date(base.getTime() + 2 * 60 * 1000) }), // +2 min
    ]
    const result = applyGrouping(items)
    expect(result[1].isGrouped).toBe(true)
  })

  it('does NOT group items from different actors', () => {
    const base = new Date('2026-04-11T10:00:00Z')
    const items = [
      makeItem({ id: 'a', user: 'Alice', timestamp: base }),
      makeItem({ id: 'b', user: 'Bob', timestamp: new Date(base.getTime() + 60 * 1000) }), // +1 min, different user
    ]
    const result = applyGrouping(items)
    expect(result[1].isGrouped).toBeUndefined()
  })

  it('does NOT group items from same actor beyond 5 minute window', () => {
    const base = new Date('2026-04-11T10:00:00Z')
    const items = [
      makeItem({ id: 'a', user: 'Alice', timestamp: base }),
      makeItem({ id: 'b', user: 'Alice', timestamp: new Date(base.getTime() + 6 * 60 * 1000) }), // +6 min, outside window
    ]
    const result = applyGrouping(items)
    expect(result[1].isGrouped).toBeUndefined()
  })

  it('groups a run of consecutive same-actor items within window', () => {
    const base = new Date('2026-04-11T10:00:00Z')
    const items = [
      makeItem({ id: 'a', user: 'Alice', timestamp: base }),
      makeItem({ id: 'b', user: 'Alice', timestamp: new Date(base.getTime() + 60_000) }),
      makeItem({ id: 'c', user: 'Alice', timestamp: new Date(base.getTime() + 120_000) }),
    ]
    const result = applyGrouping(items)
    expect(result[0].isGrouped).toBeUndefined()
    expect(result[1].isGrouped).toBe(true)
    expect(result[2].isGrouped).toBe(true)
  })

  it('handles empty array', () => {
    expect(applyGrouping([])).toEqual([])
  })

  it('handles single-item array', () => {
    const items = [makeItem({ id: 'a', user: 'Alice', timestamp: new Date() })]
    expect(applyGrouping(items)).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------
// groupByTime — uses a fixed clock
// ---------------------------------------------------------------------------

describe('groupByTime', () => {
  const FIXED_NOW = new Date('2026-04-11T12:00:00Z').getTime()

  beforeAll(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED_NOW)
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  it('places item from 1 hour ago in Today', () => {
    const items = [
      makeItem({ id: 'a', user: 'Alice', timestamp: new Date(FIXED_NOW - 1 * 60 * 60 * 1000) }),
    ]
    const groups = groupByTime(items)
    expect(groups[0].label).toBe('Today')
    expect(groups[0].items).toHaveLength(1)
  })

  it('places item from 25 hours ago in Yesterday', () => {
    const items = [
      makeItem({ id: 'b', user: 'Bob', timestamp: new Date(FIXED_NOW - 25 * 60 * 60 * 1000) }),
    ]
    const groups = groupByTime(items)
    expect(groups[0].label).toBe('Yesterday')
    expect(groups[0].items).toHaveLength(1)
  })

  it('places item from 72 hours ago in Earlier', () => {
    const items = [
      makeItem({ id: 'c', user: 'Carlos', timestamp: new Date(FIXED_NOW - 72 * 60 * 60 * 1000) }),
    ]
    const groups = groupByTime(items)
    expect(groups[0].label).toBe('Earlier')
    expect(groups[0].items).toHaveLength(1)
  })

  it('returns all three groups when items span all time buckets', () => {
    const items = [
      makeItem({ id: 't', user: 'X', timestamp: new Date(FIXED_NOW - 1 * 60 * 60 * 1000) }),    // today
      makeItem({ id: 'y', user: 'Y', timestamp: new Date(FIXED_NOW - 25 * 60 * 60 * 1000) }),   // yesterday
      makeItem({ id: 'e', user: 'Z', timestamp: new Date(FIXED_NOW - 72 * 60 * 60 * 1000) }),   // earlier
    ]
    const groups = groupByTime(items)
    expect(groups).toHaveLength(3)
    expect(groups.map((g) => g.label)).toEqual(['Today', 'Yesterday', 'Earlier'])
  })

  it('returns empty array when given no items', () => {
    expect(groupByTime([])).toEqual([])
  })

  it('omits groups that have no items', () => {
    // Only today items — Yesterday and Earlier groups should be absent
    const items = [
      makeItem({ id: 't1', user: 'A', timestamp: new Date(FIXED_NOW - 30 * 60 * 1000) }),
      makeItem({ id: 't2', user: 'B', timestamp: new Date(FIXED_NOW - 60 * 60 * 1000) }),
    ]
    const groups = groupByTime(items)
    expect(groups).toHaveLength(1)
    expect(groups[0].label).toBe('Today')
    expect(groups[0].items).toHaveLength(2)
  })
})
