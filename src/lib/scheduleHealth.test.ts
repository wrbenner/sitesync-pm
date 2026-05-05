import { describe, it, expect } from 'vitest';
import { analyzeScheduleHealth } from './scheduleHealth';
import type { MappedSchedulePhase } from '../types/entities';

function phase(over: Partial<MappedSchedulePhase>): MappedSchedulePhase {
  return {
    id: 'p1',
    name: 'Phase',
    project_id: 'proj',
    startDate: '2026-01-01',
    endDate: '2026-01-15',
    progress: 0,
    critical: false,
    is_critical: false,
    is_critical_path: false,
    isMilestone: false,
    floatDays: 5,
    predecessorIds: [],
    predecessor_ids: null,
    status: 'upcoming',
    completed: false,
    ...over,
  } as unknown as MappedSchedulePhase;
}

// ── Empty schedule ─────────────────────────────────────────────

describe('analyzeScheduleHealth', () => {
  it('returns score 100 / grade A for an empty schedule', () => {
    const r = analyzeScheduleHealth([]);
    expect(r.score).toBe(100);
    expect(r.grade).toBe('A');
    expect(r.findings).toEqual([]);
    expect(r.summary).toMatch(/No activities/);
    expect(r.metrics.totalActivities).toBe(0);
  });

  it('grades a healthy connected schedule highly', () => {
    const phases = [
      phase({ id: 'p1', name: 'A', startDate: '2026-01-01', endDate: '2026-01-10' }),
      phase({ id: 'p2', name: 'B', startDate: '2026-01-11', endDate: '2026-01-20', predecessorIds: ['p1'] }),
      phase({ id: 'p3', name: 'C', startDate: '2026-01-21', endDate: '2026-01-30', predecessorIds: ['p2'] }),
    ];
    const r = analyzeScheduleHealth(phases);
    expect(r.score).toBeGreaterThan(60);
    expect(['A', 'B', 'C']).toContain(r.grade);
  });

  it('flags missing predecessors when activity has no predecessor and is not earliest', () => {
    const phases = [
      phase({ id: 'p1', startDate: '2026-01-01', endDate: '2026-01-10' }),
      phase({ id: 'p2', startDate: '2026-02-01', endDate: '2026-02-10', predecessorIds: [] }),
    ];
    const r = analyzeScheduleHealth(phases);
    const finding = r.findings.find(f => f.category === 'open-end' && f.title.includes('predecessors'));
    expect(finding).toBeDefined();
  });

  it('marks open-ends critical when more than 3 affected', () => {
    const phases = [
      phase({ id: 'p1', startDate: '2026-01-01', endDate: '2026-01-10' }),
      phase({ id: 'p2', startDate: '2026-02-01', endDate: '2026-02-10' }),
      phase({ id: 'p3', startDate: '2026-03-01', endDate: '2026-03-10' }),
      phase({ id: 'p4', startDate: '2026-04-01', endDate: '2026-04-10' }),
      phase({ id: 'p5', startDate: '2026-05-01', endDate: '2026-05-10' }),
    ];
    const r = analyzeScheduleHealth(phases);
    const dangling = r.findings.find(f => f.category === 'dangling');
    expect(dangling?.severity).toBe('critical');
  });

  it('flags negative float as critical', () => {
    const phases = [
      phase({ id: 'p1', startDate: '2026-01-01', endDate: '2026-01-10' }),
      phase({ id: 'p2', startDate: '2026-01-11', endDate: '2026-01-20', floatDays: -3, predecessorIds: ['p1'] }),
    ];
    const r = analyzeScheduleHealth(phases);
    const f = r.findings.find(x => x.category === 'negative-float');
    expect(f?.severity).toBe('critical');
    expect(f?.affectedTaskIds).toEqual(['p2']);
  });

  it('flags out-of-sequence progress', () => {
    const phases = [
      phase({ id: 'p1', progress: 50, status: 'in_progress' }),
      // p2 has progress > 0 but predecessor p1 is not complete
      phase({
        id: 'p2',
        progress: 25,
        status: 'in_progress',
        predecessorIds: ['p1'],
        startDate: '2026-02-01',
        endDate: '2026-02-15',
      }),
    ];
    const r = analyzeScheduleHealth(phases);
    expect(r.findings.some(f => f.category === 'out-of-sequence')).toBe(true);
  });

  it('flags dangling activities (no preds, no succs)', () => {
    const phases = [
      phase({ id: 'p1', startDate: '2026-01-01', endDate: '2026-01-10' }),
      phase({ id: 'p2', startDate: '2026-02-01', endDate: '2026-02-10' }),
      phase({ id: 'p3', startDate: '2026-03-01', endDate: '2026-03-10' }),
    ];
    const r = analyzeScheduleHealth(phases);
    const dangling = r.findings.find(f => f.category === 'dangling');
    expect(dangling).toBeDefined();
    expect(dangling!.affectedTaskIds.length).toBeGreaterThan(0);
  });

  it('flags activity with > 60 day duration', () => {
    const phases = [
      phase({ id: 'p1', startDate: '2026-01-01', endDate: '2026-01-10' }),
      phase({ id: 'p2', startDate: '2026-01-11', endDate: '2026-01-20', predecessorIds: ['p1'] }),
      phase({ id: 'p3', startDate: '2026-01-21', endDate: '2026-01-30', predecessorIds: ['p2'] }),
      phase({ id: 'p4', startDate: '2026-02-01', endDate: '2026-12-31', predecessorIds: ['p3'] }), // > 60 days
    ];
    const r = analyzeScheduleHealth(phases);
    expect(r.findings.some(f => f.category === 'duration-anomaly')).toBe(true);
  });

  it('flags low logic density when phases > 5 and < 1.0 links/activity', () => {
    // 6 phases, only one link → density = 1/6 < 0.5 → critical
    const phases = [
      phase({ id: 'p1', startDate: '2026-01-01', endDate: '2026-01-10' }),
      phase({ id: 'p2', startDate: '2026-02-01', endDate: '2026-02-10' }),
      phase({ id: 'p3', startDate: '2026-03-01', endDate: '2026-03-10' }),
      phase({ id: 'p4', startDate: '2026-04-01', endDate: '2026-04-10' }),
      phase({ id: 'p5', startDate: '2026-05-01', endDate: '2026-05-10' }),
      phase({ id: 'p6', startDate: '2026-06-01', endDate: '2026-06-10', predecessorIds: ['p5'] }),
    ];
    const r = analyzeScheduleHealth(phases);
    const f = r.findings.find(x => x.category === 'logic-density');
    expect(f?.severity).toBe('critical');
  });

  it('flags critical-path concentration', () => {
    // 6 phases, 5 are critical → 83% > 70% → critical
    const phases = [
      phase({ id: 'p1', critical: true, startDate: '2026-01-01', endDate: '2026-01-10' }),
      phase({ id: 'p2', critical: true, startDate: '2026-01-11', endDate: '2026-01-20', predecessorIds: ['p1'] }),
      phase({ id: 'p3', critical: true, startDate: '2026-01-21', endDate: '2026-01-30', predecessorIds: ['p2'] }),
      phase({ id: 'p4', critical: true, startDate: '2026-02-01', endDate: '2026-02-10', predecessorIds: ['p3'] }),
      phase({ id: 'p5', critical: true, startDate: '2026-02-11', endDate: '2026-02-20', predecessorIds: ['p4'] }),
      phase({ id: 'p6', critical: false, startDate: '2026-02-21', endDate: '2026-03-01', predecessorIds: ['p5'] }),
    ];
    const r = analyzeScheduleHealth(phases);
    const f = r.findings.find(x => x.category === 'critical-concentration');
    expect(f).toBeDefined();
    expect(f?.severity).toBe('critical');
  });

  it('flags near-critical activities (1-3 days float, not on critical path)', () => {
    const phases = [
      phase({ id: 'p1', startDate: '2026-01-01', endDate: '2026-01-10' }),
      phase({
        id: 'p2',
        startDate: '2026-01-11',
        endDate: '2026-01-20',
        predecessorIds: ['p1'],
        floatDays: 2,
        critical: false,
      }),
    ];
    const r = analyzeScheduleHealth(phases);
    const nc = r.findings.find(x => x.category === 'near-critical');
    expect(nc).toBeDefined();
    expect(nc?.severity).toBe('info');
  });

  it('sorts findings critical → warning → info', () => {
    const phases = [
      // Trigger critical (negative float)
      phase({ id: 'p1', floatDays: -2, startDate: '2026-01-01', endDate: '2026-01-10' }),
      // Trigger info (near-critical)
      phase({
        id: 'p2',
        floatDays: 2,
        startDate: '2026-01-11',
        endDate: '2026-01-20',
        predecessorIds: ['p1'],
      }),
    ];
    const r = analyzeScheduleHealth(phases);
    const sevs = r.findings.map(f => f.severity);
    let lastWeight = -1;
    const order = { critical: 0, warning: 1, info: 2 } as const;
    for (const s of sevs) {
      expect(order[s]).toBeGreaterThanOrEqual(lastWeight);
      lastWeight = order[s];
    }
  });

  it('counts findings by severity correctly', () => {
    const phases = [
      phase({ id: 'p1', floatDays: -3 }),
      phase({ id: 'p2', floatDays: 2, predecessorIds: ['p1'] }),
    ];
    const r = analyzeScheduleHealth(phases);
    expect(
      r.criticalCount + r.warningCount + r.infoCount,
    ).toBe(r.findings.length);
  });

  it('emits sensible metrics struct', () => {
    const phases = [
      phase({ id: 'p1' }),
      phase({ id: 'p2', predecessorIds: ['p1'] }),
    ];
    const r = analyzeScheduleHealth(phases);
    expect(r.metrics.totalActivities).toBe(2);
    expect(r.metrics.activitiesWithPredecessors).toBe(1);
    expect(r.metrics.activitiesWithSuccessors).toBe(1);
    expect(typeof r.metrics.avgFloatDays).toBe('number');
  });

  it('falls back to predecessor_ids field when predecessorIds is null/undefined', () => {
    // Cast to allow setting predecessorIds = undefined to exercise the ?? fallback
    const phases = [
      phase({ id: 'p1', startDate: '2026-01-01', endDate: '2026-01-10' }),
      {
        ...phase({
          id: 'p2',
          predecessor_ids: ['p1'],
          startDate: '2026-01-11',
          endDate: '2026-01-20',
        }),
        predecessorIds: undefined,
      } as unknown as MappedSchedulePhase,
    ];
    const r = analyzeScheduleHealth(phases);
    expect(r.metrics.activitiesWithPredecessors).toBe(1);
  });

  it('drops predecessors that reference non-existent IDs', () => {
    const phases = [
      phase({ id: 'p1', predecessorIds: ['ghost'], startDate: '2026-01-01', endDate: '2026-01-10' }),
    ];
    const r = analyzeScheduleHealth(phases);
    // Ghost predecessor is filtered out → activity treated as no preds
    expect(r.metrics.activitiesWithPredecessors).toBe(0);
  });

  it('produces a grade reflecting score thresholds', () => {
    expect(analyzeScheduleHealth([]).grade).toBe('A');
    // Build a really bad schedule
    const phases = Array.from({ length: 10 }, (_, i) =>
      phase({
        id: `p${i + 1}`,
        floatDays: -5,
        startDate: `2026-01-${String(i + 1).padStart(2, '0')}`,
        endDate: `2026-01-${String(i + 5).padStart(2, '0')}`,
      }),
    );
    const r = analyzeScheduleHealth(phases);
    expect(['D', 'F']).toContain(r.grade);
  });

  it('emits an analyzedAt ISO timestamp', () => {
    const r = analyzeScheduleHealth([phase({})]);
    expect(r.analyzedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
