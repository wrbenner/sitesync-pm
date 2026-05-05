/**
 * Pure-function tests for the scheduled-insights worker's envelope
 * builders. These are the contract the promote_insight_to_draft RPC
 * validates at runtime; testing here gives us pre-deploy coverage
 * of the same shape.
 */
import { describe, it, expect } from 'vitest'
import {
  agingSeverity,
  buildAgingEnvelope,
  buildCascadeEnvelope,
  buildStaffingEnvelope,
  buildVarianceEnvelope,
  buildWeatherEnvelope,
  cascadeSeverity,
  inferCascadeSlip,
  inferSlipDays,
  staffingSeverity,
  varianceSeverity,
  weatherSeverity,
} from '../insightEnvelope'

describe('agingSeverity', () => {
  it('promotes ≥ 10 days slip to critical', () => {
    expect(agingSeverity(10)).toBe('critical')
    expect(agingSeverity(20)).toBe('critical')
  })
  it('promotes 5–9 days slip to high', () => {
    expect(agingSeverity(5)).toBe('high')
    expect(agingSeverity(9)).toBe('high')
  })
  it('keeps < 5 days slip at medium (below the promotion floor)', () => {
    expect(agingSeverity(4)).toBe('medium')
    expect(agingSeverity(0)).toBe('medium')
  })
})

describe('cascadeSeverity', () => {
  it('promotes critical-path activity to critical regardless of days', () => {
    expect(cascadeSeverity(true, 21)).toBe('critical')
    expect(cascadeSeverity(true, 0)).toBe('critical')
  })
  it('promotes off-critical with baseline ≤ 7 to high', () => {
    expect(cascadeSeverity(false, 7)).toBe('high')
    expect(cascadeSeverity(false, 0)).toBe('high')
  })
  it('keeps off-critical further-out at medium', () => {
    expect(cascadeSeverity(false, 8)).toBe('medium')
    expect(cascadeSeverity(false, 21)).toBe('medium')
  })
})

describe('inferSlipDays', () => {
  it('returns the explicit impact when provided and positive', () => {
    expect(inferSlipDays(10, 5, 12)).toBe(12)
  })
  it('falls back to overdue minus float when no explicit impact', () => {
    expect(inferSlipDays(10, 3)).toBe(7)
    expect(inferSlipDays(10, 0)).toBe(10)
  })
  it('floors at zero when float exceeds overdue', () => {
    expect(inferSlipDays(2, 7)).toBe(0)
  })
  it('treats explicit impact = 0 as "no value, use inference"', () => {
    expect(inferSlipDays(10, 3, 0)).toBe(7)
  })
})

describe('inferCascadeSlip', () => {
  it('uses base 10 days for rejected submittals', () => {
    expect(inferCascadeSlip('rejected', 0)).toBe(10)
  })
  it('uses base 5 days for at-risk / revise-resubmit', () => {
    expect(inferCascadeSlip('at_risk', 0)).toBe(5)
    expect(inferCascadeSlip('revise_resubmit', 0)).toBe(5)
  })
  it('reduces by available float (floored at zero)', () => {
    expect(inferCascadeSlip('rejected', 4)).toBe(6)
    expect(inferCascadeSlip('at_risk', 8)).toBe(0)
  })
})

describe('buildAgingEnvelope', () => {
  const baseInputs = {
    rfiId: 'rfi-1',
    rfiNumber: '42',
    rfiTitle: 'Footing detail clarification',
    overdueDays: 7,
    activityId: 'sched-1',
    activityName: 'Foundation pour',
    slipDays: 6,
  }

  it('produces the right envelope shape for a high-severity case', () => {
    const env = buildAgingEnvelope(baseInputs)
    expect(env.kind).toBe('aging')
    expect(env.actionType).toBe('rfi.draft')
    expect(env.severity).toBe('high')
    expect(env.confidence).toBe(0.85)
    expect(env.primaryEntityType).toBe('rfi')
    expect(env.primaryEntityId).toBe('rfi-1')
    expect(env.title).toContain('#42')
    expect(env.summary).toContain('7 days past due')
    expect(env.summary).toContain('Foundation pour')
    expect((env.payload as { insightKind: string }).insightKind).toBe('aging')
    expect((env.payload as { priority: string }).priority).toBe('high')
  })

  it('lifts priority to critical when slip ≥ 10', () => {
    const env = buildAgingEnvelope({ ...baseInputs, slipDays: 12 })
    expect(env.severity).toBe('critical')
    expect((env.payload as { priority: string }).priority).toBe('critical')
  })

  it('emits exactly two citations: rfi_reference + schedule_phase', () => {
    const env = buildAgingEnvelope(baseInputs)
    expect(env.citations).toHaveLength(2)
    expect(env.citations[0].kind).toBe('rfi_reference')
    expect(env.citations[0].ref).toBe('rfi-1')
    expect(env.citations[1].kind).toBe('schedule_phase')
    expect(env.citations[1].ref).toBe('sched-1')
  })
})

describe('buildCascadeEnvelope', () => {
  const baseInputs = {
    submittalId: 'sub-9',
    submittalNumber: '101',
    submittalTitle: 'Storefront glazing',
    submittalStatus: 'rejected',
    activityId: 'sched-9',
    activityName: 'Glazing install',
    isCriticalPath: true,
    daysToBaseline: 5,
    slipDays: 8,
  }

  it('produces a critical envelope for critical-path activities', () => {
    const env = buildCascadeEnvelope(baseInputs)
    expect(env.kind).toBe('cascade')
    expect(env.severity).toBe('critical')
    expect(env.primaryEntityType).toBe('submittal')
    expect(env.primaryEntityId).toBe('sub-9')
    expect(env.summary).toContain('was rejected')
    expect(env.summary).toContain('Glazing install')
    expect(env.summary).toContain('5 days')
    expect((env.payload as { insightKind: string }).insightKind).toBe('cascade')
  })

  it('uses "is at risk" verb for non-rejected statuses', () => {
    const env = buildCascadeEnvelope({ ...baseInputs, submittalStatus: 'revise_resubmit' })
    expect(env.summary).toContain('is at risk')
  })

  it('drops to high severity when not on critical path but baseline ≤ 7 days', () => {
    const env = buildCascadeEnvelope({
      ...baseInputs,
      isCriticalPath: false,
      daysToBaseline: 7,
    })
    expect(env.severity).toBe('high')
  })

  it('omits "(critical path)" suffix when off-critical', () => {
    const env = buildCascadeEnvelope({
      ...baseInputs,
      isCriticalPath: false,
      daysToBaseline: 7,
    })
    const desc = (env.payload as { description: string }).description
    expect(desc).not.toContain('(critical path)')
  })

  it('emits two citations: spec_reference + schedule_phase', () => {
    const env = buildCascadeEnvelope(baseInputs)
    expect(env.citations).toHaveLength(2)
    expect(env.citations[0].kind).toBe('spec_reference')
    expect(env.citations[1].kind).toBe('schedule_phase')
    expect(env.citations[1].label).toContain('Critical-path')
  })

  it('has confidence 0.8 (lower than aging because cascade timing is fuzzier)', () => {
    const env = buildCascadeEnvelope(baseInputs)
    expect(env.confidence).toBe(0.8)
  })
})

describe('varianceSeverity', () => {
  it('promotes ≥ 100% committed to critical', () => {
    expect(varianceSeverity(100)).toBe('critical')
    expect(varianceSeverity(150)).toBe('critical')
  })
  it('promotes 90–99% to high', () => {
    expect(varianceSeverity(90)).toBe('high')
    expect(varianceSeverity(99.9)).toBe('high')
  })
  it('keeps < 90% at medium (below floor)', () => {
    expect(varianceSeverity(89.9)).toBe('medium')
    expect(varianceSeverity(0)).toBe('medium')
  })
})

describe('buildVarianceEnvelope', () => {
  const baseInputs = {
    snapshotId: 'snap-1',
    snapshotDate: '2026-06-15',
    weekDeltaPct: 8.0,
    averageWeeklyPct: 2.0,
    percentCommitted: 95,
    exposureDollars: 0,
  }

  it('produces a high-severity envelope and labels the acceleration multiple', () => {
    const env = buildVarianceEnvelope(baseInputs)
    expect(env.kind).toBe('variance')
    expect(env.severity).toBe('high')
    expect(env.summary).toContain('4.0× acceleration')
    expect(env.summary).toContain('95% committed')
    expect((env.payload as { insightKind: string }).insightKind).toBe('variance')
    expect((env.payload as { exposureDollars: number }).exposureDollars).toBe(0)
  })

  it('lifts to critical when ≥ 100% committed', () => {
    const env = buildVarianceEnvelope({ ...baseInputs, percentCommitted: 105 })
    expect(env.severity).toBe('critical')
  })

  it('handles zero trailing average without dividing by zero', () => {
    const env = buildVarianceEnvelope({ ...baseInputs, averageWeeklyPct: 0 })
    expect(env.summary).toContain('n/a')
  })

  it('emits two budget_line citations', () => {
    const env = buildVarianceEnvelope(baseInputs)
    expect(env.citations).toHaveLength(2)
    expect(env.citations[0].kind).toBe('budget_line')
    expect(env.citations[1].kind).toBe('budget_line')
    expect(env.citations[1].label).toContain('Trailing 4-week')
  })
})

describe('staffingSeverity', () => {
  it('promotes zero-availability to critical', () => {
    expect(staffingSeverity(40, 0)).toBe('critical')
  })
  it('promotes shortfall ≥ 50% to high', () => {
    expect(staffingSeverity(40, 19)).toBe('high')
  })
  it('keeps shortfall < 50% at medium', () => {
    expect(staffingSeverity(40, 21)).toBe('medium')
  })
})

describe('buildStaffingEnvelope', () => {
  const baseInputs = {
    syntheticEntityId: 'staffing-proj-1-2026-06-15',
    todayIso: '2026-06-15',
    scheduledHours: 40,
    availableHours: 16,
    exampleActivityId: 'sched-7',
    exampleActivityName: 'MEP rough-in',
  }

  it('produces a high-severity envelope with shortfall labeled', () => {
    const env = buildStaffingEnvelope(baseInputs)
    expect(env.kind).toBe('staffing')
    expect(env.severity).toBe('high')
    expect(env.summary).toContain('40h')
    expect(env.summary).toContain('16h')
    expect(env.summary).toContain('Shortfall: 24h')
    expect((env.payload as { shortfallHours: number }).shortfallHours).toBe(24)
  })

  it('lifts to critical when no crew checked in', () => {
    const env = buildStaffingEnvelope({ ...baseInputs, availableHours: 0 })
    expect(env.severity).toBe('critical')
  })

  it('emits both citations when activity context is present', () => {
    const env = buildStaffingEnvelope(baseInputs)
    expect(env.citations).toHaveLength(2)
    expect(env.citations[0].kind).toBe('schedule_phase')
    expect(env.citations[1].kind).toBe('daily_log_excerpt')
  })

  it('emits one citation when no example activity is available', () => {
    const env = buildStaffingEnvelope({
      ...baseInputs,
      exampleActivityId: undefined,
      exampleActivityName: undefined,
    })
    expect(env.citations).toHaveLength(1)
    expect(env.citations[0].kind).toBe('daily_log_excerpt')
  })
})

describe('weatherSeverity', () => {
  it('promotes ≥ 3 bad days to high', () => {
    expect(weatherSeverity(3)).toBe('high')
    expect(weatherSeverity(7)).toBe('high')
  })
  it('keeps 1–2 bad days at medium (below floor)', () => {
    expect(weatherSeverity(2)).toBe('medium')
    expect(weatherSeverity(0)).toBe('medium')
  })
})

describe('buildWeatherEnvelope', () => {
  const baseInputs = {
    syntheticEntityId: 'weather-proj-1-2026-06-15-2026-06-17',
    conditionsLabel: 'rain / storm',
    badDayCount: 3,
    outdoorActivityCount: 2,
    exampleActivityId: 'sched-9',
    exampleActivityName: 'Roof membrane',
    firstBadDate: '2026-06-15',
    lastBadDate: '2026-06-17',
  }

  it('produces a high-severity envelope and uses schedule.resequence action', () => {
    const env = buildWeatherEnvelope(baseInputs)
    expect(env.kind).toBe('weather')
    expect(env.severity).toBe('high')
    expect(env.actionType).toBe('schedule.resequence')
    expect(env.summary).toContain('rain / storm')
    expect(env.summary).toContain('3 days')
    expect(env.summary).toContain('Roof membrane')
    expect((env.payload as { insightKind: string }).insightKind).toBe('weather')
    expect((env.payload as { days_recovered: number }).days_recovered).toBe(3)
  })

  it('singularizes language for a 1-day window (not promoted but shape matters)', () => {
    const env = buildWeatherEnvelope({ ...baseInputs, badDayCount: 1, outdoorActivityCount: 1 })
    expect(env.summary).toContain('1 day')
    expect(env.summary).not.toContain('1 days')
  })

  it('omits the citation when no example activity is supplied', () => {
    const env = buildWeatherEnvelope({
      ...baseInputs,
      exampleActivityId: undefined,
      exampleActivityName: undefined,
    })
    expect(env.citations).toHaveLength(0)
  })
})

describe('contract: every envelope satisfies promote_insight_to_draft RPC', () => {
  // The RPC validates: kind ∈ enum, severity ∈ {high,critical}, confidence ≥ 0.7,
  // primaryEntityId is a uuid-shaped string, actionType is non-null.
  // These tests assert the same shape from the TS side.
  const ENUM_KINDS = ['aging', 'cascade', 'variance', 'staffing', 'weather']
  const PROMOTABLE_SEVERITIES = ['high', 'critical']

  it('aging envelope passes RPC contract at high severity', () => {
    const env = buildAgingEnvelope({
      rfiId: '00000000-0000-0000-0000-000000000001',
      rfiNumber: '1',
      rfiTitle: 'x',
      overdueDays: 6,
      activityId: '00000000-0000-0000-0000-000000000002',
      activityName: 'y',
      slipDays: 6,
    })
    expect(ENUM_KINDS).toContain(env.kind)
    expect(PROMOTABLE_SEVERITIES).toContain(env.severity)
    expect(env.confidence).toBeGreaterThanOrEqual(0.7)
    expect(env.primaryEntityId).toMatch(/^[0-9a-f-]{36}$/)
    expect(env.actionType.length).toBeGreaterThan(0)
  })

  it('cascade envelope passes RPC contract at high severity', () => {
    const env = buildCascadeEnvelope({
      submittalId: '00000000-0000-0000-0000-000000000003',
      submittalNumber: '1',
      submittalTitle: 'x',
      submittalStatus: 'rejected',
      activityId: '00000000-0000-0000-0000-000000000004',
      activityName: 'y',
      isCriticalPath: false,
      daysToBaseline: 5,
      slipDays: 5,
    })
    expect(ENUM_KINDS).toContain(env.kind)
    expect(PROMOTABLE_SEVERITIES).toContain(env.severity)
    expect(env.confidence).toBeGreaterThanOrEqual(0.7)
  })

  it('variance envelope passes RPC contract at high severity', () => {
    const env = buildVarianceEnvelope({
      snapshotId: '00000000-0000-0000-0000-000000000005',
      snapshotDate: '2026-06-15',
      weekDeltaPct: 8,
      averageWeeklyPct: 2,
      percentCommitted: 95,
      exposureDollars: 0,
    })
    expect(ENUM_KINDS).toContain(env.kind)
    expect(PROMOTABLE_SEVERITIES).toContain(env.severity)
    expect(env.confidence).toBeGreaterThanOrEqual(0.7)
  })

  it('staffing envelope passes RPC contract when shortfall ≥ 50%', () => {
    const env = buildStaffingEnvelope({
      syntheticEntityId: 'staffing-proj-2026-06-15',
      todayIso: '2026-06-15',
      scheduledHours: 40,
      availableHours: 16,
    })
    expect(ENUM_KINDS).toContain(env.kind)
    expect(PROMOTABLE_SEVERITIES).toContain(env.severity)
    expect(env.confidence).toBeGreaterThanOrEqual(0.7)
  })

  it('weather envelope passes RPC contract at ≥ 3 bad days', () => {
    const env = buildWeatherEnvelope({
      syntheticEntityId: 'weather-proj-2026-06-15-2026-06-17',
      conditionsLabel: 'rain',
      badDayCount: 3,
      outdoorActivityCount: 1,
      firstBadDate: '2026-06-15',
      lastBadDate: '2026-06-17',
    })
    expect(ENUM_KINDS).toContain(env.kind)
    expect(PROMOTABLE_SEVERITIES).toContain(env.severity)
    expect(env.confidence).toBeGreaterThanOrEqual(0.7)
  })
})
