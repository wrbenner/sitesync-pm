import { describe, it, expect, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Pure business logic used by the RFIs page (replicated here since these
// helper functions are internal to the page and not exported).
// Tests serve as a specification for the algorithm, catching regressions if
// the logic is ever factored into a shared utility.
// ---------------------------------------------------------------------------

// ── isOverdue ──────────────────────────────────────────────
// An RFI due date is overdue when it is strictly in the past.
const isOverdue = (dateStr: string) => new Date(dateStr) < new Date()

// ── BIC color lookup ───────────────────────────────────────
const BIC_COLORS: Record<string, string> = {
  GC: '#3B82F6',
  Architect: '#8B5CF6',
  Engineer: '#14B8A6',
  Owner: '#F47820',
  Subcontractor: '#6B7280',
  Sub: '#6B7280',
}

const getBicColor = (party: string): string => {
  if (BIC_COLORS[party]) return BIC_COLORS[party]
  const key = Object.keys(BIC_COLORS).find(k => party.toLowerCase().includes(k.toLowerCase()))
  return key ? BIC_COLORS[key] : '#6B7280'
}

// ── deriveBic ──────────────────────────────────────────────
// Returns the party currently holding the ball in court.
const deriveBic = (rfi: { status: string; assigned_to: string | null; from?: string | null }): string | null => {
  const { status, assigned_to, from: originator } = rfi
  if (status === 'open' && assigned_to) return assigned_to
  if (status === 'under_review') return assigned_to || null
  if (status === 'answered') return originator || null
  return assigned_to || null
}

// ── RFI number formatting ──────────────────────────────────
// Mirrors the useMemo mapping inside RFIsPage: r.number ? `RFI-${pad3}` : id[:8]
const formatRfiNumber = (number: number | null | undefined, id: string): string => {
  if (number) return `RFI-${String(number).padStart(3, '0')}`
  return String(id).slice(0, 8)
}

// ── avgDaysToClose ─────────────────────────────────────────
function avgDaysToClose(rfis: Array<{ status: string; closed_at?: string | null; created_at?: string | null }>): number {
  const closed = rfis.filter(r => r.status === 'closed' && r.closed_at && r.created_at)
  if (!closed.length) return 0
  const total = closed.reduce((sum, r) => {
    return sum + Math.floor((new Date(r.closed_at!).getTime() - new Date(r.created_at!).getTime()) / 86400000)
  }, 0)
  return Math.round(total / closed.length)
}

// ---------------------------------------------------------------------------
// isOverdue tests
// ---------------------------------------------------------------------------

describe('isOverdue', () => {
  it('should return true for a past date', () => {
    expect(isOverdue('2020-01-01')).toBe(true)
  })

  it('should return false for a far future date', () => {
    expect(isOverdue('2099-12-31')).toBe(false)
  })

  it('should handle ISO datetime strings', () => {
    expect(isOverdue('2019-06-15T10:00:00Z')).toBe(true)
    expect(isOverdue('2099-06-15T10:00:00Z')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// getBicColor tests
// ---------------------------------------------------------------------------

describe('getBicColor — Ball in Court color lookup', () => {
  it('should return the GC color for "GC"', () => {
    expect(getBicColor('GC')).toBe('#3B82F6')
  })

  it('should return the Architect color for "Architect"', () => {
    expect(getBicColor('Architect')).toBe('#8B5CF6')
  })

  it('should return the Engineer color for "Engineer"', () => {
    expect(getBicColor('Engineer')).toBe('#14B8A6')
  })

  it('should return the Owner color for "Owner"', () => {
    expect(getBicColor('Owner')).toBe('#F47820')
  })

  it('should return the Subcontractor color for "Subcontractor"', () => {
    expect(getBicColor('Subcontractor')).toBe('#6B7280')
  })

  it('should return the Sub color for "Sub"', () => {
    expect(getBicColor('Sub')).toBe('#6B7280')
  })

  it('should do a case-insensitive partial match for "GC Superintendent"', () => {
    // "GC" is contained in the party name
    expect(getBicColor('GC Superintendent')).toBe('#3B82F6')
  })

  it('should return fallback gray for an unknown party', () => {
    expect(getBicColor('Unknown Party Inc.')).toBe('#6B7280')
  })

  it('should return fallback gray for an empty string', () => {
    expect(getBicColor('')).toBe('#6B7280')
  })

  it('should do case-insensitive match for "architect of record"', () => {
    expect(getBicColor('architect of record')).toBe('#8B5CF6')
  })
})

// ---------------------------------------------------------------------------
// deriveBic tests
// ---------------------------------------------------------------------------

describe('deriveBic — Ball in Court derivation', () => {
  it('should return assigned_to when status is open and assigned_to is set', () => {
    expect(deriveBic({ status: 'open', assigned_to: 'Architect' })).toBe('Architect')
  })

  it('should return null when status is open and no assigned_to', () => {
    expect(deriveBic({ status: 'open', assigned_to: null })).toBeNull()
  })

  it('should return assigned_to when status is under_review', () => {
    expect(deriveBic({ status: 'under_review', assigned_to: 'Engineer' })).toBe('Engineer')
  })

  it('should return null when under_review with no assigned_to', () => {
    expect(deriveBic({ status: 'under_review', assigned_to: null })).toBeNull()
  })

  it('should return originator (from) when status is answered', () => {
    expect(deriveBic({ status: 'answered', assigned_to: null, from: 'GC' })).toBe('GC')
  })

  it('should return null when answered with no originator', () => {
    expect(deriveBic({ status: 'answered', assigned_to: null, from: null })).toBeNull()
  })

  it('should fall through to assigned_to for unrecognized status', () => {
    expect(deriveBic({ status: 'closed', assigned_to: 'Subcontractor' })).toBe('Subcontractor')
  })

  it('should return null for closed status with no assigned_to', () => {
    expect(deriveBic({ status: 'closed', assigned_to: null })).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// RFI number formatting tests
// ---------------------------------------------------------------------------

describe('formatRfiNumber', () => {
  it('should format number 1 as "RFI-001"', () => {
    expect(formatRfiNumber(1, 'some-id')).toBe('RFI-001')
  })

  it('should format number 47 as "RFI-047"', () => {
    expect(formatRfiNumber(47, 'some-id')).toBe('RFI-047')
  })

  it('should format number 100 as "RFI-100"', () => {
    expect(formatRfiNumber(100, 'some-id')).toBe('RFI-100')
  })

  it('should use first 8 chars of id when number is null', () => {
    expect(formatRfiNumber(null, 'abcdefgh-1234-5678')).toBe('abcdefgh')
  })

  it('should use first 8 chars of id when number is undefined', () => {
    expect(formatRfiNumber(undefined, 'xyz12345-rest-of-id')).toBe('xyz12345')
  })
})

// ---------------------------------------------------------------------------
// avgDaysToClose tests
// ---------------------------------------------------------------------------

describe('avgDaysToClose', () => {
  it('should return 0 when there are no closed RFIs', () => {
    const rfis = [
      { status: 'open', created_at: '2026-01-01T00:00:00Z' },
      { status: 'under_review', created_at: '2026-01-05T00:00:00Z' },
    ]
    expect(avgDaysToClose(rfis)).toBe(0)
  })

  it('should return 0 when array is empty', () => {
    expect(avgDaysToClose([])).toBe(0)
  })

  it('should calculate correct average for a single closed RFI', () => {
    const rfis = [{
      status: 'closed',
      created_at: '2026-01-01T00:00:00Z',
      closed_at: '2026-01-15T00:00:00Z', // 14 days
    }]
    expect(avgDaysToClose(rfis)).toBe(14)
  })

  it('should average multiple closed RFIs', () => {
    const rfis = [
      { status: 'closed', created_at: '2026-01-01T00:00:00Z', closed_at: '2026-01-11T00:00:00Z' }, // 10 days
      { status: 'closed', created_at: '2026-01-01T00:00:00Z', closed_at: '2026-01-21T00:00:00Z' }, // 20 days
    ]
    expect(avgDaysToClose(rfis)).toBe(15) // (10 + 20) / 2
  })

  it('should ignore open RFIs in the average', () => {
    const rfis = [
      { status: 'open', created_at: '2026-01-01T00:00:00Z' },
      { status: 'closed', created_at: '2026-01-01T00:00:00Z', closed_at: '2026-01-08T00:00:00Z' }, // 7 days
    ]
    expect(avgDaysToClose(rfis)).toBe(7)
  })

  it('should ignore closed RFIs missing dates', () => {
    const rfis = [
      { status: 'closed', created_at: null, closed_at: '2026-01-15T00:00:00Z' },
      { status: 'closed', created_at: '2026-01-01T00:00:00Z', closed_at: null },
      { status: 'closed', created_at: '2026-01-01T00:00:00Z', closed_at: '2026-01-04T00:00:00Z' }, // 3 days
    ]
    expect(avgDaysToClose(rfis)).toBe(3)
  })
})

// ---------------------------------------------------------------------------
// RFI SLA awareness (14-day industry standard)
// ---------------------------------------------------------------------------

describe('RFI 14-day SLA', () => {
  it('should correctly identify an RFI past the 14-day SLA as overdue', () => {
    const createdAt = new Date()
    createdAt.setDate(createdAt.getDate() - 15) // 15 days ago
    const dueDate = new Date(createdAt)
    dueDate.setDate(dueDate.getDate() + 14) // due 14 days after creation = yesterday
    expect(isOverdue(dueDate.toISOString())).toBe(true)
  })

  it('should correctly identify an RFI within the 14-day SLA as not overdue', () => {
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 7) // due in 7 days
    expect(isOverdue(dueDate.toISOString())).toBe(false)
  })
})
