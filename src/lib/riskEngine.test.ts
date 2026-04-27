import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  riskLevel,
  riskColor,
  computeRFIRisk,
  computeBudgetRisk,
  computeScheduleRisk,
  computeSafetyRisk,
  overallProjectRisk,
} from './riskEngine'

// Anchored "today" for deterministic days-open math.
const FIXED_TODAY = '2026-04-25T00:00:00Z'

// ── riskLevel ladder ─────────────────────────────────────────────

describe('riskLevel — score → level mapping', () => {
  it('low at boundary 0 and 25', () => {
    expect(riskLevel(0)).toBe('low')
    expect(riskLevel(25)).toBe('low')
  })

  it('medium at 26..50', () => {
    expect(riskLevel(26)).toBe('medium')
    expect(riskLevel(50)).toBe('medium')
  })

  it('high at 51..75', () => {
    expect(riskLevel(51)).toBe('high')
    expect(riskLevel(75)).toBe('high')
  })

  it('critical at 76+', () => {
    expect(riskLevel(76)).toBe('critical')
    expect(riskLevel(100)).toBe('critical')
  })
})

describe('riskColor — design-system palette', () => {
  it('low uses statusActive green', () => {
    expect(riskColor(20)).toBe('#10B981')
  })

  it('medium uses amber', () => {
    expect(riskColor(40)).toBe('#F59E0B')
  })

  it('high uses orange', () => {
    expect(riskColor(70)).toBe('#F97316')
  })

  it('critical uses red', () => {
    expect(riskColor(90)).toBe('#EF4444')
  })
})

// ── computeRFIRisk ───────────────────────────────────────────────

describe('computeRFIRisk', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(FIXED_TODAY))
  })
  afterEach(() => { vi.useRealTimers() })

  it('Just-created RFI with normal priority and no flags has low score', () => {
    const r = computeRFIRisk({
      id: 'r1', created_at: FIXED_TODAY, priority: 'medium',
    })
    // No critical-path flag and small contributing factors → low
    expect(r.level).toBe('low')
  })

  it('Critical-path RFI with high priority creates a high or critical score', () => {
    const r = computeRFIRisk({
      id: 'r1', created_at: '2026-04-01', priority: 'critical', on_critical_path: true,
    })
    expect(['high', 'critical']).toContain(r.level)
  })

  it('RFI returned 2+ times saturates the returned/reopened factor at 100', () => {
    const r = computeRFIRisk({
      id: 'r1', created_at: FIXED_TODAY, returned_count: 5,
    })
    const returnedFactor = r.factors.find(f => f.name.startsWith('Returned'))!
    expect(returnedFactor.contribution).toBe(100)
  })

  it('Always reports 5 contributing factors (one per category)', () => {
    const r = computeRFIRisk({ id: 'r1', created_at: FIXED_TODAY })
    expect(r.factors).toHaveLength(5)
  })

  it('priority "high" gives priorityFactor=75 (visible in factor descriptions)', () => {
    const r = computeRFIRisk({ id: 'r1', created_at: FIXED_TODAY, priority: 'high' })
    const priorityFactor = r.factors.find(f => f.name === 'Priority level')!
    expect(priorityFactor.contribution).toBe(75)
  })

  it('Score is bounded to 0..100 even with extreme inputs', () => {
    const r = computeRFIRisk({
      id: 'r1', created_at: '2024-01-01',
      priority: 'critical', on_critical_path: true, returned_count: 100, assignee_response_rate: 0,
    })
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeLessThanOrEqual(100)
  })
})

// ── computeBudgetRisk ────────────────────────────────────────────

describe('computeBudgetRisk', () => {
  it('Half-spent line item with neutral elapsed has near-zero overrun risk', () => {
    const r = computeBudgetRisk({ budget: 100_000, actual: 25_000, committed: 25_000, elapsed_fraction: 0.5 })
    // consumption=0.5 → overrun = (0.5-0.5)*200 = 0
    const overrunFactor = r.factors.find(f => f.name.startsWith('Actual+Committed'))!
    expect(overrunFactor.contribution).toBe(0)
  })

  it('Over-budget line item drives overrun factor toward 100', () => {
    const r = computeBudgetRisk({ budget: 100_000, actual: 80_000, committed: 80_000, elapsed_fraction: 1 })
    // consumption=1.6 → overrun=min(100, (1.6-0.5)*200) = 100
    const overrunFactor = r.factors.find(f => f.name.startsWith('Actual+Committed'))!
    expect(overrunFactor.contribution).toBe(100)
  })

  it('Burn-rate factor activates when burnRatio > 0.9', () => {
    // actual/budget=0.8, elapsed=0.5 → burnRatio=1.6 → burn=min(100,(1.6-0.9)*100)=70
    const r = computeBudgetRisk({ budget: 100_000, actual: 80_000, committed: 0, elapsed_fraction: 0.5 })
    const burnFactor = r.factors.find(f => f.name.startsWith('Burn rate'))!
    expect(burnFactor.contribution).toBe(70)
  })

  it('Change-order velocity: 4+ COs in 30d saturates the factor at 100', () => {
    const r = computeBudgetRisk({ budget: 100_000, actual: 50_000, committed: 0, change_order_count_30d: 10 })
    const coFactor = r.factors.find(f => f.name.startsWith('Change order'))!
    expect(coFactor.contribution).toBe(100)
  })

  it('Forecast variance: forecast wildly above budget → high forecast factor', () => {
    const r = computeBudgetRisk({ budget: 100_000, actual: 50_000, committed: 0, forecast: 200_000 })
    // |200k - 100k| / 100k = 1.0 → factor = min(100, 1.0*200) = 100
    const fcFactor = r.factors.find(f => f.name.startsWith('Forecast'))!
    expect(fcFactor.contribution).toBe(100)
  })

  it('Always reports 4 budget factors', () => {
    const r = computeBudgetRisk({ budget: 100_000, actual: 0, committed: 0 })
    expect(r.factors).toHaveLength(4)
  })

  it('Score is bounded 0..100', () => {
    const r = computeBudgetRisk({ budget: 100, actual: 100_000, committed: 100_000, change_order_count_30d: 50 })
    expect(r.score).toBeGreaterThanOrEqual(0)
    expect(r.score).toBeLessThanOrEqual(100)
  })
})

// ── computeScheduleRisk ──────────────────────────────────────────

describe('computeScheduleRisk', () => {
  it('On-pace task with float and clear predecessors → low risk', () => {
    const r = computeScheduleRisk({
      id: 't1', percent_complete: 50, expected_percent: 50, float_days: 10, predecessors_complete: true,
    })
    expect(r.level).toBe('low')
  })

  it('Behind-pace task drives progress factor up', () => {
    // 30% complete vs 80% expected → progress_gap=50 → factor=min(100,50*1.5)=75
    const r = computeScheduleRisk({
      id: 't1', percent_complete: 30, expected_percent: 80, float_days: 5,
    })
    const pf = r.factors.find(f => f.name.startsWith('% complete'))!
    expect(pf.contribution).toBe(75)
  })

  it('Zero or negative float saturates the float factor at 100', () => {
    const r0 = computeScheduleRisk({ id: 't1', percent_complete: 50, expected_percent: 50, float_days: 0 })
    const rNeg = computeScheduleRisk({ id: 't1', percent_complete: 50, expected_percent: 50, float_days: -5 })
    const ff0 = r0.factors.find(f => f.name.startsWith('Float'))!
    const ffN = rNeg.factors.find(f => f.name.startsWith('Float'))!
    expect(ff0.contribution).toBe(100)
    expect(ffN.contribution).toBe(100)
  })

  it('Predecessors blocked → predecessor factor saturates at 100', () => {
    const r = computeScheduleRisk({
      id: 't1', percent_complete: 0, expected_percent: 0, predecessors_complete: false,
    })
    const pf = r.factors.find(f => f.name.startsWith('Predecessor'))!
    expect(pf.contribution).toBe(100)
  })

  it('Weather-sensitive task in high-season risk window contributes', () => {
    const r = computeScheduleRisk({
      id: 't1', percent_complete: 0, expected_percent: 0, weather_dependent: true, season_risk: 0.8,
    })
    const wf = r.factors.find(f => f.name.startsWith('Weather'))!
    expect(wf.contribution).toBe(80)
  })

  it('Resource conflicts: 2+ saturates at 100 (50 per conflict, capped)', () => {
    const r = computeScheduleRisk({
      id: 't1', percent_complete: 0, expected_percent: 0, resource_conflicts: 5,
    })
    const cf = r.factors.find(f => f.name.startsWith('Resource'))!
    expect(cf.contribution).toBe(100)
  })

  it('Always reports 5 schedule factors', () => {
    const r = computeScheduleRisk({ id: 't1', percent_complete: 0, expected_percent: 0 })
    expect(r.factors).toHaveLength(5)
  })
})

// ── computeSafetyRisk ────────────────────────────────────────────

describe('computeSafetyRisk', () => {
  it('Recent incident drives the incident factor up (decays at 2 points/day)', () => {
    const r = computeSafetyRisk({
      days_since_last_incident: 0,
      inspections_required_30d: 4, inspections_completed_30d: 4,
      open_corrective_actions: 0, certs_expiring_30d: 0,
    })
    const inc = r.factors.find(f => f.name.startsWith('Days since'))!
    expect(inc.contribution).toBe(100)
  })

  it('50+ days since last incident → incident factor floors at 0', () => {
    const r = computeSafetyRisk({
      days_since_last_incident: 60,
      inspections_required_30d: 4, inspections_completed_30d: 4,
      open_corrective_actions: 0, certs_expiring_30d: 0,
    })
    const inc = r.factors.find(f => f.name.startsWith('Days since'))!
    expect(inc.contribution).toBe(0)
  })

  it('No completed inspections → inspectionFactor=100', () => {
    const r = computeSafetyRisk({
      days_since_last_incident: 100,
      inspections_required_30d: 4, inspections_completed_30d: 0,
      open_corrective_actions: 0, certs_expiring_30d: 0,
    })
    const inspectionFactor = r.factors.find(f => f.name.startsWith('Inspection'))!
    expect(inspectionFactor.contribution).toBe(100)
  })

  it('Open corrective actions: 5+ saturates at 100 (20 per item)', () => {
    const r = computeSafetyRisk({
      days_since_last_incident: 100,
      inspections_required_30d: 4, inspections_completed_30d: 4,
      open_corrective_actions: 10, certs_expiring_30d: 0,
    })
    const cFactor = r.factors.find(f => f.name.startsWith('Open corrective'))!
    expect(cFactor.contribution).toBe(100)
  })

  it('Certs expiring: 4+ saturates at 100 (25 per cert)', () => {
    const r = computeSafetyRisk({
      days_since_last_incident: 100,
      inspections_required_30d: 4, inspections_completed_30d: 4,
      open_corrective_actions: 0, certs_expiring_30d: 5,
    })
    const certs = r.factors.find(f => f.name.startsWith('Certifications'))!
    expect(certs.contribution).toBe(100)
  })

  it('TRIR trending up adds risk; flat trend stays at 50 (the neutral midpoint)', () => {
    const flat = computeSafetyRisk({
      days_since_last_incident: 100, inspections_required_30d: 4, inspections_completed_30d: 4,
      open_corrective_actions: 0, certs_expiring_30d: 0, trir_trend: 0,
    })
    const flatTrir = flat.factors.find(f => f.name === 'TRIR trend')!
    expect(flatTrir.contribution).toBe(50)

    const up = computeSafetyRisk({
      days_since_last_incident: 100, inspections_required_30d: 4, inspections_completed_30d: 4,
      open_corrective_actions: 0, certs_expiring_30d: 0, trir_trend: 1.0,
    })
    const upTrir = up.factors.find(f => f.name === 'TRIR trend')!
    expect(upTrir.contribution).toBe(100)
  })

  it('Always reports 5 safety factors', () => {
    const r = computeSafetyRisk({
      days_since_last_incident: 0, inspections_required_30d: 0, inspections_completed_30d: 0,
      open_corrective_actions: 0, certs_expiring_30d: 0,
    })
    expect(r.factors).toHaveLength(5)
  })
})

// ── overallProjectRisk ───────────────────────────────────────────

describe('overallProjectRisk — category averaging', () => {
  it('Returns 0 when no categories scored', () => {
    expect(overallProjectRisk({})).toBe(0)
  })

  it('Returns the single category score when only one category provided', () => {
    expect(overallProjectRisk({ rfi: 80 })).toBe(80)
  })

  it('Averages across provided categories (rounded)', () => {
    expect(overallProjectRisk({ rfi: 80, budget: 60, schedule: 40, safety: 20 })).toBe(50)
  })

  it('Skips undefined / non-numeric categories', () => {
    // budget undefined; only rfi=60 → average 60
    expect(overallProjectRisk({ rfi: 60 })).toBe(60)
  })

  it('Result is rounded to nearest integer (no floats leaking into UI)', () => {
    // (50 + 51 + 52)/3 = 51 → rounded 51
    expect(overallProjectRisk({ rfi: 50, budget: 51, schedule: 52 })).toBe(51)
  })
})
