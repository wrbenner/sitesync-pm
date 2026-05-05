import { describe, it, expect } from 'vitest'
import { renderText, renderPdf } from './render'
import type { Wh347Generated } from './types'
import type { PrevailingWageDecisionRow } from '../prevailingWage'

const wageDecision = (
  over: Partial<PrevailingWageDecisionRow> = {},
): PrevailingWageDecisionRow =>
  ({
    id: 'wd1',
    state_code: 'WA',
    county: 'King',
    trade: 'electrician',
    base_rate: 52.0,
    fringe_rate: 22.5,
    wage_decision_number: 'WA-2026-1',
    effective_date: '2026-01-01',
    expires_at: null,
    notes: null,
    ...over,
  }) as PrevailingWageDecisionRow

const form = (over: Partial<Wh347Generated> = {}): Wh347Generated => ({
  header: {
    contractorName: 'Acme GC',
    contractorAddress: '123 Main St',
    payrollNumber: 7,
    weekEnding: '2026-05-04',
    projectName: 'Maple Ridge',
    projectLocation: 'Seattle, WA',
    projectNumber: 'F-12345',
    stateCode: 'WA',
    county: 'King',
  },
  workers: [
    {
      workerName: 'Worker One',
      ssnLast4: '1234',
      classification: 'electrician',
      apprenticeLevel: null,
      hoursPerDay: [8, 8, 8, 8, 8, 0, 0],
      straightHours: 40,
      overtimeHours: 0,
      doubleTimeHours: 0,
      hourlyRatePaid: 55,
      fringeAllocation: 'cash',
      fringePerHourCash: 22,
      fringePerHourPlan: 0,
      deductions: [
        { label: 'FICA', amount: 168.3 },
        { label: 'Fed WH', amount: 200 },
      ],
      decision: wageDecision(),
      decisionMatchNote: 'matched on (state, county, trade)',
      totalHours: 40,
      grossPay: 2200,
      fringePay: 880,
      deductionsTotal: 368.3,
      netPay: 1831.7,
      rateViolation: null,
    },
  ],
  statement: {
    signerName: 'Jane Signer',
    signerTitle: 'Payroll Officer',
    payerType: 'contractor',
    periodFrom: '2026-04-28',
    periodTo: '2026-05-04',
    fringeBenefits: 'paid_in_cash',
    exceptions: [],
  },
  gaps: [],
  contentHash: 'abc1234567890abcdef',
  ...over,
})

describe('renderText', () => {
  it('includes the official form header', () => {
    expect(renderText(form())).toMatch(
      /U\.S\. DEPARTMENT OF LABOR — STATEMENT OF COMPLIANCE \/ FORM WH-347/,
    )
  })

  it('lists contractor + project metadata', () => {
    const out = renderText(form())
    expect(out).toMatch(/Contractor: Acme GC/)
    expect(out).toMatch(/Project:    Maple Ridge \(Seattle, WA\)/)
    expect(out).toMatch(/Project #:  F-12345/)
    expect(out).toMatch(/Payroll #:  7/)
    expect(out).toMatch(/Week ending: 2026-05-04/)
    expect(out).toMatch(/Jurisdiction: WA \/ King/)
  })

  it('omits Project # line when projectNumber is null', () => {
    const f = form()
    f.header.projectNumber = null
    const out = renderText(f)
    expect(out).not.toMatch(/Project #:/)
  })

  it('shows masked SSN suffix when ssnLast4 is set', () => {
    expect(renderText(form())).toMatch(/SSN xxx-xx-1234/)
  })

  it('shows apprentice level inline when set', () => {
    const f = form()
    f.workers[0].apprenticeLevel = 2
    expect(renderText(f)).toMatch(/\[Apprentice L2\]/)
  })

  it('renders the matched wage decision number + base/fringe', () => {
    expect(renderText(form())).toMatch(
      /Wage decision:  WA-2026-1 — base \$52\.00\/hr \+ \$22\.50\/hr fringe/,
    )
  })

  it('flags an unresolved wage decision', () => {
    const f = form()
    f.workers[0].decision = null
    f.workers[0].decisionMatchNote = 'no match in WA/King for electrician'
    const out = renderText(f)
    expect(out).toMatch(/\*\*\* UNRESOLVED \*\*\*/)
    expect(out).toMatch(/no match in WA\/King for electrician/)
  })

  it('lists hours per day labelled Mon-Sun', () => {
    expect(renderText(form())).toMatch(/Mon=8.*Tue=8.*Wed=8.*Thu=8.*Fri=8.*Sat=0.*Sun=0/)
  })

  it('emits the deductions detail line when deductions present', () => {
    expect(renderText(form())).toMatch(/deductions: FICA=\$168\.30, Fed WH=\$200\.00/)
  })

  it('omits the deductions detail line when empty', () => {
    const f = form()
    f.workers[0].deductions = []
    expect(renderText(f)).not.toMatch(/deductions: /)
  })

  it('flags a rate violation row', () => {
    const f = form()
    f.workers[0].rateViolation = { shortBy: 3.5, basis: 'paid below base' }
    const out = renderText(f)
    expect(out).toMatch(/\*\*\* RATE VIOLATION: paid below base \(short \$3\.50\/hr\)/)
  })

  it('renders the Statement of Compliance section', () => {
    const out = renderText(form())
    expect(out).toMatch(/Period: 2026-04-28 → 2026-05-04/)
    expect(out).toMatch(/Fringe benefits: paid_in_cash/)
    expect(out).toMatch(/Signed by: Jane Signer, Payroll Officer/)
    expect(out).toMatch(/Payer type: contractor/)
  })

  it('lists exceptions when present', () => {
    const f = form()
    f.statement.exceptions = [
      { classification: 'electrician', explanation: 'overtime adjustment' },
    ]
    expect(renderText(f)).toMatch(/• electrician: overtime adjustment/)
  })

  it('reports a clean gap report when none present', () => {
    expect(renderText(form())).toMatch(/Gap report: clean/)
  })

  it('lists detected gaps when present', () => {
    const f = form()
    f.gaps = [{ kind: 'missing_classification', detail: 'worker 3 has no class' }]
    const out = renderText(f)
    expect(out).toMatch(/GAP REPORT/)
    expect(out).toMatch(/\[missing_classification\] worker 3 has no class/)
  })

  it('appends the content hash for replay-detection', () => {
    expect(renderText(form())).toMatch(/Content hash: abc1234567890abcdef/)
  })
})

describe('renderPdf', () => {
  it('returns a non-empty PDF byte stream beginning with the %PDF magic', async () => {
    const bytes = await renderPdf(form())
    expect(bytes.length).toBeGreaterThan(0)
    // PDF files start with %PDF-
    expect(bytes[0]).toBe(0x25) // %
    expect(bytes[1]).toBe(0x50) // P
    expect(bytes[2]).toBe(0x44) // D
    expect(bytes[3]).toBe(0x46) // F
  })

  it('still renders cleanly when no workers are present', async () => {
    const f = form()
    f.workers = []
    const bytes = await renderPdf(f)
    expect(bytes.length).toBeGreaterThan(0)
  })

  it('still renders when the wage decision is unresolved', async () => {
    const f = form()
    f.workers[0].decision = null
    const bytes = await renderPdf(f)
    expect(bytes.length).toBeGreaterThan(0)
  })

  it('renders both fringe-benefit modes without error', async () => {
    for (const mode of ['paid_in_cash', 'paid_to_plans', 'partial', 'none'] as const) {
      const f = form()
      f.statement.fringeBenefits = mode
      const bytes = await renderPdf(f)
      expect(bytes.length).toBeGreaterThan(0)
    }
  })
})
