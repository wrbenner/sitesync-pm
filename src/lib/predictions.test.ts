import { describe, it, expect } from 'vitest'
import {
  assessTaskRisk,
  computeEarnedValue,
  buildSCurveData,
  detectRFIBottlenecks,
  assessSubmittalRisks,
  generateTaskRiskInsights,
  generateBudgetInsights,
} from './predictions'

// ── assessTaskRisk ────────────────────────────────────────

describe('predictions — assessTaskRisk', () => {
  function task(overrides: Partial<Parameters<typeof assessTaskRisk>[0]> = {}): Parameters<typeof assessTaskRisk>[0] {
    return {
      id: 't1',
      title: 'Task',
      status: 'in_progress',
      due_date: null,
      start_date: null,
      percent_complete: 50,
      predecessor_ids: null,
      is_critical_path: false,
      estimated_hours: 40,
      ...overrides,
    }
  }

  it('low risk for a healthy on-track task with no flags', () => {
    const r = assessTaskRisk(task({ due_date: null }), [])
    // Only "no due date" flag fires → +5 → low.
    expect(r.riskLevel).toBe('low')
    expect(r.factors).toContain('No due date set')
  })

  it('flags overdue tasks proportionally to days overdue', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    const r = assessTaskRisk(task({ due_date: tenDaysAgo, status: 'in_progress' }), [])
    // 10 days overdue → +50 score, capped at +40.
    expect(r.factors.some((f) => /10 days overdue/.test(f))).toBe(true)
    expect(r.riskScore).toBeGreaterThanOrEqual(40)
  })

  it('does not flag overdue when status is "done"', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
    const r = assessTaskRisk(task({ due_date: tenDaysAgo, status: 'done' }), [])
    expect(r.factors.every((f) => !/overdue/.test(f))).toBe(true)
  })

  it('predecessors not done add 10 each to risk score', () => {
    const r = assessTaskRisk(
      task({ predecessor_ids: ['p1', 'p2'] }),
      [{ id: 'p1', status: 'in_progress' }, { id: 'p2', status: 'in_progress' }],
    )
    expect(r.factors.some((f) => /2 predecessors not complete/.test(f))).toBe(true)
  })

  it('completed predecessors do not contribute risk', () => {
    const r = assessTaskRisk(
      task({ predecessor_ids: ['p1'] }),
      [{ id: 'p1', status: 'done' }],
    )
    expect(r.factors.every((f) => !/predecessor/.test(f))).toBe(true)
  })

  it('critical path adds 10 + outdoor adds 5 to risk score', () => {
    const r = assessTaskRisk(task({ is_critical_path: true }), [], true)
    expect(r.factors).toContain('On critical path')
    expect(r.factors).toContain('Outdoor work, weather dependent')
  })

  it('riskLevel buckets follow the documented thresholds (high)', () => {
    // 20 days overdue caps at +40, critical path +10, outdoor +5 → score 55 → high
    const longAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
    const r = assessTaskRisk(
      task({ due_date: longAgo, is_critical_path: true }),
      [],
      true,
    )
    expect(r.riskLevel).toBe('high')
  })

  it('riskLevel reaches critical (≥70) with predecessors blocked + behind-pace + overdue', () => {
    // Set up a worst-case: 50% elapsed but 5% complete (+30), overdue 20 days
    // (+40 capped), 3 predecessors not done (+30), critical path (+10), outdoor
    // (+5) → score caps at 100.
    const start = new Date(Date.now() - 50 * 86400000).toISOString()
    const due = new Date(Date.now() - 1 * 86400000).toISOString()
    const r = assessTaskRisk(
      task({
        start_date: start,
        due_date: due,
        percent_complete: 5,
        is_critical_path: true,
        predecessor_ids: ['p1', 'p2', 'p3'],
      }),
      [
        { id: 'p1', status: 'in_progress' },
        { id: 'p2', status: 'in_progress' },
        { id: 'p3', status: 'in_progress' },
      ],
      true,
    )
    expect(r.riskLevel).toBe('critical')
  })

  it('progress significantly behind elapsed time triggers a +30 penalty', () => {
    // Project 50% elapsed but 10% complete → 30 points.
    const start = new Date(Date.now() - 50 * 24 * 60 * 60 * 1000).toISOString()
    const end = new Date(Date.now() + 50 * 24 * 60 * 60 * 1000).toISOString()
    const r = assessTaskRisk(task({ start_date: start, due_date: end, percent_complete: 10 }), [])
    expect(r.factors.some((f) => /significantly behind elapsed time/.test(f))).toBe(true)
  })
})

// ── computeEarnedValue ────────────────────────────────────

describe('predictions — computeEarnedValue', () => {
  it('CPI = 1 and SPI = 1 when on track and on budget', () => {
    const r = computeEarnedValue(
      [{ original_amount: 1000, actual_amount: 500, committed_amount: 1000, percent_complete: 50 }],
      50,
      50,
    )
    expect(r.CPI).toBe(1)
    expect(r.SPI).toBe(1)
    expect(r.alerts).toEqual([])
  })

  it('CPI < 0.95 fires a budget warning', () => {
    // 50% complete (EV = 500), 800 spent → CPI = 500/800 = 0.625
    const r = computeEarnedValue(
      [{ original_amount: 1000, actual_amount: 800, committed_amount: 1000, percent_complete: 50 }],
      50,
      50,
    )
    expect(r.CPI).toBeLessThan(0.95)
    expect(r.alerts.some((a) => /CPI/.test(a))).toBe(true)
  })

  it('SPI < 0.90 fires a schedule warning', () => {
    // EV = 30% of BAC, PV = 60% of BAC → SPI = 0.5
    const r = computeEarnedValue(
      [{ original_amount: 1000, actual_amount: 500, committed_amount: 1000, percent_complete: 30 }],
      30,
      60,
    )
    expect(r.SPI).toBeLessThan(0.9)
    expect(r.alerts.some((a) => /SPI/.test(a))).toBe(true)
  })

  it('TCPI flags unrealistic recovery requirement', () => {
    // BAC=1000, AC=900, EV=200 → remaining work = 800, remaining budget = 100
    // TCPI = 800/100 = 8 → unrealistic
    const r = computeEarnedValue(
      [{ original_amount: 1000, actual_amount: 900, committed_amount: 1000, percent_complete: 20 }],
      20,
      50,
    )
    expect(r.TCPI).toBeGreaterThan(1.15)
    expect(r.alerts.some((a) => /TCPI/.test(a))).toBe(true)
  })

  it('returns dollar values (not cents) for all monetary fields', () => {
    const r = computeEarnedValue(
      [{ original_amount: 100, actual_amount: 100, committed_amount: 100, percent_complete: 100 }],
      100,
      100,
    )
    expect(r.BAC).toBe(100)
    expect(r.AC).toBe(100)
    expect(r.EV).toBe(100)
  })
})

// ── buildSCurveData ───────────────────────────────────────

describe('predictions — buildSCurveData', () => {
  it('returns empty array when no snapshots', () => {
    expect(buildSCurveData([], 1_000_000, '2026-01-01', '2026-12-31')).toEqual([])
  })

  it('sorts snapshots by date and the planned curve is monotonically increasing', () => {
    const r = buildSCurveData(
      [
        { snapshot_date: '2026-12-01', data: { budget_spent: 900_000 } },
        { snapshot_date: '2026-01-01', data: { budget_spent: 50_000 } },
        { snapshot_date: '2026-06-01', data: { budget_spent: 400_000 } },
      ],
      1_000_000,
      '2026-01-01',
      '2026-12-31',
    )
    // Output order matches sorted dates
    expect(r.map((p) => p.date)).toEqual(['2026-01-01', '2026-06-01', '2026-12-01'])
    // Sigmoid is monotonically increasing → each later point has more planned spend.
    expect(r[1].planned).toBeGreaterThan(r[0].planned)
    expect(r[2].planned).toBeGreaterThan(r[1].planned)
    // Final point is near the budget total (sigmoid asymptotes).
    expect(r[2].planned).toBeGreaterThan(900_000)
  })

  it('uses raw budget_spent as the actual value', () => {
    const r = buildSCurveData(
      [{ snapshot_date: '2026-06-01', data: { budget_spent: 250_000 } }],
      1_000_000,
      '2026-01-01',
      '2026-12-31',
    )
    expect(r[0].actual).toBe(250_000)
  })
})

// ── detectRFIBottlenecks ──────────────────────────────────

describe('predictions — detectRFIBottlenecks', () => {
  function rfi(overrides: Partial<Parameters<typeof detectRFIBottlenecks>[0][number]> = {}) {
    return {
      id: 'r1',
      title: 'RFI',
      status: 'open',
      assigned_to: 'alice',
      due_date: null,
      created_at: new Date(Date.now() - 10 * 86400000).toISOString(),
      closed_date: null,
      ...overrides,
    }
  }

  it('flags reviewers with 2+ overdue RFIs', () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const bottlenecks = detectRFIBottlenecks([
      rfi({ assigned_to: 'alice', due_date: past, status: 'open' }),
      rfi({ assigned_to: 'alice', due_date: past, status: 'open' }),
    ])
    expect(bottlenecks).toHaveLength(1)
    expect(bottlenecks[0].reviewer).toBe('alice')
    expect(bottlenecks[0].overdueCount).toBe(2)
  })

  it('does not flag reviewers with only 1 overdue RFI', () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const r = detectRFIBottlenecks([
      rfi({ assigned_to: 'bob', due_date: past, status: 'open' }),
    ])
    expect(r).toEqual([])
  })

  it('returns empty array when no RFIs', () => {
    expect(detectRFIBottlenecks([])).toEqual([])
  })

  it('captures the longest-open RFI per reviewer', () => {
    const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const old = new Date(Date.now() - 30 * 86400000).toISOString()
    const newer = new Date(Date.now() - 5 * 86400000).toISOString()
    const r = detectRFIBottlenecks([
      rfi({ id: 'old', title: 'Old one', assigned_to: 'alice', created_at: old, due_date: past, status: 'open' }),
      rfi({ id: 'new', title: 'Newer one', assigned_to: 'alice', created_at: newer, due_date: past, status: 'open' }),
    ])
    expect(r[0].longestOpenRFI?.id).toBe('old')
    expect(r[0].longestOpenRFI?.daysOpen).toBeGreaterThanOrEqual(29)
  })
})

// ── assessSubmittalRisks ──────────────────────────────────

describe('predictions — assessSubmittalRisks', () => {
  it('skips approved and closed submittals', () => {
    const past = new Date(Date.now() - 30 * 86400000).toISOString()
    const r = assessSubmittalRisks([
      { id: '1', title: 'A', status: 'approved', submit_by_date: past, required_on_site_date: past },
      { id: '2', title: 'B', status: 'closed', submit_by_date: past, required_on_site_date: past },
    ])
    expect(r).toEqual([])
  })

  it('returns "low" risks as filtered out (only flagged risks returned)', () => {
    // 90 days from now is plenty of time → should be "low" → not returned.
    const future = new Date(Date.now() + 90 * 86400000).toISOString()
    const r = assessSubmittalRisks([
      { id: 's', title: 'A', status: 'submitted', submit_by_date: null, required_on_site_date: future, lead_time_days: 14 },
    ])
    expect(r).toEqual([])
  })

  it('flags critical when the gap is more than 14 days late', () => {
    // required onsite TODAY but lead+review = 24 days → gap = -24 → critical
    const today = new Date().toISOString()
    const r = assessSubmittalRisks([
      { id: 's', title: 'Late', status: 'submitted', submit_by_date: null, required_on_site_date: today, lead_time_days: 14 },
    ])
    expect(r).toHaveLength(1)
    expect(r[0].riskLevel).toBe('critical')
  })

  it('sorts results by gap days (most-late first)', () => {
    const onsite1 = new Date(Date.now() + 5 * 86400000).toISOString()  // 5 days
    const onsite2 = new Date(Date.now() - 5 * 86400000).toISOString()  // 5 days late
    const r = assessSubmittalRisks([
      { id: 'A', title: 'Mild', status: 'submitted', submit_by_date: null, required_on_site_date: onsite1, lead_time_days: 14 },
      { id: 'B', title: 'Late', status: 'submitted', submit_by_date: null, required_on_site_date: onsite2, lead_time_days: 14 },
    ])
    // Most-negative gap first
    expect(r[0].submittalId).toBe('B')
  })
})

// ── insight generators ────────────────────────────────────

describe('predictions — generateTaskRiskInsights', () => {
  it('returns empty when no high/critical tasks', () => {
    const r = generateTaskRiskInsights([
      { taskId: '1', taskTitle: 'A', riskLevel: 'low', riskScore: 5, factors: [], delayProbability: 0 },
    ])
    expect(r).toEqual([])
  })

  it('groups critical and high into two separate insights', () => {
    const r = generateTaskRiskInsights([
      { taskId: '1', taskTitle: 'Critical Task', riskLevel: 'critical', riskScore: 80, factors: ['behind'], delayProbability: 0.8 },
      { taskId: '2', taskTitle: 'High Task',     riskLevel: 'high',     riskScore: 50, factors: ['blocked'], delayProbability: 0.5 },
    ])
    expect(r).toHaveLength(2)
    expect(r[0].severity).toBe('critical')
    expect(r[1].severity).toBe('warning')
  })
})

describe('predictions — generateBudgetInsights', () => {
  function ev(overrides: Partial<Parameters<typeof generateBudgetInsights>[0]>): Parameters<typeof generateBudgetInsights>[0] {
    return {
      BAC: 1000, PV: 500, EV: 500, AC: 500, CPI: 1, SPI: 1, EAC: 1000, ETC: 500, VAC: 0, CV: 0, SV: 0, TCPI: 1, alerts: [],
      ...overrides,
    }
  }

  it('no insights when CPI/SPI healthy', () => {
    const r = generateBudgetInsights(ev({}))
    expect(r).toEqual([])
  })

  it('emits a critical insight when CPI < 0.90', () => {
    const r = generateBudgetInsights(ev({ CPI: 0.85, VAC: -150 }))
    expect(r.some((i) => i.severity === 'critical' && /significantly over budget/i.test(i.message))).toBe(true)
  })

  it('emits a warning when CPI between 0.90 and 0.95', () => {
    const r = generateBudgetInsights(ev({ CPI: 0.92 }))
    expect(r.some((i) => i.severity === 'warning' && /trending over budget/i.test(i.message))).toBe(true)
  })
})
