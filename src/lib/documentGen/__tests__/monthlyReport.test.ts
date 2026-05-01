import { describe, it, expect } from 'vitest'
import { generateMonthlyReport } from '../monthlyReport'
import type { ProjectSnapshot } from '../snapshot'

function emptySnapshot(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    meta: {
      project_id: 'p1',
      project_name: 'Avery Oaks',
      snapshot_at: '2026-04-29T00:00:00Z',
      period_start: '2026-04-01T00:00:00Z',
      period_end: '2026-04-30T00:00:00Z',
    },
    rfis: [],
    submittals: [],
    change_orders: [],
    punch_items: [],
    daily_logs: [],
    inspections: [],
    payments: [],
    ...overrides,
  }
}

describe('generateMonthlyReport', () => {
  it('always emits a KPI section even with no data', () => {
    const doc = generateMonthlyReport({ snapshot: emptySnapshot(), month: '2026-04' })
    expect(doc.sections[0].heading).toBe('Project KPIs')
    expect(doc.title).toContain('Avery Oaks')
  })

  it('includes outstanding RFIs section when there are unresolved RFIs', () => {
    const snap = emptySnapshot({
      rfis: [
        { id: '1', number: 1, title: 'r1', status: 'pending_response', sent_at: null, responded_at: null, days_open: 6 },
      ],
    })
    const doc = generateMonthlyReport({ snapshot: snap, month: '2026-04' })
    expect(doc.sections.some((s) => s.heading === 'Outstanding RFIs')).toBe(true)
  })

  it('is deterministic — same inputs produce same outputs (idempotency)', () => {
    const snap = emptySnapshot()
    const a = generateMonthlyReport({ snapshot: snap, month: '2026-04' })
    const b = generateMonthlyReport({ snapshot: snap, month: '2026-04' })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('omits failed-inspections section when none failed', () => {
    const snap = emptySnapshot({
      inspections: [{ id: '1', inspection_type: 'Framing', date: '2026-04-15', result: 'pass', deficiencies_count: 0 }],
    })
    const doc = generateMonthlyReport({ snapshot: snap, month: '2026-04' })
    expect(doc.sections.find((s) => s.heading === 'Failed inspections')).toBeUndefined()
  })
})
