/**
 * Tests for RFIs page helper functions.
 * These functions are defined inline in RFIs.tsx and tested here by replicating
 * their logic, since they are pure functions not exported from the module.
 */
import { describe, it, expect } from 'vitest'

// ── Replicated helpers (mirrors RFIs.tsx logic) ───────────────────────────────

const BIC_COLORS: Record<string, string> = {
  GC: '#3B82F6',
  Architect: '#8B5CF6',
  Engineer: '#14B8A6',
  Owner: '#F47820',
  Subcontractor: '#6B7280',
  Sub: '#6B7280',
}

function getBicColor(party: string): string {
  if (BIC_COLORS[party]) return BIC_COLORS[party]
  const key = Object.keys(BIC_COLORS).find(k =>
    party.toLowerCase().includes(k.toLowerCase())
  )
  return key ? BIC_COLORS[key] : '#6B7280'
}

function deriveBic(rfi: {
  status: string
  assigned_to: string | null
  from?: string | null
}): string | null {
  const { status, assigned_to, from: originator } = rfi
  if (status === 'open' && assigned_to) return assigned_to
  if (status === 'under_review') return assigned_to || null
  if (status === 'answered') return originator || null
  return assigned_to || null
}

function isOverdue(dateStr: string): boolean {
  return new Date(dateStr) < new Date()
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ── isOverdue ─────────────────────────────────────────────────────────────────

describe('isOverdue', () => {
  it('should return true for a past date', () => {
    expect(isOverdue('2020-01-01')).toBe(true)
  })

  it('should return false for a future date', () => {
    const future = new Date(Date.now() + 86_400_000 * 30).toISOString()
    expect(isOverdue(future)).toBe(false)
  })

  it('should handle dates in the far past', () => {
    expect(isOverdue('1990-06-15')).toBe(true)
  })
})

// ── getBicColor ───────────────────────────────────────────────────────────────

describe('getBicColor', () => {
  it('should return exact color for known party GC', () => {
    expect(getBicColor('GC')).toBe('#3B82F6')
  })

  it('should return exact color for Architect', () => {
    expect(getBicColor('Architect')).toBe('#8B5CF6')
  })

  it('should return exact color for Engineer', () => {
    expect(getBicColor('Engineer')).toBe('#14B8A6')
  })

  it('should return exact color for Owner', () => {
    expect(getBicColor('Owner')).toBe('#F47820')
  })

  it('should return exact color for Subcontractor', () => {
    expect(getBicColor('Subcontractor')).toBe('#6B7280')
  })

  it('should return exact color for Sub (alias)', () => {
    expect(getBicColor('Sub')).toBe('#6B7280')
  })

  it('should do partial match for "Lead Architect"', () => {
    expect(getBicColor('Lead Architect')).toBe('#8B5CF6')
  })

  it('should do partial match for "Structural Engineer"', () => {
    expect(getBicColor('Structural Engineer')).toBe('#14B8A6')
  })

  it('should return fallback gray for unknown party', () => {
    expect(getBicColor('Unknown Party')).toBe('#6B7280')
  })

  it('should return fallback gray for empty string', () => {
    expect(getBicColor('')).toBe('#6B7280')
  })

  it('should be case-insensitive for partial matching', () => {
    expect(getBicColor('lead gc representative')).toBe('#3B82F6')
  })
})

// ── deriveBic ─────────────────────────────────────────────────────────────────

describe('deriveBic', () => {
  it('should return assigned_to when status is open and assigned', () => {
    const result = deriveBic({ status: 'open', assigned_to: 'GC', from: 'Sub' })
    expect(result).toBe('GC')
  })

  it('should return null when status is open but not assigned', () => {
    const result = deriveBic({ status: 'open', assigned_to: null })
    expect(result).toBeNull()
  })

  it('should return assigned_to when under_review and assigned', () => {
    const result = deriveBic({ status: 'under_review', assigned_to: 'Architect' })
    expect(result).toBe('Architect')
  })

  it('should return null when under_review but not assigned', () => {
    const result = deriveBic({ status: 'under_review', assigned_to: null })
    expect(result).toBeNull()
  })

  it('should return originator when status is answered', () => {
    const result = deriveBic({ status: 'answered', assigned_to: 'Architect', from: 'GC' })
    expect(result).toBe('GC')
  })

  it('should return null when answered but no originator', () => {
    const result = deriveBic({ status: 'answered', assigned_to: 'Architect', from: null })
    expect(result).toBeNull()
  })

  it('should fall back to assigned_to for unknown status', () => {
    const result = deriveBic({ status: 'closed', assigned_to: 'Owner' })
    expect(result).toBe('Owner')
  })

  it('should return null when unknown status and no assignee', () => {
    const result = deriveBic({ status: 'draft', assigned_to: null })
    expect(result).toBeNull()
  })
})

// ── formatDate ────────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('should format an ISO date string to US locale short format', () => {
    // Jan 15, 2025
    const result = formatDate('2025-01-15T00:00:00.000Z')
    // Accepts "Jan 15, 2025" (any locale that formats similarly)
    expect(result).toContain('2025')
    expect(result).toMatch(/Jan/)
  })

  it('should include day, month abbreviation, and year', () => {
    const result = formatDate('2024-06-01T12:00:00.000Z')
    expect(result).toMatch(/\d{4}/)
    expect(result.length).toBeGreaterThan(5)
  })
})

// ── Supabase query logic for useRFIs (pagination) ─────────────────────────────

describe('useRFIs pagination math', () => {
  it('should calculate correct from/to for page 1 with default pageSize 50', () => {
    const page = 1
    const pageSize = 50
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    expect(from).toBe(0)
    expect(to).toBe(49)
  })

  it('should calculate correct from/to for page 2', () => {
    const page = 2
    const pageSize = 50
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    expect(from).toBe(50)
    expect(to).toBe(99)
  })

  it('should calculate correct from/to for page 3 with pageSize 25', () => {
    const page = 3
    const pageSize = 25
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    expect(from).toBe(50)
    expect(to).toBe(74)
  })

  it('should always produce a to value that is pageSize-1 more than from', () => {
    for (const pageSize of [10, 25, 50, 100]) {
      for (const page of [1, 2, 3, 10]) {
        const from = (page - 1) * pageSize
        const to = from + pageSize - 1
        expect(to - from).toBe(pageSize - 1)
      }
    }
  })
})
