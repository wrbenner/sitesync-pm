import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  computeScheduleKPIs,
  calculateCriticalPath,
  computeCriticalPathExt,
  tasksToCPM,
} from './criticalPath'
import type { CPMTask, CPMTaskExt } from './criticalPath'
import type { SchedulePhase } from '../stores/scheduleStore'

// ── Helpers ───────────────────────────────────────────────────────

// Most KPI tests need a fixed "today" so projected-completion + SPI are deterministic.
const FIXED_TODAY = '2026-04-15T00:00:00Z'

function makePhase(overrides: Partial<SchedulePhase>): SchedulePhase {
  // Only the fields read by computeScheduleKPIs are populated; rest are best-effort
  // defaults so the cast to SchedulePhase is honest about what the function actually
  // touches.
  return {
    id: overrides.id ?? 'p1',
    name: 'phase',
    startDate: overrides.startDate ?? '2026-04-01',
    endDate: overrides.endDate ?? '2026-04-30',
    progress: overrides.progress ?? 0,
    critical: overrides.critical ?? false,
    floatDays: overrides.floatDays ?? 0,
    slippageDays: overrides.slippageDays ?? 0,
    baselineEndDate: overrides.baselineEndDate ?? null,
    ...overrides,
  } as SchedulePhase
}

// ── computeScheduleKPIs ───────────────────────────────────────────

describe('computeScheduleKPIs — empty input', () => {
  it('returns the neutral KPI payload (SPI=1, 100% on time) when no phases', () => {
    const k = computeScheduleKPIs([])
    expect(k.scheduleVarianceDays).toBe(0)
    expect(k.spi).toBe(1)
    expect(k.criticalPathLength).toBe(0)
    expect(k.floatConsumedPct).toBe(0)
    expect(k.activitiesOnTimePct).toBe(100)
    expect(k.projectedCompletionDate).toBe('')
  })
})

describe('computeScheduleKPIs — schedule variance', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(FIXED_TODAY))
  })
  afterEach(() => { vi.useRealTimers() })

  it('positive variance when current end is BEFORE baseline (project ahead of schedule)', () => {
    const phases = [
      makePhase({
        id: 'a', critical: true,
        startDate: '2026-04-01', endDate: '2026-04-20',
        baselineEndDate: '2026-04-25',
      }),
    ]
    expect(computeScheduleKPIs(phases).scheduleVarianceDays).toBe(5)
  })

  it('negative variance when current end is AFTER baseline (slipping)', () => {
    const phases = [
      makePhase({
        id: 'a', critical: true,
        startDate: '2026-04-01', endDate: '2026-05-05',
        baselineEndDate: '2026-04-30',
      }),
    ]
    expect(computeScheduleKPIs(phases).scheduleVarianceDays).toBe(-5)
  })

  it('uses the LAST critical phase by endDate as the variance anchor', () => {
    const phases = [
      makePhase({ id: 'early', critical: true, endDate: '2026-04-10', baselineEndDate: '2026-04-15' }),
      makePhase({ id: 'late',  critical: true, endDate: '2026-05-20', baselineEndDate: '2026-05-15' }), // -5
    ]
    expect(computeScheduleKPIs(phases).scheduleVarianceDays).toBe(-5)
  })

  it('variance stays 0 when no critical phases exist', () => {
    const phases = [
      makePhase({ id: 'a', critical: false, baselineEndDate: '2026-04-25' }),
    ]
    expect(computeScheduleKPIs(phases).scheduleVarianceDays).toBe(0)
  })

  it('variance stays 0 when critical phase has no baseline date', () => {
    const phases = [makePhase({ id: 'a', critical: true, baselineEndDate: null })]
    expect(computeScheduleKPIs(phases).scheduleVarianceDays).toBe(0)
  })
})

describe('computeScheduleKPIs — SPI (Schedule Performance Index)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(FIXED_TODAY))
  })
  afterEach(() => { vi.useRealTimers() })

  it('SPI = 1.0 when actual progress matches expected progress (on schedule)', () => {
    // Phase 4/1 → 4/29 (28 days). Today 4/15 → 14 days elapsed → 50% expected.
    const phases = [
      makePhase({ startDate: '2026-04-01', endDate: '2026-04-29', progress: 50 }),
    ]
    expect(computeScheduleKPIs(phases).spi).toBe(1)
  })

  it('SPI > 1 when ahead of plan (50% expected but 75% actual)', () => {
    const phases = [
      makePhase({ startDate: '2026-04-01', endDate: '2026-04-29', progress: 75 }),
    ]
    expect(computeScheduleKPIs(phases).spi).toBe(1.5)
  })

  it('SPI < 1 when behind plan (50% expected but 25% actual)', () => {
    const phases = [
      makePhase({ startDate: '2026-04-01', endDate: '2026-04-29', progress: 25 }),
    ]
    expect(computeScheduleKPIs(phases).spi).toBe(0.5)
  })

  it('SPI rounds to 2 decimals', () => {
    // Expected 0.5, actual 0.333 → 0.666666... → 0.67
    const phases = [
      makePhase({ startDate: '2026-04-01', endDate: '2026-04-29', progress: 33.3333 }),
    ]
    const spi = computeScheduleKPIs(phases).spi
    expect(spi).toBeGreaterThan(0.66)
    expect(spi).toBeLessThan(0.68)
  })

  it('SPI defaults to 1 when no work was expected yet (today before all start dates)', () => {
    const phases = [makePhase({ startDate: '2030-01-01', endDate: '2030-12-31', progress: 0 })]
    expect(computeScheduleKPIs(phases).spi).toBe(1)
  })
})

describe('computeScheduleKPIs — float + on-time + critical-path length', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(FIXED_TODAY))
  })
  afterEach(() => { vi.useRealTimers() })

  it('floatConsumedPct = avg(min(1, slippage/float)) over phases-with-float, as a percentage', () => {
    const phases = [
      makePhase({ id: 'a', floatDays: 10, slippageDays: 5 }),  // 50% consumed
      makePhase({ id: 'b', floatDays: 10, slippageDays: 10 }), // 100% consumed
    ]
    expect(computeScheduleKPIs(phases).floatConsumedPct).toBe(75)
  })

  it('floatConsumedPct caps at 100% even when slippage > float (overshoot guard)', () => {
    const phases = [
      makePhase({ id: 'a', floatDays: 5, slippageDays: 50 }), // would be 1000% raw
    ]
    expect(computeScheduleKPIs(phases).floatConsumedPct).toBe(100)
  })

  it('floatConsumedPct = 0 when nobody has float to begin with', () => {
    const phases = [makePhase({ id: 'a', floatDays: 0, slippageDays: 5 })]
    expect(computeScheduleKPIs(phases).floatConsumedPct).toBe(0)
  })

  it('activitiesOnTimePct counts slippageDays <= 0 as on-time', () => {
    const phases = [
      makePhase({ id: 'a', slippageDays: 0 }),
      makePhase({ id: 'b', slippageDays: -3 }),
      makePhase({ id: 'c', slippageDays: 5 }),
    ]
    // 2 of 3 on time → 67%
    expect(computeScheduleKPIs(phases).activitiesOnTimePct).toBe(67)
  })

  it('criticalPathLength counts only phases marked critical', () => {
    const phases = [
      makePhase({ id: 'a', critical: true }),
      makePhase({ id: 'b', critical: true }),
      makePhase({ id: 'c', critical: false }),
    ]
    expect(computeScheduleKPIs(phases).criticalPathLength).toBe(2)
  })
})

// ── calculateCriticalPath (legacy CPM) ────────────────────────────

describe('calculateCriticalPath — single task', () => {
  it('one isolated task is on the critical path with zero float', () => {
    const tasks: CPMTask[] = [{ id: 't1', title: 'Solo', duration: 5, predecessors: [] }]
    const r = calculateCriticalPath(tasks)
    const t1 = r.get('t1')!
    expect(t1.earlyStart).toBe(0)
    expect(t1.earlyFinish).toBe(5)
    expect(t1.totalFloat).toBe(0)
    expect(t1.isCritical).toBe(true)
  })
})

describe('calculateCriticalPath — sequential chain', () => {
  it('A(2)→B(3)→C(1): finish at 6, all on critical path with 0 float', () => {
    const tasks: CPMTask[] = [
      { id: 'A', title: 'A', duration: 2, predecessors: [] },
      { id: 'B', title: 'B', duration: 3, predecessors: ['A'] },
      { id: 'C', title: 'C', duration: 1, predecessors: ['B'] },
    ]
    const r = calculateCriticalPath(tasks)
    expect(r.get('A')!.earlyFinish).toBe(2)
    expect(r.get('B')!.earlyStart).toBe(2)
    expect(r.get('B')!.earlyFinish).toBe(5)
    expect(r.get('C')!.earlyFinish).toBe(6)
    expect(r.get('A')!.isCritical).toBe(true)
    expect(r.get('B')!.isCritical).toBe(true)
    expect(r.get('C')!.isCritical).toBe(true)
  })
})

describe('calculateCriticalPath — parallel branches with float', () => {
  it('Long branch (A→B[5]→D) is critical, short branch (A→C[2]→D) has float', () => {
    //          B(5)
    //        /       \
    //   A(1)         D(1)
    //        \       /
    //          C(2)
    // Critical path: A→B→D, length 7. Branch C should have 3 days of float.
    const tasks: CPMTask[] = [
      { id: 'A', title: 'A', duration: 1, predecessors: [] },
      { id: 'B', title: 'B', duration: 5, predecessors: ['A'] },
      { id: 'C', title: 'C', duration: 2, predecessors: ['A'] },
      { id: 'D', title: 'D', duration: 1, predecessors: ['B', 'C'] },
    ]
    const r = calculateCriticalPath(tasks)
    expect(r.get('A')!.isCritical).toBe(true)
    expect(r.get('B')!.isCritical).toBe(true)
    expect(r.get('D')!.isCritical).toBe(true)
    expect(r.get('C')!.isCritical).toBe(false)
    expect(r.get('C')!.totalFloat).toBe(3) // 5 - 2 = 3 days slack
  })
})

describe('calculateCriticalPath — orphan predecessor reference', () => {
  it('silently ignores predecessor IDs that do not match any task', () => {
    const tasks: CPMTask[] = [
      { id: 'A', title: 'A', duration: 4, predecessors: ['ghost'] },
    ]
    const r = calculateCriticalPath(tasks)
    expect(r.get('A')!.earlyStart).toBe(0)
    expect(r.get('A')!.earlyFinish).toBe(4)
  })
})

// ── computeCriticalPathExt (FS / SS / FF / SF + lag) ──────────────

describe('computeCriticalPathExt — duration derivation', () => {
  it('uses durationDays when provided', () => {
    const tasks: CPMTaskExt[] = [{ id: 'a', durationDays: 7 }]
    const r = computeCriticalPathExt(tasks)
    expect(r.get('a')!.durationDays).toBe(7)
  })

  it('falls back to (endDate - startDate) days when durationDays missing', () => {
    const tasks: CPMTaskExt[] = [{ id: 'a', startDate: '2026-04-01', endDate: '2026-04-11' }]
    expect(computeCriticalPathExt(tasks).get('a')!.durationDays).toBe(10)
  })

  it('defaults to 1 day when neither duration nor dates are given', () => {
    expect(computeCriticalPathExt([{ id: 'a' }]).get('a')!.durationDays).toBe(1)
  })
})

describe('computeCriticalPathExt — dependency types', () => {
  it('FS (default): successor starts when predecessor finishes', () => {
    const tasks: CPMTaskExt[] = [
      { id: 'A', durationDays: 5 },
      { id: 'B', durationDays: 3, predecessorIds: ['A'] }, // dep defaults to FS
    ]
    const r = computeCriticalPathExt(tasks)
    expect(r.get('B')!.earlyStart).toBe(5)
    expect(r.get('B')!.earlyFinish).toBe(8)
  })

  it('SS: successor starts when predecessor starts (parallel-ish)', () => {
    const tasks: CPMTaskExt[] = [
      { id: 'A', durationDays: 5 },
      { id: 'B', durationDays: 3, predecessorIds: ['A'], dependencyType: 'SS' },
    ]
    expect(computeCriticalPathExt(tasks).get('B')!.earlyStart).toBe(0)
  })

  it('FF: successor finishes when predecessor finishes', () => {
    const tasks: CPMTaskExt[] = [
      { id: 'A', durationDays: 10 },
      { id: 'B', durationDays: 3, predecessorIds: ['A'], dependencyType: 'FF' },
    ]
    // earliest = predEarlyFinish(10) - duration(3) = 7
    expect(computeCriticalPathExt(tasks).get('B')!.earlyStart).toBe(7)
  })

  it('FS lag: 2-day lag pushes successor back by 2', () => {
    const tasks: CPMTaskExt[] = [
      { id: 'A', durationDays: 5 },
      { id: 'B', durationDays: 3, predecessorIds: ['A'], lagDays: 2 },
    ]
    expect(computeCriticalPathExt(tasks).get('B')!.earlyStart).toBe(7) // 5 + 2
  })
})

describe('computeCriticalPathExt — float + critical', () => {
  it('all tasks on critical path have floatDays=0 and isCritical=true', () => {
    const tasks: CPMTaskExt[] = [
      { id: 'A', durationDays: 2 },
      { id: 'B', durationDays: 3, predecessorIds: ['A'] },
    ]
    const r = computeCriticalPathExt(tasks)
    expect(r.get('A')!.floatDays).toBe(0)
    expect(r.get('A')!.isCritical).toBe(true)
    expect(r.get('B')!.isCritical).toBe(true)
  })

  it('parallel non-critical branch carries positive float', () => {
    const tasks: CPMTaskExt[] = [
      { id: 'root', durationDays: 1 },
      { id: 'long',  durationDays: 5, predecessorIds: ['root'] },
      { id: 'short', durationDays: 2, predecessorIds: ['root'] },
      { id: 'merge', durationDays: 1, predecessorIds: ['long', 'short'] },
    ]
    const r = computeCriticalPathExt(tasks)
    expect(r.get('long')!.isCritical).toBe(true)
    expect(r.get('short')!.isCritical).toBe(false)
    expect(r.get('short')!.floatDays).toBe(3)
  })
})

describe('computeCriticalPathExt — cycle survival', () => {
  it('does not throw or hang when predecessors form a cycle (degraded ordering)', () => {
    const tasks: CPMTaskExt[] = [
      { id: 'A', durationDays: 1, predecessorIds: ['B'] },
      { id: 'B', durationDays: 1, predecessorIds: ['A'] },
    ]
    expect(() => computeCriticalPathExt(tasks)).not.toThrow()
  })
})

// ── tasksToCPM ────────────────────────────────────────────────────

describe('tasksToCPM — DB-row → CPMTask conversion', () => {
  it('derives duration from start/end date difference (rounded up)', () => {
    const out = tasksToCPM([
      { id: 't1', title: 'a', start_date: '2026-04-01', end_date: '2026-04-11', predecessor_ids: null, estimated_hours: null },
    ])
    expect(out[0].duration).toBe(10)
  })

  it('falls back to estimated_hours/8 when dates absent', () => {
    const out = tasksToCPM([
      { id: 't1', title: 'a', start_date: null, end_date: null, predecessor_ids: null, estimated_hours: 24 },
    ])
    expect(out[0].duration).toBe(3) // 24h / 8h-per-day
  })

  it('defaults to 1-day duration when no signal at all', () => {
    const out = tasksToCPM([
      { id: 't1', title: 'a', start_date: null, end_date: null, predecessor_ids: null, estimated_hours: null },
    ])
    expect(out[0].duration).toBe(1)
  })

  it('null predecessor_ids becomes empty array', () => {
    const out = tasksToCPM([
      { id: 't1', title: 'a', start_date: null, end_date: null, predecessor_ids: null, estimated_hours: null },
    ])
    expect(out[0].predecessors).toEqual([])
  })

  it('preserves predecessor_ids when provided', () => {
    const out = tasksToCPM([
      { id: 't1', title: 'a', start_date: null, end_date: null, predecessor_ids: ['p1', 'p2'], estimated_hours: null },
    ])
    expect(out[0].predecessors).toEqual(['p1', 'p2'])
  })

  it('clamps duration at minimum 1 day even when dates collapse to zero', () => {
    const out = tasksToCPM([
      { id: 't1', title: 'a', start_date: '2026-04-10', end_date: '2026-04-10', predecessor_ids: null, estimated_hours: null },
    ])
    expect(out[0].duration).toBeGreaterThanOrEqual(1)
  })
})
