import { describe, it, expect } from 'vitest'
import {
  calculateCriticalPath,
  computeScheduleKPIs,
  tasksToCPM,
} from '../../lib/criticalPath'
import type { CPMTask } from '../../lib/criticalPath'
import type { SchedulePhase } from '../../stores/scheduleStore'

// ── calculateCriticalPath ─────────────────────────────────────

describe('calculateCriticalPath', () => {
  it('should return empty map for empty task list', () => {
    const result = calculateCriticalPath([])
    expect(result.size).toBe(0)
  })

  it('should compute single task as critical', () => {
    const tasks: CPMTask[] = [{ id: 'a', title: 'Foundation', duration: 10, predecessors: [] }]
    const result = calculateCriticalPath(tasks)
    const a = result.get('a')!
    expect(a.isCritical).toBe(true)
    expect(a.totalFloat).toBe(0)
  })

  it('should set early start to 0 for task with no predecessors', () => {
    const tasks: CPMTask[] = [{ id: 'a', title: 'Start', duration: 5, predecessors: [] }]
    const result = calculateCriticalPath(tasks)
    expect(result.get('a')!.earlyStart).toBe(0)
  })

  it('should set early finish = early start + duration', () => {
    const tasks: CPMTask[] = [{ id: 'a', title: 'Task', duration: 7, predecessors: [] }]
    const result = calculateCriticalPath(tasks)
    const a = result.get('a')!
    expect(a.earlyFinish).toBe(a.earlyStart + 7)
  })

  it('should chain two sequential tasks', () => {
    const tasks: CPMTask[] = [
      { id: 'a', title: 'Foundation', duration: 10, predecessors: [] },
      { id: 'b', title: 'Framing', duration: 5, predecessors: ['a'] },
    ]
    const result = calculateCriticalPath(tasks)
    expect(result.get('b')!.earlyStart).toBe(10)
    expect(result.get('b')!.earlyFinish).toBe(15)
  })

  it('should identify critical path in sequential chain', () => {
    const tasks: CPMTask[] = [
      { id: 'a', title: 'A', duration: 5, predecessors: [] },
      { id: 'b', title: 'B', duration: 3, predecessors: ['a'] },
    ]
    const result = calculateCriticalPath(tasks)
    expect(result.get('a')!.isCritical).toBe(true)
    expect(result.get('b')!.isCritical).toBe(true)
  })

  it('should identify non-critical parallel path with float', () => {
    // A (10 days) → C
    // B (3 days) → C
    // B has float because A determines critical path
    const tasks: CPMTask[] = [
      { id: 'a', title: 'A (long)', duration: 10, predecessors: [] },
      { id: 'b', title: 'B (short)', duration: 3, predecessors: [] },
      { id: 'c', title: 'C', duration: 5, predecessors: ['a', 'b'] },
    ]
    const result = calculateCriticalPath(tasks)
    const b = result.get('b')!
    expect(b.totalFloat).toBeGreaterThan(0)
    expect(b.isCritical).toBe(false)
  })

  it('should identify critical path through longest chain', () => {
    const tasks: CPMTask[] = [
      { id: 'a', title: 'A (long)', duration: 10, predecessors: [] },
      { id: 'b', title: 'B (short)', duration: 3, predecessors: [] },
      { id: 'c', title: 'C', duration: 5, predecessors: ['a', 'b'] },
    ]
    const result = calculateCriticalPath(tasks)
    expect(result.get('a')!.isCritical).toBe(true)
    expect(result.get('c')!.isCritical).toBe(true)
  })

  it('should handle diamond dependency pattern', () => {
    // A → B → D
    // A → C → D
    const tasks: CPMTask[] = [
      { id: 'a', title: 'A', duration: 5, predecessors: [] },
      { id: 'b', title: 'B', duration: 8, predecessors: ['a'] },
      { id: 'c', title: 'C', duration: 3, predecessors: ['a'] },
      { id: 'd', title: 'D', duration: 4, predecessors: ['b', 'c'] },
    ]
    const result = calculateCriticalPath(tasks)
    const d = result.get('d')!
    expect(d.earlyStart).toBe(13) // a(5) + b(8) = 13
    expect(result.get('b')!.isCritical).toBe(true)
    expect(result.get('c')!.isCritical).toBe(false)
  })

  it('should return correct total float for parallel path', () => {
    const tasks: CPMTask[] = [
      { id: 'a', title: 'Critical', duration: 10, predecessors: [] },
      { id: 'b', title: 'Parallel', duration: 3, predecessors: [] },
      { id: 'c', title: 'End', duration: 2, predecessors: ['a', 'b'] },
    ]
    const result = calculateCriticalPath(tasks)
    const b = result.get('b')!
    expect(b.totalFloat).toBe(7) // 10 - 3 = 7 days float
  })

  it('should handle task with duration 0', () => {
    const tasks: CPMTask[] = [
      { id: 'a', title: 'Milestone', duration: 0, predecessors: [] },
      { id: 'b', title: 'Task', duration: 5, predecessors: ['a'] },
    ]
    const result = calculateCriticalPath(tasks)
    expect(result.get('b')!.earlyStart).toBe(0)
  })
})

// ── tasksToCPM ────────────────────────────────────────────────

describe('tasksToCPM', () => {
  it('should convert empty array to empty array', () => {
    expect(tasksToCPM([])).toHaveLength(0)
  })

  it('should compute duration from start and end dates', () => {
    const tasks = [{
      id: 'a',
      title: 'Foundation',
      start_date: '2026-01-01',
      end_date: '2026-01-11',
      predecessor_ids: null,
      estimated_hours: null,
    }]
    const result = tasksToCPM(tasks)
    expect(result[0].duration).toBe(10)
  })

  it('should compute duration from estimated hours when no dates', () => {
    const tasks = [{
      id: 'a',
      title: 'Design Review',
      start_date: null,
      end_date: null,
      predecessor_ids: null,
      estimated_hours: 16, // 2 days
    }]
    const result = tasksToCPM(tasks)
    expect(result[0].duration).toBe(2)
  })

  it('should default duration to 1 when no dates or hours', () => {
    const tasks = [{
      id: 'a',
      title: 'Unknown',
      start_date: null,
      end_date: null,
      predecessor_ids: null,
      estimated_hours: null,
    }]
    const result = tasksToCPM(tasks)
    expect(result[0].duration).toBe(1)
  })

  it('should map predecessor_ids to predecessors', () => {
    const tasks = [{
      id: 'b',
      title: 'Second',
      start_date: null,
      end_date: null,
      predecessor_ids: ['a', 'x'],
      estimated_hours: null,
    }]
    const result = tasksToCPM(tasks)
    expect(result[0].predecessors).toEqual(['a', 'x'])
  })

  it('should use empty array when predecessor_ids is null', () => {
    const tasks = [{
      id: 'a',
      title: 'First',
      start_date: null,
      end_date: null,
      predecessor_ids: null,
      estimated_hours: null,
    }]
    const result = tasksToCPM(tasks)
    expect(result[0].predecessors).toEqual([])
  })

  it('should clamp minimum duration to 1', () => {
    const tasks = [{
      id: 'a',
      title: 'Short',
      start_date: '2026-01-01',
      end_date: '2026-01-01', // same day
      predecessor_ids: null,
      estimated_hours: null,
    }]
    const result = tasksToCPM(tasks)
    expect(result[0].duration).toBeGreaterThanOrEqual(1)
  })
})

// ── computeScheduleKPIs ───────────────────────────────────────

describe('computeScheduleKPIs', () => {
  const today = new Date()
  const past30 = new Date(today.getTime() - 30 * 86400000).toISOString().split('T')[0]
  const past60 = new Date(today.getTime() - 60 * 86400000).toISOString().split('T')[0]
  const future30 = new Date(today.getTime() + 30 * 86400000).toISOString().split('T')[0]
  const future60 = new Date(today.getTime() + 60 * 86400000).toISOString().split('T')[0]

  function makePhase(overrides: Partial<SchedulePhase> = {}): SchedulePhase {
    return {
      id: 'p-1',
      name: 'Foundation',
      startDate: past30,
      endDate: future30,
      progress: 50,
      critical: false,
      slippageDays: 0,
      floatDays: 10,
      baselineEndDate: future30,
      status: 'in_progress',
      color: '#F47820',
      tasks: [],
      ...overrides,
    }
  }

  it('should return defaults for empty phases', () => {
    const result = computeScheduleKPIs([])
    expect(result.scheduleVarianceDays).toBe(0)
    expect(result.spi).toBe(1)
    expect(result.criticalPathLength).toBe(0)
    expect(result.activitiesOnTimePct).toBe(100)
  })

  it('should compute criticalPathLength', () => {
    const phases = [
      makePhase({ critical: true }),
      makePhase({ id: 'p-2', critical: true }),
      makePhase({ id: 'p-3', critical: false }),
    ]
    const result = computeScheduleKPIs(phases)
    expect(result.criticalPathLength).toBe(2)
  })

  it('should compute activitiesOnTimePct', () => {
    const phases = [
      makePhase({ slippageDays: 0 }),
      makePhase({ id: 'p-2', slippageDays: 0 }),
      makePhase({ id: 'p-3', slippageDays: 5 }),
      makePhase({ id: 'p-4', slippageDays: 3 }),
    ]
    const result = computeScheduleKPIs(phases)
    expect(result.activitiesOnTimePct).toBe(50)
  })

  it('should compute scheduleVarianceDays for critical phase', () => {
    // baseline 30 days from now, current end is 30 days from now (no variance)
    const phase = makePhase({
      critical: true,
      endDate: future30,
      baselineEndDate: future30,
    })
    const result = computeScheduleKPIs([phase])
    expect(result.scheduleVarianceDays).toBe(0)
  })

  it('should compute positive scheduleVarianceDays when ahead of baseline', () => {
    // baseline further out, current end sooner = ahead of schedule (positive)
    const phase = makePhase({
      critical: true,
      endDate: future30,
      baselineEndDate: future60,
    })
    const result = computeScheduleKPIs([phase])
    expect(result.scheduleVarianceDays).toBeGreaterThan(0)
  })

  it('should compute negative scheduleVarianceDays when behind baseline', () => {
    // current end further out than baseline = behind schedule (negative)
    const phase = makePhase({
      critical: true,
      endDate: future60,
      baselineEndDate: future30,
    })
    const result = computeScheduleKPIs([phase])
    expect(result.scheduleVarianceDays).toBeLessThan(0)
  })

  it('should compute floatConsumedPct for phases with float', () => {
    const phases = [
      makePhase({ floatDays: 10, slippageDays: 5 }),  // 50% consumed
    ]
    const result = computeScheduleKPIs(phases)
    expect(result.floatConsumedPct).toBe(50)
  })

  it('should clamp floatConsumedPct to 100 when fully consumed', () => {
    const phases = [
      makePhase({ floatDays: 5, slippageDays: 10 }), // over-consumed
    ]
    const result = computeScheduleKPIs(phases)
    expect(result.floatConsumedPct).toBe(100)
  })

  it('should return projectedCompletionDate as string', () => {
    const phase = makePhase({ endDate: future30 })
    const result = computeScheduleKPIs([phase])
    expect(result.projectedCompletionDate).toMatch(/^\d{4}-\d{2}-\d{2}/)
  })

  it('should set projectedCompletionDate to latestEnd when SPI is 0', () => {
    // All phases in the past (SPI near 0 edge case)
    const phase = makePhase({
      startDate: past60,
      endDate: past30,
      progress: 0,
    })
    const result = computeScheduleKPIs([phase])
    // Should not throw; projectedCompletionDate should be a valid date string
    expect(result.projectedCompletionDate).toBeTruthy()
  })
})
