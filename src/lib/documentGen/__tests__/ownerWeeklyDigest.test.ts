import { describe, it, expect } from 'vitest'
import { generateOwnerWeeklyDigest } from '../ownerWeeklyDigest'
import type { ProjectSnapshot } from '../snapshot'

function snap(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    meta: {
      project_id: 'p1',
      project_name: 'Avery Oaks',
      snapshot_at: '2026-04-29T00:00:00Z',
      period_start: '2026-04-22T00:00:00Z',
      period_end: '2026-04-29T00:00:00Z',
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

describe('generateOwnerWeeklyDigest', () => {
  it('returns a "this week" section with key counters', () => {
    const doc = generateOwnerWeeklyDigest(snap())
    expect(doc.sections[0].heading).toBe('This week')
    expect(doc.sections[0].bullets?.length).toBeGreaterThan(0)
  })

  it('lists change orders when present', () => {
    const doc = generateOwnerWeeklyDigest(
      snap({
        change_orders: [
          { id: '1', number: 1, title: 'beam upgrade', status: 'pending_approval', cost_impact: 75000, schedule_impact_days: 5 },
        ],
      }),
    )
    expect(doc.sections.some((s) => s.heading === 'Change orders')).toBe(true)
  })

  it('handles zero data gracefully', () => {
    const doc = generateOwnerWeeklyDigest(snap())
    expect(doc.sections.length).toBeGreaterThan(0)
  })
})
