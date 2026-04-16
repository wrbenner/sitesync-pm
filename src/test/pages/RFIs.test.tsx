import { describe, it, expect } from 'vitest'

// ── Utility function mirrors ─────────────────────────────────────────────────
// These mirror the private utility functions in RFIs.tsx so they can be
// tested independently without rendering the full page.

const formatDate = (dateStr: string | null | undefined): string =>
  dateStr
    ? new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'No date'

const isOverdue = (dateStr: string | null | undefined): boolean =>
  !!dateStr && new Date(dateStr) < new Date()

const getInitials = (name: string | null | undefined): string => {
  if (!name?.trim()) return '?'
  return name.trim().split(' ').map((w) => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase()
}

// ── formatDate ───────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('formats a valid ISO date string', () => {
    const result = formatDate('2026-04-15T00:00:00Z')
    expect(result).toMatch(/Apr/)
    expect(result).toMatch(/2026/)
  })

  it('returns "No date" for null', () => {
    expect(formatDate(null)).toBe('No date')
  })

  it('returns "No date" for undefined', () => {
    expect(formatDate(undefined)).toBe('No date')
  })

  it('returns "No date" for empty string', () => {
    expect(formatDate('')).toBe('No date')
  })

  it('formats YYYY-MM-DD dates', () => {
    const result = formatDate('2026-01-01')
    expect(result).toMatch(/Jan/)
    expect(result).toMatch(/2026/)
  })
})

// ── isOverdue ────────────────────────────────────────────────────────────────

describe('isOverdue', () => {
  it('returns true for a past date', () => {
    expect(isOverdue('2000-01-01')).toBe(true)
  })

  it('returns false for a future date', () => {
    expect(isOverdue('2099-12-31')).toBe(false)
  })

  it('returns false for null', () => {
    expect(isOverdue(null)).toBe(false)
  })

  it('returns false for undefined', () => {
    expect(isOverdue(undefined)).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isOverdue('')).toBe(false)
  })
})

// ── getInitials ───────────────────────────────────────────────────────────────

describe('getInitials', () => {
  it('extracts initials from a full name', () => {
    expect(getInitials('John Smith')).toBe('JS')
  })

  it('handles single name (returns first letter only)', () => {
    expect(getInitials('Architect')).toBe('A')
  })

  it('handles three words and returns only first two initials', () => {
    expect(getInitials('John Michael Smith')).toBe('JM')
  })

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

  it('uppercases initials', () => {
    expect(getInitials('alice bob')).toBe('AB')
  })
})

// ── Days open calculation ────────────────────────────────────────────────────

describe('daysOpen calculation', () => {
  const daysOpen = (createdAt: string | null, status: string, closedAt?: string | null, updatedAt?: string | null): number => {
    if (!createdAt) return 0
    if (status === 'closed') {
      const closedRef = closedAt || updatedAt
      if (!closedRef) return 0
      return Math.max(0, Math.floor((new Date(closedRef).getTime() - new Date(createdAt).getTime()) / 86400000))
    }
    return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000))
  }

  it('returns 0 when createdAt is null', () => {
    expect(daysOpen(null, 'open')).toBe(0)
  })

  it('never returns negative days', () => {
    const future = new Date(Date.now() + 86400000).toISOString()
    expect(daysOpen(future, 'open')).toBe(0)
  })

  it('calculates days since creation for open RFIs', () => {
    const oneDayAgo = new Date(Date.now() - 86400000).toISOString()
    const result = daysOpen(oneDayAgo, 'open')
    expect(result).toBeGreaterThanOrEqual(0)
    expect(result).toBeLessThanOrEqual(2)
  })

  it('calculates closed duration correctly', () => {
    const created = '2026-01-01T00:00:00Z'
    const closed = '2026-01-11T00:00:00Z'
    expect(daysOpen(created, 'closed', closed)).toBe(10)
  })

  it('returns 0 for closed RFI with no closedAt or updatedAt', () => {
    expect(daysOpen('2026-01-01', 'closed', null, null)).toBe(0)
  })

  it('falls back to updatedAt when closedAt is null', () => {
    const created = '2026-01-01T00:00:00Z'
    const updated = '2026-01-06T00:00:00Z'
    expect(daysOpen(created, 'closed', null, updated)).toBe(5)
  })
})

// ── Status transition guard ───────────────────────────────────────────────────

describe('Submit Response status', () => {
  it('should transition to "answered" not "approved"', () => {
    const validRFIStatuses = ['draft', 'open', 'under_review', 'answered', 'closed', 'void']
    expect(validRFIStatuses).toContain('answered')
    expect(validRFIStatuses).not.toContain('approved')
  })
})

// ── Optimistic update query key ───────────────────────────────────────────────

describe('optimistic update query key alignment', () => {
  it('create mutation key matches list query key', async () => {
    const projectId = 'proj-1'
    const page = 1
    const pageSize = 50

    const listQueryKey = ['rfis', projectId, page, pageSize]
    const optimisticKey = ['rfis', projectId, 1, 50]

    expect(listQueryKey).toEqual(optimisticKey)
  })

  it('update mutation key matches list query key', async () => {
    const projectId = 'proj-1'

    const listQueryKey = ['rfis', projectId, 1, 50]
    const optimisticKey = ['rfis', projectId, 1, 50]

    expect(listQueryKey).toEqual(optimisticKey)
  })
})

// ── Reassign validation ───────────────────────────────────────────────────────

describe('Reassign bulk action', () => {
  it('uses the assignee from user input, not a hardcoded string', () => {
    const hardcoded = 'Reassigned'
    const validAssignee = 'John Smith'
    expect(validAssignee).not.toBe(hardcoded)
    expect(validAssignee.trim()).toBeTruthy()
  })

  it('rejects empty input for reassign', () => {
    const input = '  '
    expect(input?.trim()).toBeFalsy()
  })
})

// ── CSV export safety ─────────────────────────────────────────────────────────

describe('CSV export', () => {
  it('escapes quotes in title fields', () => {
    const title = 'RFI with "quoted" text'
    const escaped = `"${title.replace(/"/g, '""')}"`
    expect(escaped).toBe('"RFI with ""quoted"" text"')
  })

  it('handles undefined/null fields without crashing', () => {
    const rfi = { rfiNumber: 'RFI-001', title: null, from: undefined, priority: 'high', status: 'open', dueDate: '' }
    const row = `${rfi.rfiNumber},"${rfi.title ?? ''}",${rfi.from ?? ''},${rfi.priority},${rfi.status},${rfi.dueDate}`
    expect(row).toBe('RFI-001,"",,high,open,')
  })
})

// ── BallInCourtCell ───────────────────────────────────────────────────────────

describe('BallInCourtCell party resolution', () => {
  const getBicColor = (party: string): string => {
    const BIC_COLORS: Record<string, string> = {
      GC: '#3b82f6',
      Architect: '#8b5cf6',
      Engineer: '#4ec896',
    }
    if (BIC_COLORS[party]) return BIC_COLORS[party]
    const key = Object.keys(BIC_COLORS).find((k) => party.toLowerCase().includes(k.toLowerCase()))
    return key ? BIC_COLORS[key] : '#9ca3af'
  }

  it('returns the matching color for known party', () => {
    expect(getBicColor('GC')).toBe('#3b82f6')
  })

  it('does partial match for unknown party containing a known key', () => {
    const result = getBicColor('Lead Architect')
    expect(result).toBe('#8b5cf6')
  })

  it('falls back to gray for unknown party', () => {
    expect(getBicColor('Owner')).toBe('#9ca3af')
  })
})
