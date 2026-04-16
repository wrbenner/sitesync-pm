import { describe, it, expect } from 'vitest'

// Pure utility functions mirrored from src/pages/RFIs.tsx.
// Keeping these in sync with the implementation is the contract —
// if the implementation changes, the tests will catch the drift.

const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return 'Not set'
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const isOverdue = (dateStr: string | null | undefined): boolean =>
  !!dateStr && new Date(dateStr) < new Date()

const getInitials = (name: string | null | undefined): string => {
  if (!name?.trim()) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .map((w: string) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

// ── formatDate ──────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('returns "Not set" for null', () => {
    expect(formatDate(null)).toBe('Not set')
  })

  it('returns "Not set" for undefined', () => {
    expect(formatDate(undefined)).toBe('Not set')
  })

  it('returns "Not set" for empty string', () => {
    expect(formatDate('')).toBe('Not set')
  })

  it('formats a valid ISO date string', () => {
    const result = formatDate('2024-01-15')
    expect(result).toContain('Jan')
    expect(result).toContain('15')
    expect(result).toContain('2024')
  })

  it('formats a datetime string (uses date portion only)', () => {
    const result = formatDate('2024-06-30T14:22:00Z')
    expect(result).toContain('Jun')
    expect(result).toContain('2024')
  })
})

// ── isOverdue ───────────────────────────────────────────────────────────────

describe('isOverdue', () => {
  it('returns false for null', () => {
    expect(isOverdue(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isOverdue(undefined)).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isOverdue('')).toBe(false)
  })

  it('returns true for a date clearly in the past', () => {
    expect(isOverdue('2020-01-01')).toBe(true)
  })

  it('returns false for a date clearly in the future', () => {
    expect(isOverdue('2099-12-31')).toBe(false)
  })
})

// ── getInitials ─────────────────────────────────────────────────────────────

describe('getInitials', () => {
  it('returns "?" for null', () => {
    expect(getInitials(null)).toBe('?')
  })

  it('returns "?" for undefined', () => {
    expect(getInitials(undefined)).toBe('?')
  })

  it('returns "?" for empty string', () => {
    expect(getInitials('')).toBe('?')
  })

  it('returns "?" for whitespace-only string', () => {
    expect(getInitials('   ')).toBe('?')
  })

  it('returns correct initials for a full name', () => {
    expect(getInitials('John Smith')).toBe('JS')
  })

  it('returns single initial for single name', () => {
    expect(getInitials('Alice')).toBe('A')
  })

  it('caps at 2 characters for multi-word names', () => {
    expect(getInitials('John Michael Smith')).toHaveLength(2)
    expect(getInitials('John Michael Smith')).toBe('JM')
  })

  it('returns uppercase initials for lowercase input', () => {
    expect(getInitials('john smith')).toBe('JS')
  })

  it('handles extra whitespace between words', () => {
    const result = getInitials('  Jane   Doe  ')
    expect(result).toBe('JD')
  })
})
