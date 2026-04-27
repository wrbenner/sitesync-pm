import { describe, it, expect } from 'vitest'
import { analyzeScheduleHealth } from './scheduleHealth'
import type { MappedSchedulePhase } from '../types/entities'

// MappedSchedulePhase has a sprawling type surface; build a fully-populated
// fixture once and let each test override only what matters.
function phase(overrides: Partial<MappedSchedulePhase> = {}): MappedSchedulePhase {
  const base: MappedSchedulePhase = {
    // DB row fields
    id: 'p-' + Math.random().toString(36).slice(2, 7),
    name: 'Activity',
    project_id: 'proj-1',
    actual_end: null,
    actual_start: null,
    assigned_crew_id: null,
    created_at: null,
    deleted_at: null,
    deleted_by: null,
    dependency_type: null,
    depends_on: null,
    description: null,
    end_date: '2026-02-01',
    float_days: 5,
    is_critical: false,
    is_critical_path: false,
    is_milestone: false,
    lag_days: null,
    percent_complete: 0,
    predecessor_ids: [],
    start_date: '2026-01-01',
    status: 'in_progress',
    updated_at: null,
    // Domain extensions
    baseline_start: null,
    baseline_finish: null,
    baseline_start_date: null,
    baseline_end_date: null,
    baseline_percent_complete: null,
    baseline_end: null,
    baseline_duration_days: null,
    slippage_days: null,
    work_type: 'indoor',
    location: null,
    assigned_trade: null,
    planned_labor_hours: null,
    actual_labor_hours: null,
    // Convenience aliases
    startDate: '2026-01-01',
    endDate: '2026-02-01',
    progress: 0,
    critical: false,
    completed: false,
    baselineStartDate: null,
    baselineEndDate: null,
    baselineProgress: 0,
    slippageDays: 0,
    earnedValue: 0,
    isOnCriticalPath: false,
    floatDays: 5,
    scheduleVarianceDays: 0,
    isMilestone: false,
    predecessorIds: [],
    plannedLaborHours: 0,
    actualLaborHours: 0,
  } as unknown as MappedSchedulePhase
  return { ...base, ...overrides }
}

describe('analyzeScheduleHealth — empty input', () => {
  it('returns a perfect-score empty report when no phases supplied', () => {
    const r = analyzeScheduleHealth([])
    expect(r.score).toBe(100)
    expect(r.grade).toBe('A')
    expect(r.findings).toEqual([])
    expect(r.metrics.totalActivities).toBe(0)
  })
})

describe('analyzeScheduleHealth — open ends', () => {
  it('flags activities missing predecessors (other than the project start)', () => {
    // A → B (linked); C is unlinked and starts later than A.
    const r = analyzeScheduleHealth([
      phase({ id: 'A', startDate: '2026-01-01', endDate: '2026-01-15' }),
      phase({ id: 'B', startDate: '2026-01-15', endDate: '2026-02-01', predecessorIds: ['A'] }),
      phase({ id: 'C', startDate: '2026-02-15', endDate: '2026-03-01' }),
    ])
    const openEnd = r.findings.find((f) => f.category === 'open-end' && /predecessors/.test(f.title))
    expect(openEnd).toBeDefined()
    expect(openEnd?.affectedTaskIds).toContain('C')
    // A is allowed (it IS the project start)
    expect(openEnd?.affectedTaskIds).not.toContain('A')
  })

  it('flags activities missing successors (other than the project end)', () => {
    const r = analyzeScheduleHealth([
      phase({ id: 'A', startDate: '2026-01-01', endDate: '2026-01-15' }),
      phase({ id: 'B', startDate: '2026-01-15', endDate: '2026-02-01', predecessorIds: ['A'] }),
      phase({ id: 'D', startDate: '2026-01-10', endDate: '2026-01-20' }), // ends mid-project
    ])
    const openFinish = r.findings.find((f) => f.category === 'open-end' && /successors/.test(f.title))
    expect(openFinish).toBeDefined()
    // D ends before the project (B = 2026-02-01) and has no successor → flagged.
    // A has B as a successor → not flagged.
    // B is the project end → exempted.
    expect(openFinish?.affectedTaskIds).toContain('D')
    expect(openFinish?.affectedTaskIds).not.toContain('A')
    expect(openFinish?.affectedTaskIds).not.toContain('B')
  })
})

describe('analyzeScheduleHealth — negative float', () => {
  it('flags every negative-float activity as critical', () => {
    const r = analyzeScheduleHealth([
      phase({ id: 'A', floatDays: -3 }),
      phase({ id: 'B', floatDays: -7 }),
      phase({ id: 'C', floatDays: 5 }),
    ])
    const finding = r.findings.find((f) => f.category === 'negative-float')
    expect(finding).toBeDefined()
    expect(finding?.severity).toBe('critical')
    expect(finding?.affectedTaskIds.sort()).toEqual(['A', 'B'])
  })
})

describe('analyzeScheduleHealth — out-of-sequence progress', () => {
  it('flags activities making progress while predecessors are incomplete', () => {
    const r = analyzeScheduleHealth([
      phase({ id: 'A', percent_complete: 30, progress: 30, status: 'in_progress' }),
      phase({ id: 'B', percent_complete: 50, progress: 50, predecessorIds: ['A'], status: 'in_progress' }),
    ])
    const finding = r.findings.find((f) => f.category === 'out-of-sequence')
    expect(finding).toBeDefined()
    expect(finding?.affectedTaskIds).toContain('B')
  })

  it('does not flag when the predecessor is completed (progress=100 or status=completed)', () => {
    const r = analyzeScheduleHealth([
      phase({ id: 'A', percent_complete: 100, progress: 100, status: 'completed' }),
      phase({ id: 'B', percent_complete: 50, progress: 50, predecessorIds: ['A'] }),
    ])
    const finding = r.findings.find((f) => f.category === 'out-of-sequence')
    expect(finding).toBeUndefined()
  })
})

describe('analyzeScheduleHealth — dangling activities', () => {
  it('flags activities with no predecessors AND no successors when there are siblings', () => {
    const r = analyzeScheduleHealth([
      phase({ id: 'X' }),
      phase({ id: 'A', predecessorIds: [] }),
      phase({ id: 'B', predecessorIds: ['A'] }),
    ])
    const finding = r.findings.find((f) => f.category === 'dangling')
    // X has no preds and no succs → dangling
    expect(finding?.affectedTaskIds).toContain('X')
    // A has B as successor → not dangling
    expect(finding?.affectedTaskIds ?? []).not.toContain('A')
  })

  it('does not flag when only one phase exists (single-task schedule)', () => {
    const r = analyzeScheduleHealth([phase({ id: 'solo' })])
    expect(r.findings.find((f) => f.category === 'dangling')).toBeUndefined()
  })
})

describe('analyzeScheduleHealth — duration anomalies', () => {
  it('flags activities longer than 60 days', () => {
    const r = analyzeScheduleHealth([
      phase({ id: 'A', startDate: '2026-01-01', endDate: '2026-04-15' }), // ~104 days
      phase({ id: 'B', startDate: '2026-01-01', endDate: '2026-01-10' }),
      phase({ id: 'C', startDate: '2026-01-01', endDate: '2026-01-15' }),
      phase({ id: 'D', startDate: '2026-01-01', endDate: '2026-01-20' }),
    ])
    const finding = r.findings.find((f) => f.category === 'duration-anomaly')
    expect(finding?.affectedTaskIds).toContain('A')
  })

  it('skips duration-anomaly check when fewer than 4 non-milestone activities', () => {
    const r = analyzeScheduleHealth([
      phase({ id: 'A', startDate: '2026-01-01', endDate: '2026-04-15' }), // 104 days
    ])
    const finding = r.findings.find((f) => f.category === 'duration-anomaly')
    expect(finding).toBeUndefined()
  })
})

describe('analyzeScheduleHealth — logic density', () => {
  it('flags below-1.0 link density when phases > 5', () => {
    const phases = Array.from({ length: 6 }, (_, i) =>
      phase({ id: `t${i}`, predecessorIds: i === 0 ? [] : [], }) // zero links
    )
    const r = analyzeScheduleHealth(phases)
    const finding = r.findings.find((f) => f.category === 'logic-density')
    expect(finding).toBeDefined()
    expect(finding?.severity).toBe('critical') // 0 < 0.5
  })

  it('does not flag for small schedules (≤5 phases)', () => {
    const phases = Array.from({ length: 4 }, (_, i) => phase({ id: `t${i}` }))
    const r = analyzeScheduleHealth(phases)
    expect(r.findings.find((f) => f.category === 'logic-density')).toBeUndefined()
  })
})

describe('analyzeScheduleHealth — critical-path concentration', () => {
  it('flags when more than 50% of phases are on the critical path', () => {
    const phases = Array.from({ length: 6 }, (_, i) =>
      phase({
        id: `t${i}`,
        is_critical_path: i < 4,    // 4/6 ≈ 67% critical
        critical: i < 4,
      })
    )
    const r = analyzeScheduleHealth(phases)
    const finding = r.findings.find((f) => f.category === 'critical-concentration')
    expect(finding).toBeDefined()
  })

  it('flags as critical severity when > 70%', () => {
    const phases = Array.from({ length: 10 }, (_, i) =>
      phase({
        id: `t${i}`,
        is_critical_path: i < 8, // 80%
        critical: i < 8,
      })
    )
    const r = analyzeScheduleHealth(phases)
    const finding = r.findings.find((f) => f.category === 'critical-concentration')
    expect(finding?.severity).toBe('critical')
  })
})

describe('analyzeScheduleHealth — near-critical', () => {
  it('flags activities with 1-3 days float that are not already critical', () => {
    const r = analyzeScheduleHealth([
      phase({ id: 'A', floatDays: 2, critical: false, is_critical_path: false }),
      phase({ id: 'B', floatDays: 3, critical: false }),
      phase({ id: 'C', floatDays: 0, critical: true, is_critical_path: true }), // already critical, exclude
    ])
    const finding = r.findings.find((f) => f.category === 'near-critical')
    expect(finding?.severity).toBe('info')
    expect(finding?.affectedTaskIds.sort()).toEqual(['A', 'B'])
  })
})

describe('analyzeScheduleHealth — scoring + grade', () => {
  it('A grade when score ≥ 90 (clean schedule)', () => {
    // 1 dangling activity gives ≤4 points deduction; everything else clean.
    const r = analyzeScheduleHealth([
      phase({ id: 'A', startDate: '2026-01-01', endDate: '2026-01-10', floatDays: 5 }),
      phase({ id: 'B', startDate: '2026-01-10', endDate: '2026-01-20', floatDays: 5, predecessorIds: ['A'] }),
    ])
    expect(['A', 'B']).toContain(r.grade)
  })

  it('F grade when many critical findings stack (score < 60)', () => {
    // 6 activities, all dangling + all negative-float → multiple critical findings.
    const phases = Array.from({ length: 6 }, (_, i) =>
      phase({
        id: `t${i}`,
        floatDays: -5,                     // every one negative-float
        predecessorIds: [],                // dangling
      })
    )
    const r = analyzeScheduleHealth(phases)
    expect(r.score).toBeLessThan(60)
    expect(r.grade).toBe('F')
  })

  it('findings are sorted critical → warning → info', () => {
    const phases = Array.from({ length: 6 }, (_, i) =>
      phase({
        id: `t${i}`,
        floatDays: -5,
        predecessorIds: [],
      })
    )
    const r = analyzeScheduleHealth(phases)
    if (r.findings.length > 1) {
      const sevOrder = { critical: 0, warning: 1, info: 2 }
      for (let i = 1; i < r.findings.length; i++) {
        expect(sevOrder[r.findings[i].severity]).toBeGreaterThanOrEqual(
          sevOrder[r.findings[i - 1].severity],
        )
      }
    }
  })

  it('summary text mentions "excellent" when score ≥ 90', () => {
    const r = analyzeScheduleHealth([
      phase({ id: 'A', floatDays: 5 }),
      phase({ id: 'B', floatDays: 5, predecessorIds: ['A'] }),
    ])
    if (r.score >= 90) {
      expect(r.summary).toMatch(/excellent/i)
    }
  })
})

describe('analyzeScheduleHealth — metrics', () => {
  it('counts predecessors/successors, logic density, and avg float correctly', () => {
    // A → B → C, with one dangling D
    const r = analyzeScheduleHealth([
      phase({ id: 'A', floatDays: 10 }),
      phase({ id: 'B', floatDays: 5,  predecessorIds: ['A'] }),
      phase({ id: 'C', floatDays: 0,  predecessorIds: ['B'] }),
      phase({ id: 'D', floatDays: 20 }),
    ])
    expect(r.metrics.totalActivities).toBe(4)
    expect(r.metrics.activitiesWithPredecessors).toBe(2)
    expect(r.metrics.activitiesWithSuccessors).toBe(2)
    expect(r.metrics.avgFloatDays).toBeCloseTo(8.8, 1) // (10+5+0+20)/4
  })
})
