import { describe, it, expect } from 'vitest'
import { generateWh347 } from '../index'
import type { Wh347WorkerWeek, Wh347Header, Wh347Statement } from '../types'
import type { PrevailingWageDecisionRow } from '../../prevailingWage'

const HEADER: Wh347Header = {
  contractorName: 'Acme Construction',
  contractorAddress: '123 Main St, Austin, TX',
  payrollNumber: 12,
  weekEnding: '2026-04-25',
  projectName: 'Federal Courthouse',
  projectLocation: 'Austin, TX',
  projectNumber: 'F-26-001',
  stateCode: 'TX',
  county: 'Travis',
}

const STATEMENT: Wh347Statement = {
  signerName: 'Maria Delgado',
  signerTitle: 'Compliance Officer',
  payerType: 'contractor',
  periodFrom: '2026-04-19',
  periodTo: '2026-04-25',
  fringeBenefits: 'paid_to_plans',
  exceptions: [],
}

const ELEC_J: PrevailingWageDecisionRow = {
  id: 'r1', state_code: 'TX', county: 'Travis', trade: 'Electrician',
  apprentice_level: null,
  base_rate: 38.50, fringe_rate: 9.20, overtime_multiplier: 1.5,
  wage_decision_number: 'TX20260001',
  effective_from: '2026-01-01', effective_to: null,
}

const baseWorker = (overrides: Partial<Wh347WorkerWeek> = {}): Wh347WorkerWeek => ({
  workerName: 'John Doe',
  ssnLast4: '1234',
  classification: 'Electrician',
  apprenticeLevel: null,
  hoursPerDay: [8, 8, 8, 8, 8, 0, 0],
  straightHours: 40,
  overtimeHours: 0,
  doubleTimeHours: 0,
  hourlyRatePaid: 38.50,
  fringeAllocation: 'plan',
  fringePerHourCash: 0,
  fringePerHourPlan: 9.20,
  deductions: [{ label: 'Federal Withholding', amount: 285.00 }, { label: 'FICA', amount: 117.81 }],
  ...overrides,
})

describe('generateWh347', () => {
  it('produces a clean form when inputs are correct', async () => {
    const out = await generateWh347({
      header: HEADER, statement: STATEMENT,
      workers: [baseWorker()],
      decisions: [ELEC_J],
    })
    expect(out.gaps).toHaveLength(0)
    expect(out.workers[0].grossPay).toBe(1540)        // 40 × 38.50
    expect(out.workers[0].fringePay).toBe(368)         // 40 × 9.20
    expect(out.workers[0].deductionsTotal).toBe(402.81)
    expect(out.workers[0].netPay).toBeCloseTo(1505.19, 2)
    expect(out.workers[0].rateViolation).toBeNull()
  })

  it('flags rate violation when paid below base', async () => {
    const out = await generateWh347({
      header: HEADER, statement: STATEMENT,
      workers: [baseWorker({ hourlyRatePaid: 35.00 })],
      decisions: [ELEC_J],
    })
    expect(out.workers[0].rateViolation).not.toBeNull()
    expect(out.workers[0].rateViolation?.shortBy).toBe(3.50)
    expect(out.gaps.some(g => g.kind === 'rate_violation')).toBe(true)
  })

  it('flags missing wage decision', async () => {
    const out = await generateWh347({
      header: HEADER, statement: STATEMENT,
      workers: [baseWorker({ classification: 'Plumber' })],
      decisions: [ELEC_J],
    })
    expect(out.workers[0].decision).toBeNull()
    expect(out.gaps.some(g => g.kind === 'no_wage_decision')).toBe(true)
  })

  it('flags day-vs-classified hour mismatch', async () => {
    const out = await generateWh347({
      header: HEADER, statement: STATEMENT,
      workers: [baseWorker({ hoursPerDay: [8, 8, 8, 8, 8, 0, 0], straightHours: 50 })],
      decisions: [ELEC_J],
    })
    expect(out.gaps.some(g => g.kind === 'day_total_mismatch')).toBe(true)
  })

  it('flags interior missing days (zero between two worked days)', async () => {
    // Mon=8, Tue=8, Wed=0, Thu=8, Fri=8 → interior gap on Wed
    const out = await generateWh347({
      header: HEADER, statement: STATEMENT,
      workers: [baseWorker({ hoursPerDay: [8, 8, 0, 8, 8, 0, 0], straightHours: 32 })],
      decisions: [ELEC_J],
    })
    const gap = out.gaps.find(g => g.kind === 'missing_day')
    expect(gap).toBeDefined()
    expect(gap?.detail).toMatch(/Wed/)
  })

  it('does not flag a normal Mon–Fri week as having missing weekend days', async () => {
    // Mon-Fri 8h, Sat=Sun=0 — the standard week
    const out = await generateWh347({
      header: HEADER, statement: STATEMENT,
      workers: [baseWorker()],
      decisions: [ELEC_J],
    })
    expect(out.gaps.find(g => g.kind === 'missing_day')).toBeUndefined()
  })

  it('overtime computes at 1.5×', async () => {
    const out = await generateWh347({
      header: HEADER, statement: STATEMENT,
      workers: [baseWorker({ hoursPerDay: [10, 10, 10, 10, 10, 0, 0], straightHours: 40, overtimeHours: 10 })],
      decisions: [ELEC_J],
    })
    // 40 × 38.50 = 1540, 10 × 38.50 × 1.5 = 577.50
    expect(out.workers[0].grossPay).toBe(2117.50)
  })

  it('flags fringe-allocation mismatch', async () => {
    const out = await generateWh347({
      header: HEADER, statement: STATEMENT,
      workers: [baseWorker({ fringeAllocation: 'cash', fringePerHourCash: 9.20, fringePerHourPlan: 9.20 })],
      decisions: [ELEC_J],
    })
    expect(out.gaps.some(g => g.kind === 'fringe_mismatch')).toBe(true)
  })

  it('flags Statement-level fringe disagreement', async () => {
    const stmt: Wh347Statement = { ...STATEMENT, fringeBenefits: 'none' }
    const out = await generateWh347({
      header: HEADER, statement: stmt,
      workers: [baseWorker()],
      decisions: [ELEC_J],
    })
    expect(out.gaps.some(g => g.kind === 'fringe_statement')).toBe(true)
  })

  it('produces deterministic content hash for same inputs', async () => {
    const a = await generateWh347({ header: HEADER, statement: STATEMENT, workers: [baseWorker()], decisions: [ELEC_J] })
    const b = await generateWh347({ header: HEADER, statement: STATEMENT, workers: [baseWorker()], decisions: [ELEC_J] })
    expect(a.contentHash).toBe(b.contentHash)
  })
})
