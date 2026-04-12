/**
 * Tests for Lookahead page pure utility functions.
 *
 * generateDays is a private helper in Lookahead.tsx. This file documents
 * and verifies its specified behavior.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Replicated helper (mirrors Lookahead.tsx)
// ---------------------------------------------------------------------------

const generateDays = (weeks: number): string[] => {
  const days: string[] = []
  const start = new Date()
  // Start from Monday
  const dayOfWeek = start.getDay()
  const mondayOffset = dayOfWeek === 0 ? 1 : dayOfWeek === 6 ? 2 : -(dayOfWeek - 1)
  start.setDate(start.getDate() + mondayOffset)

  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 5; d++) {
      const date = new Date(start)
      date.setDate(start.getDate() + w * 7 + d)
      days.push(date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }))
    }
  }
  return days
}

// ---------------------------------------------------------------------------
// Tests — pin the clock to a known Monday so assertions are deterministic
// ---------------------------------------------------------------------------

// 2026-04-06 is a Monday
const MONDAY_2026_04_06 = new Date('2026-04-06T00:00:00').getTime()

describe('generateDays', () => {
  beforeAll(() => {
    vi.useFakeTimers()
    vi.setSystemTime(MONDAY_2026_04_06)
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  it('returns 5 days for 1 week', () => {
    expect(generateDays(1)).toHaveLength(5)
  })

  it('returns 10 days for 2 weeks', () => {
    expect(generateDays(2)).toHaveLength(10)
  })

  it('returns 15 days for 3 weeks (standard lookahead view)', () => {
    expect(generateDays(3)).toHaveLength(15)
  })

  it('returns empty array for 0 weeks', () => {
    expect(generateDays(0)).toHaveLength(0)
  })

  it('first day when called on a Monday is that same Monday', () => {
    const days = generateDays(1)
    // On a Monday the offset is -(1-1) = 0, so start is today (the Monday)
    expect(days[0]).toContain('Mon')
    expect(days[0]).toContain('Apr 6')
  })

  it('contains only weekdays (Mon through Fri) per week', () => {
    const days = generateDays(2)
    // Weekday order: Mon, Tue, Wed, Thu, Fri, Mon, Tue, Wed, Thu, Fri
    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']
    days.forEach((day, i) => {
      const expected = weekdays[i % 5]
      expect(day).toContain(expected)
    })
  })

  it('second week starts on the Monday 7 days after the first day', () => {
    const days = generateDays(2)
    expect(days[5]).toContain('Mon')
    expect(days[5]).toContain('Apr 13')
  })

  it('produces unique day labels', () => {
    const days = generateDays(3)
    const unique = new Set(days)
    expect(unique.size).toBe(days.length)
  })

  it('every entry has a non-empty string format', () => {
    const days = generateDays(1)
    days.forEach((d) => {
      expect(typeof d).toBe('string')
      expect(d.length).toBeGreaterThan(0)
    })
  })
})

// ---------------------------------------------------------------------------
// Edge case: called on a Sunday
// ---------------------------------------------------------------------------

describe('generateDays — called on Sunday', () => {
  // 2026-04-12 is a Sunday
  const SUNDAY_2026_04_12 = new Date('2026-04-12T00:00:00').getTime()

  beforeAll(() => {
    vi.useFakeTimers()
    vi.setSystemTime(SUNDAY_2026_04_12)
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  it('starts from the NEXT Monday when called on Sunday', () => {
    const days = generateDays(1)
    // dayOfWeek === 0 → mondayOffset = 1 → start = Sunday + 1 = Monday Apr 13
    expect(days[0]).toContain('Mon')
    expect(days[0]).toContain('Apr 13')
  })
})

// ---------------------------------------------------------------------------
// Edge case: called on a Saturday
// ---------------------------------------------------------------------------

describe('generateDays — called on Saturday', () => {
  // 2026-04-11 is a Saturday
  const SATURDAY_2026_04_11 = new Date('2026-04-11T00:00:00').getTime()

  beforeAll(() => {
    vi.useFakeTimers()
    vi.setSystemTime(SATURDAY_2026_04_11)
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  it('starts from Monday two days later when called on Saturday', () => {
    const days = generateDays(1)
    // dayOfWeek === 6 → mondayOffset = 2 → start = Saturday + 2 = Monday Apr 13
    expect(days[0]).toContain('Mon')
    expect(days[0]).toContain('Apr 13')
  })
})
