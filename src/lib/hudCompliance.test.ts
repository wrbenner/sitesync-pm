import { describe, it, expect } from 'vitest'
import {
  calculateApplicableFraction,
  calculateMaxCredit,
  getIncomeLimits,
  getRentLimits,
  checkCompliancePeriod,
  calculateOvertimeRate,
  validatePayroll,
  calculateApprenticeRatio,
  generateWH347Data,
  calculateSection3Percentage,
  checkSection3Goals,
} from './hudCompliance'
import type { CertifiedPayroll, PayrollEmployee, Section3Project } from '../types/compliance'

// HUD compliance is regulator-facing math: a regression here would
// generate non-compliant WH-347 forms, miscalculate LIHTC tax credits,
// or fail Davis-Bacon prevailing-wage validation. Tests pin every formula.

describe('hudCompliance — calculateApplicableFraction (LIHTC)', () => {
  it('returns the lesser of unit fraction and floor space fraction', () => {
    const r = calculateApplicableFraction(100, 60, 100_000, 50_000)
    expect(r.unitFraction).toBe(0.60)
    expect(r.floorSpaceFraction).toBe(0.50)
    expect(r.applicableFraction).toBe(0.50)
  })

  it('handles zero totals without divide-by-zero', () => {
    const r = calculateApplicableFraction(0, 0, 0, 0)
    expect(r.unitFraction).toBe(0)
    expect(r.floorSpaceFraction).toBe(0)
    expect(r.applicableFraction).toBe(0)
  })

  it('100% qualified yields fraction of 1.0', () => {
    const r = calculateApplicableFraction(50, 50, 100_000, 100_000)
    expect(r.applicableFraction).toBe(1.0)
  })
})

describe('hudCompliance — calculateMaxCredit', () => {
  it('credit = qualified basis × applicable fraction × credit %', () => {
    expect(calculateMaxCredit(1_000_000, 0.85, 0.09)).toBe(76_500)
  })
})

describe('hudCompliance — getIncomeLimits (HUD AMI multipliers)', () => {
  it('4-person household at 60% AMI = AMI × 0.60 × 1.0', () => {
    expect(getIncomeLimits(80_000, 4, 60)).toBe(48_000)
  })

  it('1-person household at 60% AMI uses 0.70 multiplier', () => {
    // 80_000 * 0.6 * 0.70 = 33_600
    expect(getIncomeLimits(80_000, 1, 60)).toBeCloseTo(33_600, 2)
  })

  it('8-person household at 30% AMI uses 1.32 multiplier', () => {
    expect(getIncomeLimits(80_000, 8, 30)).toBeCloseTo(31_680, 2)
  })

  it('clamps household size to [1, 8]', () => {
    expect(getIncomeLimits(80_000, 12, 60)).toBe(getIncomeLimits(80_000, 8, 60))
    expect(getIncomeLimits(80_000, 0, 60)).toBe(getIncomeLimits(80_000, 1, 60))
  })
})

describe('hudCompliance — getRentLimits', () => {
  it('uses imputed 1.5 persons per bedroom and 30% income → /12', () => {
    // 2-bedroom → 3 persons → income = 80k * 0.6 * 0.90 = 43_200
    // rent = 43_200 * 0.30 / 12 = 1_080
    expect(getRentLimits(80_000, 2, 60)).toBeCloseTo(1_080, 1)
  })

  it('studios (0 bedrooms) treat as 1-person household', () => {
    // 0 bedrooms → max(round(0), 1) = 1 → income = 80k * 0.6 * 0.7 = 33_600 → rent = 840
    expect(getRentLimits(80_000, 0, 60)).toBeCloseTo(840, 1)
  })
})

describe('hudCompliance — checkCompliancePeriod', () => {
  it('returns inCompliance=true within the 30-year extended period', () => {
    const recent = new Date(Date.now() - 5 * 365 * 86400_000).toISOString()
    const r = checkCompliancePeriod(recent)
    expect(r.isInCompliance).toBe(true)
    expect(r.yearsRemaining).toBeGreaterThan(20)
  })

  it('returns inCompliance=false past the 30-year extended period', () => {
    const old = new Date(Date.now() - 35 * 365 * 86400_000).toISOString()
    const r = checkCompliancePeriod(old)
    expect(r.isInCompliance).toBe(false)
    expect(r.yearsRemaining).toBe(0)
  })

  it('initial period spans exactly 15 years', () => {
    const r = checkCompliancePeriod('2026-01-01')
    expect(r.initialPeriod.start).toBe('2026-01-01')
    expect(r.initialPeriod.end).toBe('2041-01-01')
  })

  it('extended use period adds another 15 years (30 total)', () => {
    const r = checkCompliancePeriod('2026-01-01')
    expect(r.extendedUsePeriod.end).toBe('2056-01-01')
  })
})

describe('hudCompliance — calculateOvertimeRate (Davis-Bacon)', () => {
  it('overtime = base × 1.5 + full fringe', () => {
    expect(calculateOvertimeRate(40, 10)).toBe(70) // 40*1.5=60 + 10
  })

  it('zero fringe still gives time-and-a-half', () => {
    expect(calculateOvertimeRate(40, 0)).toBe(60)
  })
})

describe('hudCompliance — validatePayroll', () => {
  function emp(o: Partial<PayrollEmployee>): PayrollEmployee {
    return {
      id: 'e', name: 'Worker', classification: 'Carpenter',
      hoursWorked: 40, overtimeHours: 0, baseRate: 40, fringeRate: 10, totalPaid: 2000,
      ...o,
    }
  }

  it('returns valid=true when every employee meets prevailing wage', () => {
    // Required = 40h * (40+10) = 2000. Paid 2000 → exactly compliant.
    const r = validatePayroll(
      [emp({})],
      [{ classification: 'Carpenter', baseRate: 40, fringeRate: 10 }],
    )
    expect(r.isValid).toBe(true)
    expect(r.violations).toEqual([])
  })

  it('flags shortfall when total paid < required', () => {
    const r = validatePayroll(
      [emp({ totalPaid: 1500 })],
      [{ classification: 'Carpenter', baseRate: 40, fringeRate: 10 }],
    )
    expect(r.isValid).toBe(false)
    expect(r.violations[0]).toEqual({
      employee: 'Worker',
      classification: 'Carpenter',
      required: 2000,
      actual: 1500,
      shortfall: 500,
    })
  })

  it('skips employees with no matching classification in wage rates', () => {
    const r = validatePayroll(
      [emp({ classification: 'Unknown', totalPaid: 10 })],
      [{ classification: 'Carpenter', baseRate: 40, fringeRate: 10 }],
    )
    expect(r.violations).toEqual([])
  })

  it('skips employees with zero hours', () => {
    const r = validatePayroll(
      [emp({ hoursWorked: 0, overtimeHours: 0, totalPaid: 0 })],
      [{ classification: 'Carpenter', baseRate: 40, fringeRate: 10 }],
    )
    expect(r.isValid).toBe(true)
  })

  it('counts overtime requirement at 1.5× base + fringe', () => {
    // Required = 40*(40+10) + 4 * (40*1.5+10) = 2000 + 4*70 = 2280
    const r = validatePayroll(
      [emp({ hoursWorked: 40, overtimeHours: 4, totalPaid: 2200 })],
      [{ classification: 'Carpenter', baseRate: 40, fringeRate: 10 }],
    )
    expect(r.violations[0].required).toBe(2280)
  })
})

describe('hudCompliance — calculateApprenticeRatio', () => {
  it('1 apprentice per 3 journeyworkers exactly meets requirement', () => {
    const r = calculateApprenticeRatio(3, 1)
    expect(r.ratio).toBeCloseTo(1 / 3, 5)
    expect(r.meetsRequirement).toBe(true)
  })

  it('2 apprentices per 3 journeyworkers fails the limit', () => {
    expect(calculateApprenticeRatio(3, 2).meetsRequirement).toBe(false)
  })

  it('0 journeyworkers + apprentices → ratio = Infinity, fails', () => {
    const r = calculateApprenticeRatio(0, 1)
    expect(r.ratio).toBe(Infinity)
    expect(r.meetsRequirement).toBe(false)
  })

  it('0 journeyworkers + 0 apprentices → 0 / pass (vacuous)', () => {
    const r = calculateApprenticeRatio(0, 0)
    expect(r.ratio).toBe(0)
    expect(r.meetsRequirement).toBe(true)
  })
})

describe('hudCompliance — generateWH347Data', () => {
  function payroll(): CertifiedPayroll {
    return {
      contractorName: 'Acme Co',
      contractorAddress: '123 Site Rd',
      projectName: 'P1',
      projectNumber: 'PN-1',
      weekEnding: '2026-01-07',
      employees: [
        {
          id: 'e1', name: 'Bob', classification: 'Electrician',
          hoursWorked: 40, overtimeHours: 5,
          baseRate: 50, fringeRate: 12, totalPaid: 2500,
        },
      ],
      totalGrossPaid: 2900, totalDeductions: 400, totalNetPaid: 2500,
    }
  }

  it('passes through contractor + project metadata', () => {
    const r = generateWH347Data(payroll())
    expect(r.contractorName).toBe('Acme Co')
    expect(r.projectName).toBe('P1')
  })

  it('computes straight rate + overtime rate per employee', () => {
    const r = generateWH347Data(payroll())
    expect(r.employeeRows[0].rateOfPay.straight).toBe(62)  // 50 + 12
    expect(r.employeeRows[0].rateOfPay.overtime).toBe(87) // 50*1.5 + 12
  })

  it('grossPay = straight × hours + overtime × OT hours', () => {
    const r = generateWH347Data(payroll())
    // 40 * 62 + 5 * 87 = 2480 + 435 = 2915
    expect(r.employeeRows[0].grossPay).toBe(2915)
  })

  it('deductions = gross - net (clamped at 0)', () => {
    const r = generateWH347Data(payroll())
    // 2915 - 2500 = 415
    expect(r.employeeRows[0].deductions).toBe(415)
  })

  it('totalStraight + totalOvertime mirror the input hours', () => {
    const r = generateWH347Data(payroll())
    expect(r.employeeRows[0].hoursWorked.totalStraight).toBe(40)
    expect(r.employeeRows[0].hoursWorked.totalOvertime).toBe(5)
  })
})

describe('hudCompliance — calculateSection3Percentage', () => {
  it('returns 0 when total hours is zero', () => {
    expect(calculateSection3Percentage(0, 0)).toBe(0)
  })

  it('30 hours of 100 = 30%', () => {
    expect(calculateSection3Percentage(100, 30)).toBe(30)
  })
})

describe('hudCompliance — checkSection3Goals', () => {
  it('flags 25% labor + 3% contracting goals', () => {
    const project: Section3Project = {
      projectId: 'p',
      totalLaborHours: 1000,
      section3LaborHours: 300,        // 30% — meets 25%
      totalContractAmount: 100_000,
      section3ContractAmount: 4_000,  // 4% — meets 3%
    } as Section3Project
    const r = checkSection3Goals(project)
    expect(r.laborGoalMet).toBe(true)
    expect(r.contractingGoalMet).toBe(true)
    expect(r.laborPercentage).toBe(30)
    expect(r.contractingPercentage).toBe(4)
  })

  it('fails labor goal at 24%, succeeds at 25%', () => {
    expect(
      checkSection3Goals({
        projectId: 'p',
        totalLaborHours: 100, section3LaborHours: 24,
        totalContractAmount: 100, section3ContractAmount: 5,
      } as Section3Project).laborGoalMet,
    ).toBe(false)
    expect(
      checkSection3Goals({
        projectId: 'p',
        totalLaborHours: 100, section3LaborHours: 25,
        totalContractAmount: 100, section3ContractAmount: 5,
      } as Section3Project).laborGoalMet,
    ).toBe(true)
  })

  it('zero contract amount means goal fails (0%)', () => {
    expect(
      checkSection3Goals({
        projectId: 'p',
        totalLaborHours: 100, section3LaborHours: 30,
        totalContractAmount: 0, section3ContractAmount: 0,
      } as Section3Project).contractingGoalMet,
    ).toBe(false)
  })
})
