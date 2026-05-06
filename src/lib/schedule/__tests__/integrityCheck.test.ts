/**
 * Schedule integrity check tests.
 *
 * Cover each issue type, the unanalyzed case (no link metadata), the
 * healthy case, and the score → status mapping.
 */

import { describe, it, expect } from 'vitest';
import { integrityCheck, type ActivityInput } from '../integrityCheck';

const A = (id: string, opts: Partial<ActivityInput> = {}): ActivityInput => ({
  id,
  name: `Act ${id}`,
  predecessorIds: [],
  successorIds: [],
  totalFloatDays: 0,
  ...opts,
});

describe('integrityCheck — unanalyzed cases', () => {
  it('returns unanalyzed when activities array is empty', () => {
    const out = integrityCheck([]);
    expect(out.status).toBe('unanalyzed');
    expect(out.issues).toEqual([]);
  });

  it('returns unanalyzed when no activity carries link metadata', () => {
    // Three activities, all with empty pred/succ — we never saw the logic.
    const out = integrityCheck([
      A('1', { predecessorIds: [], successorIds: [] }),
      A('2', { predecessorIds: [], successorIds: [] }),
    ]);
    expect(out.status).toBe('unanalyzed');
    expect(out.issues).toEqual([]);
  });
});

describe('integrityCheck — issue types', () => {
  it('detects open_start on the first non-start activity', () => {
    const out = integrityCheck([
      A('start', { isProjectStart: true, successorIds: ['1'] }),
      A('1', { predecessorIds: [], successorIds: ['2'] }), // no preds → open start
      A('2', { predecessorIds: ['1'], isProjectFinish: true }),
    ]);
    const open = out.issues.find(i => i.type === 'open_start');
    expect(open).toBeDefined();
    expect(open!.activityId).toBe('1');
  });

  it('detects open_finish on a non-finish leaf activity', () => {
    const out = integrityCheck([
      A('start', { isProjectStart: true, successorIds: ['1'] }),
      A('1', { predecessorIds: ['start'], successorIds: [] }), // no succs → open finish
    ]);
    const ofin = out.issues.find(i => i.type === 'open_finish');
    expect(ofin).toBeDefined();
    expect(ofin!.activityId).toBe('1');
  });

  it('detects negative_float as critical', () => {
    const out = integrityCheck([
      A('start', { isProjectStart: true, successorIds: ['1'] }),
      A('1', { predecessorIds: ['start'], successorIds: ['2'], totalFloatDays: -3 }),
      A('2', { predecessorIds: ['1'], isProjectFinish: true }),
    ]);
    const neg = out.issues.find(i => i.type === 'negative_float');
    expect(neg).toBeDefined();
    expect(neg!.severity).toBe('critical');
  });

  it('detects constraint_conflict when must_finish_on < early_finish', () => {
    const out = integrityCheck([
      A('start', { isProjectStart: true, successorIds: ['1'] }),
      A('1', {
        predecessorIds: ['start'],
        successorIds: ['2'],
        constraintType: 'must_finish_on',
        constraintDate: '2026-04-15',
        earlyFinishDate: '2026-05-01', // 16 days late
      }),
      A('2', { predecessorIds: ['1'], isProjectFinish: true }),
    ]);
    const c = out.issues.find(i => i.type === 'constraint_conflict');
    expect(c).toBeDefined();
  });

  it('detects orphan activities', () => {
    const out = integrityCheck([
      A('start', { isProjectStart: true, successorIds: ['1'] }),
      A('1', { predecessorIds: ['start'], successorIds: ['2'] }),
      A('orphan', { predecessorIds: [], successorIds: [] }), // unhooked
      A('2', { predecessorIds: ['1'], isProjectFinish: true }),
    ]);
    const o = out.issues.find(i => i.type === 'orphan');
    expect(o).toBeDefined();
    expect(o!.activityId).toBe('orphan');
  });

  it('does not double-flag orphan as both open_start and open_finish', () => {
    const out = integrityCheck([
      A('start', { isProjectStart: true, successorIds: ['x'] }),
      A('orphan', { predecessorIds: [], successorIds: [] }),
      A('x', { predecessorIds: ['start'], isProjectFinish: true }),
    ]);
    const orphanIssues = out.issues.filter(i => i.activityId === 'orphan');
    expect(orphanIssues.length).toBe(1);
    expect(orphanIssues[0].type).toBe('orphan');
  });
});

describe('integrityCheck — status thresholds', () => {
  it('returns healthy on a clean schedule (score ≥ 90)', () => {
    const out = integrityCheck([
      A('start', { isProjectStart: true, successorIds: ['1'] }),
      A('1', { predecessorIds: ['start'], successorIds: ['2'], totalFloatDays: 5 }),
      A('2', { predecessorIds: ['1'], successorIds: ['finish'], totalFloatDays: 5 }),
      A('finish', { predecessorIds: ['2'], isProjectFinish: true }),
    ]);
    expect(out.status).toBe('healthy');
    expect(out.score).toBeGreaterThanOrEqual(90);
  });

  it('drops to watch or broken when issues accumulate', () => {
    const out = integrityCheck([
      A('start', { isProjectStart: true, successorIds: ['1'] }),
      A('1', { predecessorIds: [], successorIds: [] }), // orphan
      A('2', { predecessorIds: ['start'], successorIds: ['finish'], totalFloatDays: -5 }),
      A('finish', { predecessorIds: ['2'], isProjectFinish: true }),
    ]);
    expect(['watch', 'broken']).toContain(out.status);
    expect(out.score).toBeLessThan(90);
  });
});

describe('integrityCheck — idempotency', () => {
  it('produces equal output on repeated invocations', () => {
    const acts: ActivityInput[] = [
      A('start', { isProjectStart: true, successorIds: ['1'] }),
      A('1', { predecessorIds: ['start'], successorIds: ['2'], totalFloatDays: 0 }),
      A('2', { predecessorIds: ['1'], isProjectFinish: true }),
    ];
    const a = integrityCheck(acts);
    const b = integrityCheck(acts);
    expect(a).toEqual(b);
  });
});

describe('integrityCheck — countsByType rollup', () => {
  it('counts each issue type accurately', () => {
    const out = integrityCheck([
      A('start', { isProjectStart: true, successorIds: ['1', '2'] }),
      A('1', { predecessorIds: ['start'], successorIds: [] }), // open_finish
      A('2', { predecessorIds: ['start'], successorIds: [], totalFloatDays: -1 }), // open_finish + negative_float
    ]);
    expect(out.countsByType.open_finish).toBe(2);
    expect(out.countsByType.negative_float).toBe(1);
  });
});
