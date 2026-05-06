import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
  calculateHTCCredit,
  checkSubstantialRehabilitation,
  calculate45LCredit,
  calculate179DCredit,
  checkSubstantialImprovement,
  generateComplianceAlerts,
} from './hudCompliance';
import type {
  PayrollEmployee,
  WageRate,
  CertifiedPayroll,
  Section3Project,
  Section45LUnit,
  ComplianceProgram,
} from '../types/compliance';

const NOW = new Date('2026-05-05T12:00:00Z');

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterEach(() => {
  vi.useRealTimers();
});

// ── LIHTC ──────────────────────────────────────────────────────

describe('calculateApplicableFraction', () => {
  it('returns the smaller of unit and floor-space fractions', () => {
    expect(calculateApplicableFraction(100, 80, 1000, 700)).toEqual({
      unitFraction: 0.8,
      floorSpaceFraction: 0.7,
      applicableFraction: 0.7,
    });
  });

  it('returns 0 when both totals are zero', () => {
    expect(calculateApplicableFraction(0, 0, 0, 0)).toEqual({
      unitFraction: 0,
      floorSpaceFraction: 0,
      applicableFraction: 0,
    });
  });

  it('handles zero totals on one side', () => {
    expect(calculateApplicableFraction(100, 60, 0, 0).applicableFraction).toBe(0);
  });
});

describe('calculateMaxCredit', () => {
  it('multiplies basis × fraction × rate', () => {
    expect(calculateMaxCredit(1_000_000, 0.7, 0.09)).toBeCloseTo(63_000);
  });
});

describe('getIncomeLimits', () => {
  it('returns 60% of AMI for a 4-person household at 60% target', () => {
    expect(getIncomeLimits(100_000, 4, 60)).toBe(60_000);
  });

  it('uses smaller multiplier for 1-person household', () => {
    expect(getIncomeLimits(100_000, 1, 60)).toBeCloseTo(42_000);
  });

  it('clamps household size to [1,8]', () => {
    expect(getIncomeLimits(100_000, 0, 60)).toBeCloseTo(42_000);
    expect(getIncomeLimits(100_000, 20, 60)).toBeCloseTo(60_000 * 1.32);
  });
});

describe('getRentLimits', () => {
  it('imputes 1.5 persons/bedroom and returns 30% of income / 12', () => {
    // 2 bedroom → 3 imputed → multiplier 0.90
    const rent = getRentLimits(100_000, 2, 60);
    expect(rent).toBeCloseTo((100_000 * 0.6 * 0.9 * 0.3) / 12, 2);
  });

  it('returns positive even for 0 bedrooms (clamped to 1)', () => {
    expect(getRentLimits(100_000, 0, 50)).toBeGreaterThan(0);
  });
});

describe('checkCompliancePeriod', () => {
  it('reports in-compliance during the initial 15-year period', () => {
    const r = checkCompliancePeriod('2020-01-01');
    expect(r.isInCompliance).toBe(true);
    expect(r.initialPeriod.start).toBe('2020-01-01');
    expect(r.yearsRemaining).toBeGreaterThan(0);
  });

  it('reports out-of-compliance past the 30-year extended use period', () => {
    const r = checkCompliancePeriod('1980-01-01');
    expect(r.isInCompliance).toBe(false);
    expect(r.yearsRemaining).toBe(0);
  });
});

// ── Davis-Bacon ────────────────────────────────────────────────

describe('calculateOvertimeRate', () => {
  it('1.5x base + full fringe', () => {
    expect(calculateOvertimeRate(20, 5)).toBe(35); // 30 + 5
  });
});

describe('validatePayroll', () => {
  function emp(over: Partial<PayrollEmployee>): PayrollEmployee {
    return {
      id: 'e1',
      name: 'Worker',
      classification: 'carpenter',
      hoursWorked: 40,
      overtimeHours: 0,
      baseRate: 20,
      fringeRate: 5,
      totalPaid: 1000,
      ...over,
    };
  }
  const rates: WageRate[] = [{ classification: 'carpenter', baseRate: 20, fringeRate: 5 }];

  it('flags underpayment as a violation', () => {
    const r = validatePayroll([emp({ totalPaid: 900 })], rates);
    expect(r.isValid).toBe(false);
    expect(r.violations).toHaveLength(1);
    expect(r.violations[0].shortfall).toBeCloseTo(100);
  });

  it('passes when paid at or above prevailing rate', () => {
    const r = validatePayroll([emp({ totalPaid: 1000 })], rates);
    expect(r.isValid).toBe(true);
  });

  it('skips employees with no matching wage rate', () => {
    const r = validatePayroll([emp({ classification: 'unknown' })], rates);
    expect(r.violations).toEqual([]);
  });

  it('skips employees with zero hours', () => {
    const r = validatePayroll([emp({ hoursWorked: 0, overtimeHours: 0 })], rates);
    expect(r.violations).toEqual([]);
  });

  it('factors overtime correctly', () => {
    const r = validatePayroll(
      [emp({ hoursWorked: 40, overtimeHours: 10, totalPaid: 1000 })],
      rates,
    );
    // Required: 40*25 + 10*(20*1.5+5) = 1000 + 350 = 1350
    expect(r.violations[0].required).toBe(1350);
  });
});

describe('calculateApprenticeRatio', () => {
  it('reports meets-requirement when ratio ≤ 1/3', () => {
    const r = calculateApprenticeRatio(9, 3);
    expect(r.ratio).toBeCloseTo(1 / 3);
    expect(r.meetsRequirement).toBe(true);
  });

  it('reports failure above 1/3 ratio', () => {
    const r = calculateApprenticeRatio(2, 2);
    expect(r.meetsRequirement).toBe(false);
  });

  it('returns Infinity when no journeyworkers but apprentices present', () => {
    const r = calculateApprenticeRatio(0, 2);
    expect(r.ratio).toBe(Infinity);
    expect(r.meetsRequirement).toBe(false);
  });

  it('returns 0/meets when neither journeyworkers nor apprentices', () => {
    const r = calculateApprenticeRatio(0, 0);
    expect(r.ratio).toBe(0);
    expect(r.meetsRequirement).toBe(true);
  });
});

describe('generateWH347Data', () => {
  it('produces a row per employee with totals', () => {
    const payroll: CertifiedPayroll = {
      contractorName: 'Acme',
      contractorAddress: '1 Main',
      projectName: 'Project',
      projectNumber: 'P-1',
      weekEnding: '2026-04-26',
      employees: [
        {
          id: 'e1',
          name: 'A',
          classification: 'carpenter',
          hoursWorked: 40,
          overtimeHours: 5,
          baseRate: 20,
          fringeRate: 5,
          totalPaid: 1100,
        },
      ],
      totalGrossPaid: 1175,
      totalDeductions: 75,
      totalNetPaid: 1100,
    };
    const wh = generateWH347Data(payroll);
    expect(wh.contractorName).toBe('Acme');
    expect(wh.employeeRows).toHaveLength(1);
    expect(wh.employeeRows[0].rateOfPay.straight).toBe(25);
    expect(wh.employeeRows[0].rateOfPay.overtime).toBe(35);
    expect(wh.employeeRows[0].grossPay).toBe(40 * 25 + 5 * 35);
  });

  it('clamps deductions to ≥ 0 when totalPaid > grossPay', () => {
    const wh = generateWH347Data({
      contractorName: 'X',
      contractorAddress: 'Y',
      projectName: 'P',
      projectNumber: 'N',
      weekEnding: '2026-04-26',
      employees: [
        {
          id: 'e1',
          name: 'A',
          classification: 'c',
          hoursWorked: 10,
          overtimeHours: 0,
          baseRate: 10,
          fringeRate: 0,
          totalPaid: 1000, // > grossPay (100)
        },
      ],
      totalGrossPaid: 0,
      totalDeductions: 0,
      totalNetPaid: 0,
    });
    expect(wh.employeeRows[0].deductions).toBe(0);
  });
});

// ── Section 3 ──────────────────────────────────────────────────

describe('calculateSection3Percentage', () => {
  it('returns 0 when total hours is 0', () => {
    expect(calculateSection3Percentage(0, 50)).toBe(0);
  });

  it('returns the percentage when total > 0', () => {
    expect(calculateSection3Percentage(1000, 250)).toBe(25);
  });
});

describe('checkSection3Goals', () => {
  it('reports both goals met when above benchmarks', () => {
    const project: Section3Project = {
      totalLaborHours: 1000,
      section3LaborHours: 300,
      totalContractAmount: 1_000_000,
      section3ContractAmount: 50_000,
    };
    const r = checkSection3Goals(project);
    expect(r.laborGoalMet).toBe(true);
    expect(r.contractingGoalMet).toBe(true);
  });

  it('reports goals missed when below benchmarks', () => {
    const r = checkSection3Goals({
      totalLaborHours: 1000,
      section3LaborHours: 100,
      totalContractAmount: 1_000_000,
      section3ContractAmount: 10_000,
    });
    expect(r.laborGoalMet).toBe(false);
    expect(r.contractingGoalMet).toBe(false);
  });

  it('avoids divide-by-zero on contract percentage', () => {
    const r = checkSection3Goals({
      totalLaborHours: 100,
      section3LaborHours: 25,
      totalContractAmount: 0,
      section3ContractAmount: 10_000,
    });
    expect(r.contractingPercentage).toBe(0);
  });
});

// ── HTC ────────────────────────────────────────────────────────

describe('calculateHTCCredit', () => {
  it('uses default 20% rate', () => {
    expect(calculateHTCCredit(500_000)).toBe(100_000);
  });

  it('honors explicit rate', () => {
    expect(calculateHTCCredit(500_000, 0.10)).toBe(50_000);
  });
});

describe('checkSubstantialRehabilitation', () => {
  it('uses adjusted basis when > $5000 minimum', () => {
    const r = checkSubstantialRehabilitation(100_000, 50_000);
    expect(r.requiredAmount).toBe(100_000);
    expect(r.meetsTest).toBe(false);
    expect(r.shortfall).toBe(50_000);
  });

  it('uses $5000 floor when adjusted basis is lower', () => {
    const r = checkSubstantialRehabilitation(2_000, 6_000);
    expect(r.requiredAmount).toBe(5_000);
    expect(r.meetsTest).toBe(true);
    expect(r.shortfall).toBe(0);
  });
});

// ── Energy ─────────────────────────────────────────────────────

describe('calculate45LCredit', () => {
  function unit(over: Partial<Section45LUnit>): Section45LUnit {
    return {
      unitId: 'u1',
      dwellingType: 'single-family' as Section45LUnit['dwellingType'],
      meetsDOEStandard: false,
      meetsEnergyStar: false,
      meetsZeroEnergyReady: false,
      ...over,
    } as Section45LUnit;
  }

  it('grants $5000/unit for Zero Energy Ready w/ prevailing wage', () => {
    const r = calculate45LCredit([unit({ meetsZeroEnergyReady: true })], true);
    expect(r.perUnit).toEqual([5000]);
    expect(r.total).toBe(5000);
  });

  it('grants $1000/unit for Zero Energy Ready without prevailing wage', () => {
    const r = calculate45LCredit([unit({ meetsZeroEnergyReady: true })], false);
    expect(r.perUnit).toEqual([1000]);
  });

  it('grants $2500/unit for Energy Star w/ prevailing wage', () => {
    const r = calculate45LCredit([unit({ meetsEnergyStar: true })], true);
    expect(r.perUnit).toEqual([2500]);
  });

  it('grants $0 for non-qualifying unit', () => {
    const r = calculate45LCredit([unit({})], true);
    expect(r.perUnit).toEqual([0]);
  });

  it('totals across many units', () => {
    const r = calculate45LCredit(
      [
        unit({ meetsEnergyStar: true }),
        unit({ unitId: 'u2', meetsZeroEnergyReady: true }),
      ],
      true,
    );
    expect(r.total).toBe(2500 + 5000);
  });
});

describe('calculate179DCredit', () => {
  it('returns zero credit when energyReduction below 25%', () => {
    expect(calculate179DCredit(10000, 20, true, true)).toEqual({
      creditPerSqFt: 0,
      totalCredit: 0,
      bonusApplied: false,
    });
  });

  it('grants base $0.50/sqft at 25% reduction without bonus', () => {
    const r = calculate179DCredit(10_000, 25, false, false);
    expect(r.creditPerSqFt).toBe(0.50);
    expect(r.bonusApplied).toBe(false);
  });

  it('caps base at $1/sqft', () => {
    const r = calculate179DCredit(10_000, 100, false, false);
    expect(r.creditPerSqFt).toBe(1);
  });

  it('caps bonus at $2.50/sqft', () => {
    const r = calculate179DCredit(10_000, 100, true, true);
    expect(r.creditPerSqFt).toBe(2.50);
    expect(r.bonusApplied).toBe(true);
  });

  it('does not apply bonus when only one of prevailing/apprenticeship is met', () => {
    const r = calculate179DCredit(10_000, 50, true, false);
    expect(r.bonusApplied).toBe(false);
  });
});

// ── Opportunity Zone ───────────────────────────────────────────

describe('checkSubstantialImprovement', () => {
  it('reports meetsTest=true when improvements >= original basis', () => {
    const r = checkSubstantialImprovement(100_000, 100_000, '2026-01-01');
    expect(r.meetsTest).toBe(true);
    expect(r.percentageImproved).toBe(100);
  });

  it('reports meetsTest=false when below original basis', () => {
    const r = checkSubstantialImprovement(100_000, 50_000, '2026-01-01');
    expect(r.meetsTest).toBe(false);
  });

  it('clamps daysRemaining at 0 when deadline has passed', () => {
    const r = checkSubstantialImprovement(100_000, 100_000, '2020-01-01');
    expect(r.daysRemaining).toBe(0);
  });

  it('avoids divide-by-zero on percentage when originalBasis is 0', () => {
    const r = checkSubstantialImprovement(0, 100, '2026-01-01');
    expect(r.percentageImproved).toBe(0);
  });
});

// ── generateComplianceAlerts ───────────────────────────────────

describe('generateComplianceAlerts', () => {
  function program(over: Partial<ComplianceProgram>): ComplianceProgram {
    return {
      type: 'lihtc',
      projectId: 'pr1',
      projectName: 'Test Project',
      certifications: [],
      deadlines: [],
      ...over,
    };
  }

  it('flags missing certifications as critical', () => {
    const alerts = generateComplianceAlerts([
      program({ certifications: [{ name: 'TCAC', status: 'missing' }] }),
    ]);
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].title).toContain('Missing certification');
  });

  it('flags expired certifications as critical', () => {
    const alerts = generateComplianceAlerts([
      program({
        certifications: [{ name: 'X', status: 'expired', expirationDate: '2025-01-01' }],
      }),
    ]);
    expect(alerts[0].severity).toBe('critical');
  });

  it('warns when valid cert expires within 30 days', () => {
    const expDate = new Date(NOW.getTime() + 15 * 86_400_000).toISOString().slice(0, 10);
    const alerts = generateComplianceAlerts([
      program({
        certifications: [{ name: 'X', status: 'valid', expirationDate: expDate }],
      }),
    ]);
    expect(alerts.some(a => a.severity === 'warning')).toBe(true);
  });

  it('emits info when valid cert expires within 90 days', () => {
    const expDate = new Date(NOW.getTime() + 60 * 86_400_000).toISOString().slice(0, 10);
    const alerts = generateComplianceAlerts([
      program({
        certifications: [{ name: 'X', status: 'valid', expirationDate: expDate }],
      }),
    ]);
    expect(alerts.some(a => a.severity === 'info')).toBe(true);
  });

  it('flags overdue deadlines as critical', () => {
    const alerts = generateComplianceAlerts([
      program({
        deadlines: [{ name: 'Audit', dueDate: '2025-01-01', completed: false }],
      }),
    ]);
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[0].title).toContain('Overdue');
  });

  it('warns about deadlines within 14 days', () => {
    const dueDate = new Date(NOW.getTime() + 7 * 86_400_000).toISOString().slice(0, 10);
    const alerts = generateComplianceAlerts([
      program({ deadlines: [{ name: 'D', dueDate, completed: false }] }),
    ]);
    expect(alerts[0].severity).toBe('warning');
  });

  it('emits info for deadlines within 60 days', () => {
    const dueDate = new Date(NOW.getTime() + 30 * 86_400_000).toISOString().slice(0, 10);
    const alerts = generateComplianceAlerts([
      program({ deadlines: [{ name: 'D', dueDate, completed: false }] }),
    ]);
    expect(alerts[0].severity).toBe('info');
  });

  it('skips completed deadlines', () => {
    const alerts = generateComplianceAlerts([
      program({
        deadlines: [{ name: 'D', dueDate: '2025-01-01', completed: true }],
      }),
    ]);
    expect(alerts).toEqual([]);
  });

  it('warns about audits older than 12 months', () => {
    const alerts = generateComplianceAlerts([
      program({ lastAuditDate: '2024-01-01' }),
    ]);
    expect(alerts.some(a => a.title === 'Annual audit overdue')).toBe(true);
  });

  it('LIHTC-specific: warns when ≤ 2 years remaining', () => {
    // placedInService 28 years ago → ~2 yrs remain in extended use period
    const placed = new Date(NOW.getTime() - 28 * 365.25 * 86_400_000)
      .toISOString().slice(0, 10);
    const alerts = generateComplianceAlerts([
      program({ type: 'lihtc', placedInServiceDate: placed }),
    ]);
    expect(alerts.some(a => a.title.includes('LIHTC compliance period'))).toBe(true);
  });

  it('LIHTC-specific: emits info when extended-use period has ended', () => {
    const alerts = generateComplianceAlerts([
      program({ type: 'lihtc', placedInServiceDate: '1980-01-01' }),
    ]);
    expect(alerts.some(a => a.title === 'LIHTC compliance period ended')).toBe(true);
  });

  it('sorts alerts critical → warning → info', () => {
    const alerts = generateComplianceAlerts([
      program({
        certifications: [
          { name: 'A', status: 'missing' }, // critical
        ],
        deadlines: [
          // info
          { name: 'B', dueDate: new Date(NOW.getTime() + 30 * 86_400_000).toISOString().slice(0, 10), completed: false },
          // warning
          { name: 'C', dueDate: new Date(NOW.getTime() + 7 * 86_400_000).toISOString().slice(0, 10), completed: false },
        ],
      }),
    ]);
    expect(alerts[0].severity).toBe('critical');
    expect(alerts[alerts.length - 1].severity).toBe('info');
  });
});
