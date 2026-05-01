/**
 * Schedule-vs-PayApp reconciliation tests.
 *
 * Verify the variance classifier, join-on-cost-code logic, blocked dollars
 * rollup, idempotency, and orphan-handling on either side.
 */

import { describe, it, expect } from 'vitest';
import {
  reconcileScheduleVsPayApp,
  type PayAppLineInput,
  type ScheduleActivityInput,
} from '../scheduleVsPayApp';

const PAY = (
  id: string,
  costCode: string,
  pct: number,
  scheduledValue = 100_000,
): PayAppLineInput => ({
  id,
  costCode,
  description: `Line ${id}`,
  scheduledValue,
  pctComplete: pct,
});

const ACT = (
  id: string,
  costCode: string,
  pct: number,
): ScheduleActivityInput => ({
  id,
  costCode,
  name: `Activity ${id}`,
  pctComplete: pct,
});

describe('reconcileScheduleVsPayApp', () => {
  it('flags ok when pay-app and schedule agree exactly', () => {
    const out = reconcileScheduleVsPayApp(
      [PAY('1', '03-30', 50)],
      [ACT('a1', '03-30', 50)],
    );
    expect(out.lines[0].severity).toBe('ok');
    expect(out.lines[0].variancePct).toBe(0);
    expect(out.isBlocked).toBe(false);
  });

  it('flags minor when variance is between 5pp and 10pp', () => {
    const out = reconcileScheduleVsPayApp(
      [PAY('1', '03-30', 57)],
      [ACT('a1', '03-30', 50)],
    );
    expect(out.lines[0].severity).toBe('minor');
    expect(out.lines[0].blocked).toBe(false);
    expect(out.isBlocked).toBe(false);
  });

  it('flags material and blocks when variance ≥ 10pp', () => {
    const out = reconcileScheduleVsPayApp(
      [PAY('1', '03-30', 65)],
      [ACT('a1', '03-30', 50)],
    );
    expect(out.lines[0].severity).toBe('material');
    expect(out.lines[0].blocked).toBe(true);
    expect(out.isBlocked).toBe(true);
  });

  it('flags critical and blocks when variance ≥ 20pp', () => {
    const out = reconcileScheduleVsPayApp(
      [PAY('1', '03-30', 80)],
      [ACT('a1', '03-30', 50)],
    );
    expect(out.lines[0].severity).toBe('critical');
    expect(out.lines[0].blocked).toBe(true);
  });

  it('joins on cost code case-insensitively / trimmed', () => {
    const out = reconcileScheduleVsPayApp(
      [PAY('1', '  03-30 ', 50)],
      [ACT('a1', '03-30', 50)],
    );
    expect(out.lines[0].variancePct).toBe(0);
  });

  it('averages multiple activities sharing a cost code', () => {
    // Two activities at 40% and 60% → average 50%. Pay app is 50% → ok.
    const out = reconcileScheduleVsPayApp(
      [PAY('1', '05-10', 50)],
      [ACT('a1', '05-10', 40), ACT('a2', '05-10', 60)],
    );
    expect(out.lines[0].severity).toBe('ok');
  });

  it('rolls up blocked dollars at risk', () => {
    const out = reconcileScheduleVsPayApp(
      [
        PAY('1', '03-30', 80, 100_000), // over by 30pp → critical, blocked
        PAY('2', '03-31', 50, 50_000),  // ok
      ],
      [ACT('a1', '03-30', 50), ACT('a2', '03-31', 50)],
    );
    expect(out.blockedDollarsAtRisk).toBe(100_000);
    expect(out.isBlocked).toBe(true);
  });

  it('flags pay-app line with no matching schedule activity as material+blocked when started', () => {
    const out = reconcileScheduleVsPayApp(
      [PAY('1', '99-99', 50)],
      [ACT('a1', '03-30', 50)],
    );
    const orphan = out.lines.find(l => l.costCode === '99-99')!;
    expect(orphan.severity).toBe('material');
    expect(orphan.blocked).toBe(true);
  });

  it('passes a 0%-billed unmatched pay-app line as ok', () => {
    const out = reconcileScheduleVsPayApp(
      [PAY('1', '99-99', 0)],
      [ACT('a1', '03-30', 50)],
    );
    expect(out.lines[0].severity).toBe('ok');
    expect(out.lines[0].blocked).toBe(false);
  });

  it('emits a row for schedule activities with no SOV match', () => {
    const out = reconcileScheduleVsPayApp(
      [PAY('1', '03-30', 50)],
      [ACT('a1', '03-30', 50), ACT('a2', '99-99', 75)],
    );
    const orphan = out.lines.find(l => l.costCode === '99-99')!;
    expect(orphan.payAppPct).toBeNull();
    expect(orphan.severity).toBe('minor');
    expect(orphan.blocked).toBe(false);
  });

  it('idempotency — same input twice yields equal output', () => {
    const pay = [PAY('1', '03-30', 50), PAY('2', '04-10', 75)];
    const acts = [ACT('a1', '03-30', 48), ACT('a2', '04-10', 80)];
    const a = reconcileScheduleVsPayApp(pay, acts);
    const b = reconcileScheduleVsPayApp(pay, acts);
    expect(a).toEqual(b);
  });

  it('honors custom thresholds', () => {
    const out = reconcileScheduleVsPayApp(
      [PAY('1', '03-30', 53)],
      [ACT('a1', '03-30', 50)],
      { minorTolerancePct: 1, materialTolerancePct: 2, criticalTolerancePct: 5 },
    );
    expect(out.lines[0].severity).toBe('material');
    expect(out.lines[0].blocked).toBe(true);
  });

  it('handles empty inputs without throwing', () => {
    const out = reconcileScheduleVsPayApp([], []);
    expect(out.lines).toEqual([]);
    expect(out.isBlocked).toBe(false);
  });

  it('clamps pct values out of range', () => {
    const out = reconcileScheduleVsPayApp(
      [PAY('1', '03-30', 150)],
      [ACT('a1', '03-30', -10)],
    );
    expect(out.lines[0].payAppPct).toBe(100);
    expect(out.lines[0].schedulePct).toBe(0);
  });
});
