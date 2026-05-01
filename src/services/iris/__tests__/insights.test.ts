import { describe, it, expect } from 'vitest';
import {
  detectCascades,
  detectAgingRfis,
  detectVarianceAcceleration,
  detectStaffing,
  detectWeatherCollision,
  dedupeInsights,
  sortInsights,
  runInsights,
  type InsightsInput,
  type IrisInsight,
} from '../insights';

// ── Test clock ─────────────────────────────────────────────────────────────

const NOW = new Date('2026-05-04T10:00:00.000Z');

function isoDaysFromNow(days: number): string {
  return new Date(NOW.getTime() + days * 86_400_000).toISOString().slice(0, 10);
}

function emptyInput(): InsightsInput {
  return {
    projectId: 'proj-1',
    now: NOW,
    submittals: [],
    schedule: [],
    rfis: [],
    budgetWeekly: [],
    workforce: [],
    weatherForecast: [],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cascade — submittal at risk for an upcoming activity
// ─────────────────────────────────────────────────────────────────────────────

describe('detectCascades', () => {
  it('emits an insight when a rejected submittal blocks a critical-path activity within 21 days', () => {
    const input: InsightsInput = {
      ...emptyInput(),
      submittals: [
        {
          id: 'sub-1',
          number: '008',
          title: 'Storefront glazing',
          status: 'rejected',
          linked_activity_id: 'act-1',
        },
      ],
      schedule: [
        {
          id: 'act-1',
          name: 'Dry-in',
          baseline_end: isoDaysFromNow(10),
          end_date: isoDaysFromNow(10),
          is_critical_path: true,
          float_days: 0,
        },
      ],
    };
    const out = detectCascades(input);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('cascade');
    expect(out[0].severity).toBe('critical');
    expect(out[0].id).toBe('cascade-proj-1-sub-1');
    expect(out[0].sourceTrail.map((s) => s.type)).toEqual(['submittal', 'schedule_activity']);
    expect(out[0].impactChain.length).toBeGreaterThan(2);
    expect(out[0].estimatedImpact?.scheduleDays).toBeGreaterThan(0);
  });

  it('returns empty when the submittal status is healthy', () => {
    const input: InsightsInput = {
      ...emptyInput(),
      submittals: [
        {
          id: 'sub-1',
          status: 'approved',
          linked_activity_id: 'act-1',
        },
      ],
      schedule: [
        {
          id: 'act-1',
          name: 'Dry-in',
          baseline_end: isoDaysFromNow(10),
          is_critical_path: true,
        },
      ],
    };
    expect(detectCascades(input)).toEqual([]);
  });

  it('returns empty when the activity baseline is beyond the look-ahead window', () => {
    const input: InsightsInput = {
      ...emptyInput(),
      submittals: [
        {
          id: 'sub-1',
          status: 'rejected',
          linked_activity_id: 'act-1',
        },
      ],
      schedule: [
        {
          id: 'act-1',
          name: 'Dry-in',
          baseline_end: isoDaysFromNow(60),
          is_critical_path: true,
        },
      ],
    };
    expect(detectCascades(input)).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Aging — overdue RFI on the critical path
// ─────────────────────────────────────────────────────────────────────────────

describe('detectAgingRfis', () => {
  it('emits a critical insight when the RFI carries a stored ≥10d schedule_impact', () => {
    const input: InsightsInput = {
      ...emptyInput(),
      rfis: [
        {
          id: 'rfi-7',
          number: '042',
          title: 'Conduit routing',
          due_date: isoDaysFromNow(-12),
          status: 'open',
          linked_activity_id: 'act-1',
          schedule_impact_days: 12,
        },
      ],
      schedule: [
        { id: 'act-1', name: 'Electrical rough-in', is_critical_path: true, float_days: 2 },
      ],
    };
    const out = detectAgingRfis(input);
    expect(out).toHaveLength(1);
    expect(out[0].severity).toBe('critical');
    expect(out[0].id).toBe('aging-proj-1-rfi-7');
    expect(out[0].estimatedImpact?.scheduleDays).toBe(12);
  });

  it('infers slip from float days when schedule_impact_days is missing', () => {
    const input: InsightsInput = {
      ...emptyInput(),
      rfis: [
        {
          id: 'rfi-7',
          due_date: isoDaysFromNow(-9),
          status: 'open',
          linked_activity_id: 'act-1',
        },
      ],
      schedule: [
        { id: 'act-1', name: 'Electrical rough-in', is_critical_path: true, float_days: 2 },
      ],
    };
    const out = detectAgingRfis(input);
    expect(out).toHaveLength(1);
    // 9 overdue - 2 float = 7-day slip → high severity
    expect(out[0].estimatedImpact?.scheduleDays).toBe(7);
    expect(out[0].severity).toBe('high');
  });

  it('skips RFIs that are not on the critical path', () => {
    const input: InsightsInput = {
      ...emptyInput(),
      rfis: [
        {
          id: 'rfi-9',
          due_date: isoDaysFromNow(-15),
          status: 'open',
          linked_activity_id: 'act-1',
        },
      ],
      schedule: [{ id: 'act-1', name: 'Punch list', is_critical_path: false }],
    };
    expect(detectAgingRfis(input)).toEqual([]);
  });

  it('skips RFIs that are answered or under 5 days late', () => {
    const input: InsightsInput = {
      ...emptyInput(),
      rfis: [
        { id: 'rfi-1', due_date: isoDaysFromNow(-2), status: 'open', linked_activity_id: 'act-1' },
        { id: 'rfi-2', due_date: isoDaysFromNow(-30), status: 'answered', linked_activity_id: 'act-1' },
      ],
      schedule: [{ id: 'act-1', name: 'Critical x', is_critical_path: true }],
    };
    expect(detectAgingRfis(input)).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Variance — committed delta accelerates beyond 2× the trailing avg
// ─────────────────────────────────────────────────────────────────────────────

describe('detectVarianceAcceleration', () => {
  it('flags an overrun trajectory when the latest week is ≥ 2× the trailing avg and committed > 60%', () => {
    const input: InsightsInput = {
      ...emptyInput(),
      budgetWeekly: [
        // approved $1,000,000 throughout. Trailing avg ≈ +1.5%/wk; latest +5%.
        { weekStart: '2026-04-06', committed: 600_000, approvedTotal: 1_000_000 },
        { weekStart: '2026-04-13', committed: 615_000, approvedTotal: 1_000_000 },
        { weekStart: '2026-04-20', committed: 630_000, approvedTotal: 1_000_000 },
        { weekStart: '2026-04-27', committed: 645_000, approvedTotal: 1_000_000 },
        { weekStart: '2026-05-04', committed: 695_000, approvedTotal: 1_000_000 },
      ],
    };
    const out = detectVarianceAcceleration(input);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('variance');
    expect(out[0].severity).toBe('medium'); // 69.5% committed
    expect(out[0].id).toBe('variance-proj-1-2026-05-04');
    expect(out[0].estimatedImpact?.dollars).toBeGreaterThan(0);
  });

  it('returns empty when committed is below the 60% threshold', () => {
    const input: InsightsInput = {
      ...emptyInput(),
      budgetWeekly: [
        { weekStart: '2026-04-06', committed: 100_000, approvedTotal: 1_000_000 },
        { weekStart: '2026-04-13', committed: 110_000, approvedTotal: 1_000_000 },
        { weekStart: '2026-04-20', committed: 120_000, approvedTotal: 1_000_000 },
        { weekStart: '2026-04-27', committed: 130_000, approvedTotal: 1_000_000 },
        { weekStart: '2026-05-04', committed: 200_000, approvedTotal: 1_000_000 },
      ],
    };
    expect(detectVarianceAcceleration(input)).toEqual([]);
  });

  it('returns empty when there are fewer than 5 weeks of history', () => {
    const input: InsightsInput = {
      ...emptyInput(),
      budgetWeekly: [
        { weekStart: '2026-04-27', committed: 600_000, approvedTotal: 1_000_000 },
        { weekStart: '2026-05-04', committed: 700_000, approvedTotal: 1_000_000 },
      ],
    };
    expect(detectVarianceAcceleration(input)).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Staffing — on-site crew vs scheduled hours
// ─────────────────────────────────────────────────────────────────────────────

describe('detectStaffing', () => {
  it('emits when available hours fall below 50% of scheduled hours for a trade', () => {
    const input: InsightsInput = {
      ...emptyInput(),
      schedule: [
        {
          id: 'act-1',
          name: 'Foundation pour',
          start_date: isoDaysFromNow(-1),
          end_date: isoDaysFromNow(2),
          trade: 'Concrete',
          required_hours_today: 80,
        },
      ],
      workforce: [{ trade: 'Concrete', hoursAvailable: 24 }],
    };
    const out = detectStaffing(input);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('staffing');
    expect(out[0].severity).toBe('high'); // 24/80 = 30%
    expect(out[0].id).toContain('staffing-proj-1-');
    expect(out[0].id).toContain('Concrete');
  });

  it('emits critical when no one is on site for a scheduled trade', () => {
    const input: InsightsInput = {
      ...emptyInput(),
      schedule: [
        {
          id: 'act-1',
          name: 'Roofing',
          start_date: isoDaysFromNow(-1),
          end_date: isoDaysFromNow(1),
          trade: 'Roofing',
          required_hours_today: 40,
        },
      ],
      workforce: [],
    };
    const out = detectStaffing(input);
    expect(out).toHaveLength(1);
    expect(out[0].severity).toBe('critical');
  });

  it('returns empty when crew counts meet the required hours', () => {
    const input: InsightsInput = {
      ...emptyInput(),
      schedule: [
        {
          id: 'act-1',
          name: 'Drywall',
          start_date: isoDaysFromNow(-1),
          end_date: isoDaysFromNow(2),
          trade: 'Drywall',
          required_hours_today: 40,
        },
      ],
      workforce: [{ trade: 'Drywall', hoursAvailable: 36 }],
    };
    expect(detectStaffing(input)).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Weather — outdoor activities + bad forecast
// ─────────────────────────────────────────────────────────────────────────────

describe('detectWeatherCollision', () => {
  it('emits when 2+ rainy days collide with outdoor scheduled work in the next 3 days', () => {
    const input: InsightsInput = {
      ...emptyInput(),
      schedule: [
        {
          id: 'act-1',
          name: 'Site grading',
          start_date: isoDaysFromNow(-2),
          end_date: isoDaysFromNow(4),
          outdoor_activity: true,
        },
      ],
      weatherForecast: [
        { date: isoDaysFromNow(0), conditions: 'Rain' },
        { date: isoDaysFromNow(1), conditions: 'Thunderstorm' },
        { date: isoDaysFromNow(2), conditions: 'Rain' },
      ],
    };
    const out = detectWeatherCollision(input);
    expect(out).toHaveLength(1);
    expect(out[0].kind).toBe('weather');
    expect(out[0].severity).toBe('high'); // 3 bad days
    expect(out[0].sourceTrail[0].title).toBe('Site grading');
  });

  it('returns empty on a clear forecast', () => {
    const input: InsightsInput = {
      ...emptyInput(),
      schedule: [
        {
          id: 'act-1',
          name: 'Site grading',
          start_date: isoDaysFromNow(0),
          end_date: isoDaysFromNow(3),
          outdoor_activity: true,
        },
      ],
      weatherForecast: [
        { date: isoDaysFromNow(0), conditions: 'Clear' },
        { date: isoDaysFromNow(1), conditions: 'Clouds' },
      ],
    };
    expect(detectWeatherCollision(input)).toEqual([]);
  });

  it('returns empty when the outdoor work isn’t in the horizon', () => {
    const input: InsightsInput = {
      ...emptyInput(),
      schedule: [
        {
          id: 'act-1',
          name: 'Painting (interior)',
          start_date: isoDaysFromNow(0),
          end_date: isoDaysFromNow(3),
          outdoor_activity: false,
        },
      ],
      weatherForecast: [{ date: isoDaysFromNow(0), conditions: 'Rain' }],
    };
    expect(detectWeatherCollision(input)).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Aggregator — dedupe + sort
// ─────────────────────────────────────────────────────────────────────────────

describe('dedupeInsights / sortInsights', () => {
  function fixture(overrides: Partial<IrisInsight> = {}): IrisInsight {
    return {
      id: 'fixture',
      kind: 'cascade',
      severity: 'medium',
      headline: 'x',
      impactChain: [],
      sourceTrail: [],
      detectedAt: NOW.toISOString(),
      ...overrides,
    };
  }

  it('dedupes by stable id', () => {
    const a = fixture({ id: 'cascade-proj-1-sub-1' });
    const b = fixture({ id: 'cascade-proj-1-sub-1', headline: 'duplicate' });
    const out = dedupeInsights([a, b]);
    expect(out).toHaveLength(1);
    expect(out[0].headline).toBe('x');
  });

  it('sorts critical above high above medium, then dollars desc, then days desc', () => {
    const items: IrisInsight[] = [
      fixture({ id: 'a', severity: 'medium', estimatedImpact: { dollars: 50_000 } }),
      fixture({ id: 'b', severity: 'critical', estimatedImpact: { scheduleDays: 1 } }),
      fixture({ id: 'c', severity: 'high', estimatedImpact: { dollars: 10_000 } }),
      fixture({ id: 'd', severity: 'high', estimatedImpact: { dollars: 30_000 } }),
      fixture({ id: 'e', severity: 'high', estimatedImpact: { dollars: 30_000, scheduleDays: 5 } }),
    ];
    const out = sortInsights(items);
    expect(out.map((i) => i.id)).toEqual(['b', 'e', 'd', 'c', 'a']);
  });

  it('sort is stable across calls (idempotent on identical input)', () => {
    const items: IrisInsight[] = [
      fixture({ id: 'a', severity: 'medium' }),
      fixture({ id: 'b', severity: 'high' }),
      fixture({ id: 'c', severity: 'critical' }),
    ];
    const a = sortInsights(items).map((i) => i.id);
    const b = sortInsights(items).map((i) => i.id);
    expect(a).toEqual(b);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// runInsights — full pipeline integration
// ─────────────────────────────────────────────────────────────────────────────

describe('runInsights', () => {
  it('combines all detectors and orders by severity then impact', () => {
    const input: InsightsInput = {
      ...emptyInput(),
      submittals: [
        { id: 'sub-1', status: 'rejected', linked_activity_id: 'act-1', title: 'Storefront' },
      ],
      schedule: [
        { id: 'act-1', name: 'Dry-in', baseline_end: isoDaysFromNow(8), is_critical_path: true, float_days: 0 },
        { id: 'act-2', name: 'Foundation', start_date: isoDaysFromNow(-1), end_date: isoDaysFromNow(2), trade: 'Concrete', required_hours_today: 80 },
      ],
      workforce: [{ trade: 'Concrete', hoursAvailable: 0 }],
      rfis: [
        { id: 'rfi-1', due_date: isoDaysFromNow(-15), status: 'open', linked_activity_id: 'act-1' },
      ],
      weatherForecast: [],
      budgetWeekly: [],
    };
    const out = runInsights(input);
    expect(out.length).toBeGreaterThanOrEqual(3);
    // First item must be the most severe
    expect(out[0].severity).toBe('critical');
    // No duplicates
    const ids = out.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
