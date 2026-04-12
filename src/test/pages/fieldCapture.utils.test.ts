/**
 * Tests for FieldCapture page pure utility functions.
 *
 * formatTimestamp and isToday are private helpers in FieldCapture.tsx.
 * This file documents their specified behavior.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Replicated helpers (mirrors FieldCapture.tsx)
// ---------------------------------------------------------------------------

function formatTimestamp(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' at ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  )
}

function isToday(dateStr: string | null): boolean {
  if (!dateStr) return false
  const d = new Date(dateStr)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  )
}

// ---------------------------------------------------------------------------
// formatTimestamp
// ---------------------------------------------------------------------------

describe('formatTimestamp', () => {
  it('returns empty string for null input', () => {
    expect(formatTimestamp(null)).toBe('')
  })

  it('returns a non-empty formatted string for a valid ISO date', () => {
    const result = formatTimestamp('2026-04-11T14:30:00Z')
    expect(result).toMatch(/Apr/)
    expect(result).toContain(' at ')
  })

  it('includes "at" separator between date and time parts', () => {
    const result = formatTimestamp('2026-04-11T09:00:00Z')
    expect(result).toContain(' at ')
  })

  it('produces a string with month abbreviation', () => {
    // Month 4 = April → 'Apr'
    const result = formatTimestamp('2026-04-11T12:00:00Z')
    expect(result).toMatch(/Apr/)
  })

  it('includes the day number', () => {
    const result = formatTimestamp('2026-04-11T12:00:00Z')
    expect(result).toContain('11')
  })

  it('produces different output for different timestamps', () => {
    const r1 = formatTimestamp('2026-01-01T08:00:00Z')
    const r2 = formatTimestamp('2026-06-15T20:00:00Z')
    expect(r1).not.toBe(r2)
  })
})

// ---------------------------------------------------------------------------
// isToday — pin clock
// ---------------------------------------------------------------------------

describe('isToday', () => {
  // Pin to 2026-04-12T10:00:00 local
  const FIXED = new Date(2026, 3, 12, 10, 0, 0).getTime() // month is 0-indexed

  beforeAll(() => {
    vi.useFakeTimers()
    vi.setSystemTime(FIXED)
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  it('returns true for a timestamp from today', () => {
    // Any time on 2026-04-12 counts as today
    const todayISO = new Date(2026, 3, 12, 8, 0, 0).toISOString()
    expect(isToday(todayISO)).toBe(true)
  })

  it('returns false for a timestamp from yesterday', () => {
    const yesterday = new Date(2026, 3, 11, 23, 59, 0).toISOString()
    expect(isToday(yesterday)).toBe(false)
  })

  it('returns false for a timestamp from tomorrow', () => {
    const tomorrow = new Date(2026, 3, 13, 0, 0, 0).toISOString()
    expect(isToday(tomorrow)).toBe(false)
  })

  it('returns false for null', () => {
    expect(isToday(null)).toBe(false)
  })

  it('returns false for an empty string', () => {
    expect(isToday('')).toBe(false)
  })

  it('returns false for a date in a different year', () => {
    const lastYear = new Date(2025, 3, 12, 10, 0, 0).toISOString()
    expect(isToday(lastYear)).toBe(false)
  })

  it('returns false for a date in a different month', () => {
    const lastMonth = new Date(2026, 2, 12, 10, 0, 0).toISOString()
    expect(isToday(lastMonth)).toBe(false)
  })
})
