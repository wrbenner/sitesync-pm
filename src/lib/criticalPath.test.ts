import { describe, it, expect } from 'vitest';
import {
  computeScheduleKPIs,
  calculateCriticalPath,
  computeCriticalPathExt,
  tasksToCPM,
  type CPMTask,
  type CPMTaskExt,
} from './criticalPath';
import type { SchedulePhase } from '../stores/scheduleStore';

// SchedulePhase has many fields; we cast partial fixtures.
function phase(over: Partial<SchedulePhase>): SchedulePhase {
  return {
    id: 'p1',
    name: 'Phase 1',
    project_id: 'proj',
    start_date: '2026-01-01',
    end_date: '2026-06-30',
    percent_complete: 0,
    status: 'upcoming',
    is_critical_path: false,
    float_days: 0,
    startDate: '2026-01-01',
    endDate: '2026-06-30',
    progress: 0,
    critical: false,
    completed: false,
    baselineStartDate: null,
    baselineEndDate: null,
    slippageDays: 0,
    floatDays: 0,
    ...over,
  } as unknown as SchedulePhase;
}

// ── computeScheduleKPIs ─────────────────────────────────────────

describe('computeScheduleKPIs', () => {
  it('returns defaults for empty input', () => {
    const result = computeScheduleKPIs([]);
    expect(result.scheduleVarianceDays).toBe(0);
    expect(result.spi).toBe(1);
    expect(result.criticalPathLength).toBe(0);
    expect(result.floatConsumedPct).toBe(0);
    expect(result.activitiesOnTimePct).toBe(100);
    expect(result.projectedCompletionDate).toBe('');
  });

  it('computes critical path length from phases marked critical', () => {
    const result = computeScheduleKPIs([
      phase({ critical: true, baselineEndDate: '2026-06-30', endDate: '2026-06-30' }),
      phase({ id: 'p2', critical: true, baselineEndDate: '2026-07-15', endDate: '2026-07-30' }),
      phase({ id: 'p3', critical: false }),
    ]);
    expect(result.criticalPathLength).toBe(2);
  });

  it('reports negative variance when latest critical phase slipped', () => {
    const result = computeScheduleKPIs([
      phase({
        critical: true,
        baselineEndDate: '2026-06-30',
        endDate: '2026-07-15',
        startDate: '2026-01-01',
      }),
    ]);
    // baseline before current end → negative variance
    expect(result.scheduleVarianceDays).toBeLessThan(0);
  });

  it('reports zero variance when no critical phase has baseline', () => {
    const result = computeScheduleKPIs([
      phase({ critical: true, baselineEndDate: null, endDate: '2026-06-30' }),
    ]);
    expect(result.scheduleVarianceDays).toBe(0);
  });

  it('computes float consumed only for phases with float', () => {
    const result = computeScheduleKPIs([
      phase({ floatDays: 10, slippageDays: 5 }),
      phase({ id: 'p2', floatDays: 0, slippageDays: 0 }),
      phase({ id: 'p3', floatDays: 20, slippageDays: 0 }),
    ]);
    // (5/10 + 0/20) / 2 = 25%
    expect(result.floatConsumedPct).toBe(25);
  });

  it('reports 100% on-time when nothing has slipped', () => {
    const result = computeScheduleKPIs([
      phase({ slippageDays: -5 }),
      phase({ id: 'p2', slippageDays: 0 }),
    ]);
    expect(result.activitiesOnTimePct).toBe(100);
  });

  it('reports 0% on-time when everything has slipped', () => {
    const result = computeScheduleKPIs([
      phase({ slippageDays: 5 }),
      phase({ id: 'p2', slippageDays: 10 }),
    ]);
    expect(result.activitiesOnTimePct).toBe(0);
  });

  it('emits projectedCompletionDate as YYYY-MM-DD', () => {
    const result = computeScheduleKPIs([
      phase({ progress: 50, startDate: '2026-01-01', endDate: '2026-12-31' }),
    ]);
    expect(result.projectedCompletionDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ── calculateCriticalPath (simple FS-only) ──────────────────────

describe('calculateCriticalPath', () => {
  it('handles a single task with no predecessors', () => {
    const tasks: CPMTask[] = [{ id: 'a', title: 'A', duration: 5, predecessors: [] }];
    const result = calculateCriticalPath(tasks);
    const r = result.get('a')!;
    expect(r.earlyStart).toBe(0);
    expect(r.earlyFinish).toBe(5);
    expect(r.totalFloat).toBe(0);
    expect(r.isCritical).toBe(true);
  });

  it('schedules sequential tasks in order', () => {
    const tasks: CPMTask[] = [
      { id: 'a', title: 'A', duration: 3, predecessors: [] },
      { id: 'b', title: 'B', duration: 4, predecessors: ['a'] },
      { id: 'c', title: 'C', duration: 2, predecessors: ['b'] },
    ];
    const result = calculateCriticalPath(tasks);
    expect(result.get('a')!.earlyFinish).toBe(3);
    expect(result.get('b')!.earlyStart).toBe(3);
    expect(result.get('b')!.earlyFinish).toBe(7);
    expect(result.get('c')!.earlyStart).toBe(7);
    expect(result.get('c')!.earlyFinish).toBe(9);
    // All on the only path → all critical
    for (const r of result.values()) expect(r.isCritical).toBe(true);
  });

  it('identifies parallel paths and assigns correct float to non-critical branch', () => {
    // a → {b (long), c (short)} → d
    const tasks: CPMTask[] = [
      { id: 'a', title: 'A', duration: 1, predecessors: [] },
      { id: 'b', title: 'B', duration: 5, predecessors: ['a'] },
      { id: 'c', title: 'C', duration: 2, predecessors: ['a'] },
      { id: 'd', title: 'D', duration: 1, predecessors: ['b', 'c'] },
    ];
    const result = calculateCriticalPath(tasks);
    expect(result.get('b')!.isCritical).toBe(true);
    expect(result.get('c')!.isCritical).toBe(false);
    // C has 3 days of float (5 - 2)
    expect(result.get('c')!.totalFloat).toBe(3);
  });

  it('ignores predecessors that do not exist', () => {
    const tasks: CPMTask[] = [
      { id: 'a', title: 'A', duration: 2, predecessors: ['ghost'] },
    ];
    const result = calculateCriticalPath(tasks);
    expect(result.get('a')!.earlyStart).toBe(0);
  });
});

// ── computeCriticalPathExt (FS/FF/SS/SF + lag) ──────────────────

describe('computeCriticalPathExt', () => {
  it('schedules a single FS chain with lag', () => {
    const tasks: CPMTaskExt[] = [
      { id: 'a', durationDays: 5, predecessorIds: [] },
      { id: 'b', durationDays: 3, predecessorIds: ['a'], dependencyType: 'FS', lagDays: 2 },
    ];
    const result = computeCriticalPathExt(tasks);
    expect(result.get('a')!.earlyFinish).toBe(5);
    // FS + 2 days lag → b earlyStart = 7
    expect(result.get('b')!.earlyStart).toBe(7);
    expect(result.get('b')!.earlyFinish).toBe(10);
  });

  it('handles SS dependency (start-to-start)', () => {
    const tasks: CPMTaskExt[] = [
      { id: 'a', durationDays: 10, predecessorIds: [] },
      { id: 'b', durationDays: 3, predecessorIds: ['a'], dependencyType: 'SS', lagDays: 0 },
    ];
    const result = computeCriticalPathExt(tasks);
    expect(result.get('b')!.earlyStart).toBe(0);
  });

  it('handles FF dependency (finish-to-finish)', () => {
    const tasks: CPMTaskExt[] = [
      { id: 'a', durationDays: 10, predecessorIds: [] },
      { id: 'b', durationDays: 3, predecessorIds: ['a'], dependencyType: 'FF', lagDays: 0 },
    ];
    const result = computeCriticalPathExt(tasks);
    // earlyFinish_b = earlyFinish_a → earlyStart_b = 10 - 3 = 7
    expect(result.get('b')!.earlyStart).toBe(7);
    expect(result.get('b')!.earlyFinish).toBe(10);
  });

  it('handles SF dependency (start-to-finish)', () => {
    const tasks: CPMTaskExt[] = [
      { id: 'a', durationDays: 10, predecessorIds: [] },
      { id: 'b', durationDays: 5, predecessorIds: ['a'], dependencyType: 'SF', lagDays: 0 },
    ];
    const result = computeCriticalPathExt(tasks);
    // earlyFinish_b = earlyStart_a (0) → earlyStart_b = -5, clamped to ≥ 0
    expect(result.get('b')!.earlyStart).toBeGreaterThanOrEqual(0);
  });

  it('derives duration from start/end dates when durationDays is missing', () => {
    const tasks: CPMTaskExt[] = [
      { id: 'a', startDate: '2026-01-01', endDate: '2026-01-08' }, // 7 days
    ];
    const result = computeCriticalPathExt(tasks);
    expect(result.get('a')!.durationDays).toBe(7);
  });

  it('defaults duration to 1 when neither dates nor duration are set', () => {
    const tasks: CPMTaskExt[] = [{ id: 'a' }];
    expect(computeCriticalPathExt(tasks).get('a')!.durationDays).toBe(1);
  });

  it('marks the longest path as critical with zero float', () => {
    const tasks: CPMTaskExt[] = [
      { id: 'a', durationDays: 1, predecessorIds: [] },
      { id: 'b', durationDays: 5, predecessorIds: ['a'] },
      { id: 'c', durationDays: 2, predecessorIds: ['a'] },
      { id: 'd', durationDays: 1, predecessorIds: ['b', 'c'] },
    ];
    const result = computeCriticalPathExt(tasks);
    expect(result.get('b')!.isCritical).toBe(true);
    expect(result.get('b')!.floatDays).toBe(0);
    expect(result.get('c')!.isCritical).toBe(false);
    expect(result.get('c')!.floatDays).toBeGreaterThan(0);
  });

  it('handles cyclic / unsorted tasks gracefully', () => {
    // a depends on b, b depends on a — cycle
    const tasks: CPMTaskExt[] = [
      { id: 'a', durationDays: 2, predecessorIds: ['b'] },
      { id: 'b', durationDays: 3, predecessorIds: ['a'] },
    ];
    const result = computeCriticalPathExt(tasks);
    // Should not crash; both should be present
    expect(result.size).toBe(2);
  });

  it('treats default dependency as FS when undefined', () => {
    const tasks: CPMTaskExt[] = [
      { id: 'a', durationDays: 4, predecessorIds: [] },
      { id: 'b', durationDays: 2, predecessorIds: ['a'] }, // no dep type → FS
    ];
    expect(computeCriticalPathExt(tasks).get('b')!.earlyStart).toBe(4);
  });
});

// ── tasksToCPM ──────────────────────────────────────────────────

describe('tasksToCPM', () => {
  it('uses date-derived duration when start/end given', () => {
    const result = tasksToCPM([
      {
        id: 't1',
        title: 'T1',
        start_date: '2026-01-01',
        end_date: '2026-01-08',
        predecessor_ids: [],
        estimated_hours: null,
      },
    ]);
    expect(result[0].duration).toBe(7);
  });

  it('uses estimated_hours/8 when no dates', () => {
    const result = tasksToCPM([
      {
        id: 't1',
        title: 'T1',
        start_date: null,
        end_date: null,
        predecessor_ids: [],
        estimated_hours: 24,
      },
    ]);
    expect(result[0].duration).toBe(3); // 24/8
  });

  it('defaults to 1 day when nothing is set', () => {
    const result = tasksToCPM([
      {
        id: 't1',
        title: 'T1',
        start_date: null,
        end_date: null,
        predecessor_ids: null,
        estimated_hours: null,
      },
    ]);
    expect(result[0].duration).toBe(1);
    expect(result[0].predecessors).toEqual([]);
  });

  it('passes predecessor_ids through unchanged', () => {
    const result = tasksToCPM([
      {
        id: 't2',
        title: 'T2',
        start_date: null,
        end_date: null,
        predecessor_ids: ['t1'],
        estimated_hours: 8,
      },
    ]);
    expect(result[0].predecessors).toEqual(['t1']);
  });
});
