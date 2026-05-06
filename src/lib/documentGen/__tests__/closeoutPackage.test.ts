import { describe, it, expect } from 'vitest'
import { generateCloseoutPackage } from '../closeoutPackage'
import type { ProjectSnapshot } from '../snapshot'

function snap(overrides: Partial<ProjectSnapshot> = {}): ProjectSnapshot {
  return {
    meta: {
      project_id: 'p1',
      project_name: 'Avery Oaks',
      snapshot_at: '2026-04-29T00:00:00Z',
      period_start: '2025-04-29T00:00:00Z',
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

describe('generateCloseoutPackage', () => {
  it('always includes a project-summary section', () => {
    const doc = generateCloseoutPackage(snap())
    expect(doc.sections[0].heading).toBe('Project summary')
  })

  it('includes a punch list of OPEN items only', () => {
    const doc = generateCloseoutPackage(
      snap({
        punch_items: [
          { id: '1', title: 'open one', status: 'open', severity: 'low', trade: 'paint' },
          { id: '2', title: 'closed one', status: 'closed', severity: 'low', trade: 'paint' },
        ],
      }),
    )
    const punch = doc.sections.find((s) => s.heading === 'Punch list (open)')
    expect(punch?.rows?.length).toBe(1)
    expect(punch?.rows?.[0].Title).toBe('open one')
  })

  it('is deterministic across runs', () => {
    const a = generateCloseoutPackage(snap())
    const b = generateCloseoutPackage(snap())
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })
})
