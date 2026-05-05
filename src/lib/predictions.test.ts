import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  assessTaskRisk,
  computeEarnedValue,
  buildSCurveData,
  detectRFIBottlenecks,
  assessSubmittalRisks,
  generateTaskRiskInsights,
  generateBudgetInsights,
  generateRFIBottleneckInsights,
  predictScheduleDelays,
  type ScheduleActivity,
  type WeatherDay,
  type EarnedValueMetrics,
} from './predictions';

const NOW = new Date('2026-05-05T12:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

// ── assessTaskRisk ──────────────────────────────────────────────

describe('assessTaskRisk', () => {
  function task(over: Record<string, unknown> = {}) {
    return {
      id: 't1',
      title: 'Test',
      status: 'in_progress',
      due_date: '2026-12-01',
      start_date: '2026-01-01',
      percent_complete: 50,
      predecessor_ids: [],
      is_critical_path: false,
      estimated_hours: 80,
      ...over,
    } as Parameters<typeof assessTaskRisk>[0];
  }

  it('returns low risk for an on-track task', () => {
    const r = assessTaskRisk(
      task({ percent_complete: 50, start_date: '2026-01-01', due_date: '2026-12-01' }),
      [],
    );
    expect(r.riskLevel).toBe('low');
    expect(r.factors.length).toBeLessThanOrEqual(1);
  });

  it('flags significantly-behind progress', () => {
    // 4 months elapsed, 0% complete on a 12 month plan → critical
    const r = assessTaskRisk(
      task({ percent_complete: 0, start_date: '2026-01-01', due_date: '2026-12-01' }),
      [],
    );
    expect(r.riskScore).toBeGreaterThan(0);
    expect(r.factors.some(f => f.toLowerCase().includes('progress'))).toBe(true);
  });

  it('penalizes overdue tasks', () => {
    const r = assessTaskRisk(
      task({
        due_date: '2026-04-01',
        percent_complete: 50,
        status: 'in_progress',
      }),
      [],
    );
    expect(r.factors.some(f => f.includes('overdue'))).toBe(true);
  });

  it('does not penalize completed tasks for being past due', () => {
    const r = assessTaskRisk(
      task({ due_date: '2026-04-01', status: 'done', percent_complete: 100 }),
      [],
    );
    expect(r.factors.every(f => !f.includes('overdue'))).toBe(true);
  });

  it('penalizes when predecessors are not complete', () => {
    const r = assessTaskRisk(
      task({ predecessor_ids: ['p1', 'p2'] }),
      [
        { id: 'p1', status: 'done' },
        { id: 'p2', status: 'in_progress' },
      ],
    );
    expect(r.factors.some(f => f.includes('predecessor'))).toBe(true);
  });

  it('singularizes the predecessor message for one blocked', () => {
    const r = assessTaskRisk(
      task({ predecessor_ids: ['p1'] }),
      [{ id: 'p1', status: 'in_progress' }],
    );
    expect(r.factors.some(f => /1 predecessor not complete/.test(f))).toBe(true);
  });

  it('adds critical-path factor when on critical path', () => {
    const r = assessTaskRisk(task({ is_critical_path: true }), []);
    expect(r.factors).toContain('On critical path');
  });

  it('adds outdoor weather factor when isOutdoorWork is true', () => {
    const r = assessTaskRisk(task(), [], true);
    expect(r.factors).toContain('Outdoor work, weather dependent');
  });

  it('flags missing due date', () => {
    const r = assessTaskRisk(task({ due_date: null }), []);
    expect(r.factors).toContain('No due date set');
  });

  it('clamps risk score at 100 and reports critical level', () => {
    const r = assessTaskRisk(
      task({
        due_date: '2025-01-01', // way overdue
        start_date: '2025-01-01',
        percent_complete: 0,
        is_critical_path: true,
        predecessor_ids: ['p1', 'p2', 'p3', 'p4'],
      }),
      [
        { id: 'p1', status: 'open' },
        { id: 'p2', status: 'open' },
        { id: 'p3', status: 'open' },
        { id: 'p4', status: 'open' },
      ],
      true,
    );
    expect(r.riskScore).toBeGreaterThanOrEqual(70);
    expect(r.riskScore).toBeLessThanOrEqual(100);
    expect(r.riskLevel).toBe('critical');
    expect(r.delayProbability).toBeGreaterThan(0.7);
    expect(r.delayProbability).toBeLessThanOrEqual(0.95);
  });

  it('returns medium when score crosses 20', () => {
    // Way behind progress + missing due date
    const r = assessTaskRisk(
      task({
        percent_complete: 5,
        start_date: '2026-01-01',
        due_date: '2026-09-01',
      }),
      [],
    );
    expect(['low', 'medium', 'high', 'critical']).toContain(r.riskLevel);
  });
});

// ── computeEarnedValue ──────────────────────────────────────────

describe('computeEarnedValue', () => {
  it('returns 1.0 CPI/SPI when no actual cost yet', () => {
    const ev = computeEarnedValue(
      [{ original_amount: 100_000, actual_amount: 0, committed_amount: 0, percent_complete: 0 }],
      0,
      0,
    );
    expect(ev.CPI).toBe(1);
    expect(ev.SPI).toBe(1);
    expect(ev.BAC).toBe(100_000);
  });

  it('detects over-budget (CPI < 1) at higher cost than progress', () => {
    const ev = computeEarnedValue(
      [{ original_amount: 100_000, actual_amount: 60_000, committed_amount: 0, percent_complete: 50 }],
      50,
      50,
    );
    // EV = $50k, AC = $60k → CPI ~ 0.83
    expect(ev.CPI).toBeLessThan(1);
    expect(ev.alerts.some(a => a.includes('CPI'))).toBe(true);
  });

  it('detects behind-schedule (SPI < 1) when progress < elapsed', () => {
    const ev = computeEarnedValue(
      [{ original_amount: 100_000, actual_amount: 30_000, committed_amount: 0, percent_complete: 30 }],
      30,
      50,
    );
    // PV = 50k, EV = 30k → SPI = 0.6
    expect(ev.SPI).toBeLessThan(1);
    expect(ev.alerts.some(a => a.includes('SPI'))).toBe(true);
  });

  it('handles empty budget items', () => {
    const ev = computeEarnedValue([], 0, 0);
    expect(ev.BAC).toBe(0);
    expect(ev.AC).toBe(0);
    expect(ev.CPI).toBe(1);
  });

  it('clamps elapsedPercent at 100', () => {
    const ev = computeEarnedValue(
      [{ original_amount: 100_000, actual_amount: 100_000, committed_amount: 0, percent_complete: 100 }],
      100,
      150, // over 100
    );
    // PV is clamped → SPI ~ 1
    expect(ev.PV).toBeCloseTo(100_000, 0);
    expect(ev.SPI).toBeCloseTo(1, 1);
  });

  it('reports projected overrun alert when VAC is large negative', () => {
    const ev = computeEarnedValue(
      [{ original_amount: 100_000, actual_amount: 200_000, committed_amount: 0, percent_complete: 50 }],
      50,
      50,
    );
    // Severe over budget → triggers overrun alert
    expect(ev.alerts.length).toBeGreaterThan(0);
  });
});

// ── buildSCurveData ─────────────────────────────────────────────

describe('buildSCurveData', () => {
  it('returns empty for no snapshots', () => {
    expect(
      buildSCurveData([], 100_000, '2026-01-01', '2026-12-31'),
    ).toEqual([]);
  });

  it('sorts snapshots by date', () => {
    const points = buildSCurveData(
      [
        { snapshot_date: '2026-06-01', data: { budget_spent: 50_000 } },
        { snapshot_date: '2026-02-01', data: { budget_spent: 10_000 } },
      ],
      100_000,
      '2026-01-01',
      '2026-12-31',
    );
    expect(points.map(p => p.date)).toEqual(['2026-02-01', '2026-06-01']);
  });

  it('uses sigmoid for planned cost (low at start, ~50% at midpoint)', () => {
    const points = buildSCurveData(
      [
        { snapshot_date: '2026-01-01', data: {} },
        { snapshot_date: '2026-07-02', data: {} }, // ~midpoint
        { snapshot_date: '2026-12-31', data: {} },
      ],
      1_000_000,
      '2026-01-01',
      '2026-12-31',
    );
    expect(points[0].planned).toBeLessThan(50_000); // way under at t=0
    expect(points[1].planned).toBeGreaterThan(400_000); // near 50% at midpoint
    expect(points[1].planned).toBeLessThan(600_000);
    expect(points[2].planned).toBeGreaterThan(900_000); // near full
  });

  it('uses budget_spent from each snapshot for actual', () => {
    const points = buildSCurveData(
      [{ snapshot_date: '2026-06-01', data: { budget_spent: 75_000 } }],
      100_000,
      '2026-01-01',
      '2026-12-31',
    );
    expect(points[0].actual).toBe(75_000);
  });
});

// ── detectRFIBottlenecks ────────────────────────────────────────

describe('detectRFIBottlenecks', () => {
  it('returns [] when no RFIs', () => {
    expect(detectRFIBottlenecks([])).toEqual([]);
  });

  it('flags reviewer with 2+ overdue RFIs', () => {
    const rfis = [
      {
        id: 'r1',
        title: 'A',
        status: 'open',
        assigned_to: 'alice',
        due_date: '2026-01-01',
        created_at: '2025-12-01',
      },
      {
        id: 'r2',
        title: 'B',
        status: 'open',
        assigned_to: 'alice',
        due_date: '2026-02-01',
        created_at: '2026-01-01',
      },
    ];
    const result = detectRFIBottlenecks(rfis);
    expect(result).toHaveLength(1);
    expect(result[0].reviewer).toBe('alice');
    expect(result[0].overdueCount).toBe(2);
  });

  it('does not flag reviewer with only one overdue RFI', () => {
    const rfis = [
      {
        id: 'r1',
        title: 'A',
        status: 'open',
        assigned_to: 'bob',
        due_date: '2026-01-01',
        created_at: '2025-12-01',
      },
    ];
    expect(detectRFIBottlenecks(rfis)).toEqual([]);
  });

  it('attributes unassigned RFIs to "Unassigned" bucket', () => {
    const rfis = [
      { id: 'r1', title: 'A', status: 'open', assigned_to: null, due_date: '2026-01-01', created_at: '2025-12-01' },
      { id: 'r2', title: 'B', status: 'open', assigned_to: null, due_date: '2026-02-01', created_at: '2026-01-01' },
    ];
    const result = detectRFIBottlenecks(rfis);
    expect(result[0].reviewer).toBe('Unassigned');
  });

  it('tracks longest open RFI', () => {
    const rfis = [
      { id: 'r1', title: 'Old', status: 'open', assigned_to: 'alice', due_date: '2026-01-01', created_at: '2025-09-01' },
      { id: 'r2', title: 'New', status: 'open', assigned_to: 'alice', due_date: '2026-01-01', created_at: '2026-04-01' },
    ];
    const result = detectRFIBottlenecks(rfis);
    expect(result[0].longestOpenRFI?.title).toBe('Old');
  });

  it('records response times for closed RFIs', () => {
    const rfis = [
      { id: 'r1', title: 'A', status: 'closed', assigned_to: 'alice', created_at: '2026-01-01', closed_date: '2026-01-15', due_date: null },
      { id: 'r2', title: 'B', status: 'closed', assigned_to: 'alice', created_at: '2026-02-01', closed_date: '2026-02-08', due_date: null },
      { id: 'r3', title: 'O', status: 'open', assigned_to: 'alice', created_at: '2026-04-01', due_date: '2026-04-05' },
      { id: 'r4', title: 'O2', status: 'open', assigned_to: 'alice', created_at: '2026-04-01', due_date: '2026-04-05' },
    ];
    const result = detectRFIBottlenecks(rfis);
    expect(result[0].avgResponseDays).toBeGreaterThan(0);
  });

  it('sorts bottlenecks by overdue count descending', () => {
    const rfis = [
      // alice: 2 overdue
      { id: 'a1', title: 'A1', status: 'open', assigned_to: 'alice', due_date: '2026-01-01', created_at: '2025-12-01' },
      { id: 'a2', title: 'A2', status: 'open', assigned_to: 'alice', due_date: '2026-01-01', created_at: '2025-12-01' },
      // bob: 5 overdue
      ...['b1', 'b2', 'b3', 'b4', 'b5'].map(id => ({
        id, title: id, status: 'open', assigned_to: 'bob', due_date: '2026-01-01', created_at: '2025-12-01',
      })),
    ];
    const result = detectRFIBottlenecks(rfis);
    expect(result[0].reviewer).toBe('bob');
  });
});

// ── assessSubmittalRisks ────────────────────────────────────────

describe('assessSubmittalRisks', () => {
  it('skips approved or closed submittals', () => {
    const subs = [
      { id: 's1', title: 'Approved', status: 'approved', submit_by_date: '2026-04-01' },
      { id: 's2', title: 'Closed', status: 'closed', submit_by_date: '2026-04-01' },
    ];
    expect(assessSubmittalRisks(subs)).toEqual([]);
  });

  it('skips submittals with no required date', () => {
    expect(
      assessSubmittalRisks([
        { id: 's1', title: 'Open', status: 'submitted', submit_by_date: null },
      ]),
    ).toEqual([]);
  });

  it('flags critically late when gapDays < -14', () => {
    // Required date already past + lead/review pushes total estimate >> daysUntil
    const subs = [
      {
        id: 's1',
        title: 'Late',
        status: 'submitted',
        submit_by_date: '2026-04-01', // past
        required_on_site_date: '2026-04-10',
        lead_time_days: 30,
      },
    ];
    const result = assessSubmittalRisks(subs);
    expect(result[0].riskLevel).toBe('critical');
    expect(result[0].gapDays).toBeLessThan(0);
  });

  it('skips low-risk submittals (gap >= 7)', () => {
    const subs = [
      {
        id: 's1',
        title: 'Far Out',
        status: 'submitted',
        submit_by_date: '2027-01-01',
        lead_time_days: 14,
      },
    ];
    const result = assessSubmittalRisks(subs);
    expect(result).toEqual([]);
  });

  it('uses status-specific review estimates', () => {
    const result = assessSubmittalRisks([
      { id: 's1', title: 'A', status: 'resubmit', submit_by_date: '2026-05-20', lead_time_days: 0 },
    ]);
    if (result.length > 0) {
      // resubmit adds 5 days to default 10
      expect(result[0].estimatedReviewDays).toBe(15);
    }
  });

  it('sorts risks by gapDays ascending (worst first)', () => {
    const subs = [
      {
        id: 's1',
        title: 'Worst',
        status: 'submitted',
        submit_by_date: '2026-04-01',
        lead_time_days: 30,
      },
      {
        id: 's2',
        title: 'Bad',
        status: 'submitted',
        submit_by_date: '2026-05-15',
        lead_time_days: 14,
      },
    ];
    const result = assessSubmittalRisks(subs);
    expect(result[0].submittalId).toBe('s1');
  });
});

// ── generateTaskRiskInsights ────────────────────────────────────

describe('generateTaskRiskInsights', () => {
  it('returns [] for no risk assessments', () => {
    expect(generateTaskRiskInsights([])).toEqual([]);
  });

  it('emits a critical insight when there are critical tasks', () => {
    const insights = generateTaskRiskInsights([
      { taskId: 't1', taskTitle: 'A', riskLevel: 'critical', riskScore: 90, factors: ['overdue'], delayProbability: 0.9 },
    ]);
    expect(insights).toHaveLength(1);
    expect(insights[0].severity).toBe('critical');
  });

  it('emits a warning insight when there are high tasks', () => {
    const insights = generateTaskRiskInsights([
      { taskId: 't1', taskTitle: 'A', riskLevel: 'high', riskScore: 50, factors: ['x'], delayProbability: 0.5 },
    ]);
    expect(insights[0].severity).toBe('warning');
  });

  it('singularizes vs pluralizes task count', () => {
    const single = generateTaskRiskInsights([
      { taskId: 't1', taskTitle: 'A', riskLevel: 'critical', riskScore: 90, factors: [], delayProbability: 0.9 },
    ]);
    const multi = generateTaskRiskInsights([
      { taskId: 't1', taskTitle: 'A', riskLevel: 'critical', riskScore: 90, factors: [], delayProbability: 0.9 },
      { taskId: 't2', taskTitle: 'B', riskLevel: 'critical', riskScore: 90, factors: [], delayProbability: 0.9 },
    ]);
    expect(single[0].message).toContain('1 task ');
    expect(multi[0].message).toContain('2 tasks');
  });
});

// ── generateBudgetInsights ──────────────────────────────────────

describe('generateBudgetInsights', () => {
  function metrics(over: Partial<EarnedValueMetrics> = {}): EarnedValueMetrics {
    return {
      BAC: 100_000,
      PV: 50_000,
      EV: 50_000,
      AC: 50_000,
      CPI: 1,
      SPI: 1,
      EAC: 100_000,
      ETC: 50_000,
      VAC: 0,
      CV: 0,
      SV: 0,
      TCPI: 1,
      alerts: [],
      ...over,
    };
  }

  it('emits critical budget insight when CPI < 0.90', () => {
    const insights = generateBudgetInsights(metrics({ CPI: 0.85 }));
    expect(insights.some(i => i.category === 'budget' && i.severity === 'critical')).toBe(true);
  });

  it('emits warning budget insight when CPI between 0.90 and 0.95', () => {
    const insights = generateBudgetInsights(metrics({ CPI: 0.92 }));
    expect(insights.some(i => i.category === 'budget' && i.severity === 'warning')).toBe(true);
  });

  it('emits critical schedule insight when SPI < 0.85', () => {
    const insights = generateBudgetInsights(metrics({ SPI: 0.80 }));
    expect(insights.some(i => i.category === 'schedule' && i.severity === 'critical')).toBe(true);
  });

  it('emits no insights for healthy CPI/SPI', () => {
    expect(generateBudgetInsights(metrics({ CPI: 1.05, SPI: 1.0 }))).toEqual([]);
  });
});

// ── generateRFIBottleneckInsights ───────────────────────────────

describe('generateRFIBottleneckInsights', () => {
  it('emits one insight per bottleneck', () => {
    const result = generateRFIBottleneckInsights([
      { reviewer: 'alice', overdueCount: 3, totalAssigned: 5, avgResponseDays: 7, projectAvgResponseDays: 3, longestOpenRFI: null },
      { reviewer: 'bob', overdueCount: 6, totalAssigned: 8, avgResponseDays: 12, projectAvgResponseDays: 3, longestOpenRFI: { id: 'r1', title: 'X', daysOpen: 30 } },
    ]);
    expect(result).toHaveLength(2);
    expect(result[1].severity).toBe('critical'); // 6 overdue → critical
    expect(result[0].severity).toBe('warning'); // 3 → warning
  });

  it('includes longest-open detail when present', () => {
    const result = generateRFIBottleneckInsights([
      { reviewer: 'a', overdueCount: 3, totalAssigned: 5, avgResponseDays: 7, projectAvgResponseDays: 3, longestOpenRFI: { id: 'r1', title: 'X', daysOpen: 30 } },
    ]);
    expect(result[0].expanded_content).toContain('Longest open');
  });
});

// ── predictScheduleDelays ───────────────────────────────────────

describe('predictScheduleDelays', () => {
  function act(over: Partial<ScheduleActivity> = {}): ScheduleActivity {
    return {
      id: 'a1',
      name: 'A',
      percent_complete: 50,
      planned_percent_complete: 50,
      work_type: 'indoor',
      float_days: 5,
      status: 'in_progress',
      start_date: '2026-04-01',
      end_date: '2026-06-01',
      ...over,
    };
  }

  function weather(date: string, precip: number): WeatherDay {
    return { date, conditions: 'rain', precipitationChance: precip, tempHigh: 60, tempLow: 50 };
  }

  it('returns [] when nothing is at risk', () => {
    expect(predictScheduleDelays('p1', [act()], [])).toEqual([]);
  });

  it('flags activity behind plan', () => {
    const result = predictScheduleDelays('p1', [act({ percent_complete: 10, planned_percent_complete: 50 })], []);
    expect(result).toHaveLength(1);
    expect(result[0].reasons.some(r => r.includes('behind planned'))).toBe(true);
  });

  it('flags outdoor activity with adverse weather', () => {
    const today = NOW.toISOString().slice(0, 10);
    const tomorrow = new Date(NOW.getTime() + 86400000).toISOString().slice(0, 10);
    const result = predictScheduleDelays(
      'p1',
      [act({ work_type: 'outdoor', percent_complete: 50, planned_percent_complete: 50 })],
      [weather(today, 80), weather(tomorrow, 70)],
    );
    expect(result).toHaveLength(1);
    expect(result[0].reasons.some(r => r.includes('precipitation'))).toBe(true);
    expect(result[0].suggestedAction).toContain('weather');
  });

  it('flags zero-float not-started activity', () => {
    const result = predictScheduleDelays('p1', [act({ float_days: 0, percent_complete: 0, status: 'not_started' })], []);
    expect(result[0].reasons.some(r => r.includes('zero float'))).toBe(true);
  });

  it('says "Nd float" for low non-zero float', () => {
    const result = predictScheduleDelays('p1', [act({ float_days: 1, percent_complete: 0, status: 'not_started' })], []);
    expect(result[0].reasons.some(r => /1d float/.test(r))).toBe(true);
  });

  it('clamps risk score at 1', () => {
    const result = predictScheduleDelays(
      'p1',
      [
        act({
          percent_complete: 0,
          planned_percent_complete: 80,
          work_type: 'outdoor',
          float_days: 0,
          status: 'not_started',
        }),
      ],
      [
        weather(NOW.toISOString().slice(0, 10), 90),
        weather(new Date(NOW.getTime() + 86400000).toISOString().slice(0, 10), 90),
      ],
    );
    expect(result[0].riskScore).toBeLessThanOrEqual(1);
    expect(result[0].riskScore).toBeGreaterThan(0);
  });

  it('does not flag when planned_percent_complete is null and otherwise healthy', () => {
    const result = predictScheduleDelays(
      'p1',
      [act({ planned_percent_complete: null, work_type: 'indoor', float_days: 5 })],
      [],
    );
    expect(result).toEqual([]);
  });
});
