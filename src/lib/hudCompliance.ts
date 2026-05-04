// HUD & Tax Credit Compliance Utility Functions
// Calculations for LIHTC, Davis-Bacon, Section 3, HTC, Energy Credits, and Opportunity Zones

import type {
  ApplicableFractionResult,
  CompliancePeriodResult,
  PayrollEmployee,
  WageRate,
  PayrollValidationResult,
  ApprenticeRatioResult,
  CertifiedPayroll,
  WH347Data,
  WH347EmployeeRow,
  Section3Project,
  Section3GoalsResult,
  SubstantialRehabResult,
  Section45LUnit,
  Section45LCreditResult,
  Section179DCreditResult,
  SubstantialImprovementResult,
  ComplianceProgram,
  ComplianceAlert,
} from '../types/compliance'

// ── Helpers ─────────────────────────────────────────────

function daysBetween(a: Date, b: Date): number {
  const msPerDay = 86_400_000
  return Math.ceil((b.getTime() - a.getTime()) / msPerDay)
}

function addYears(date: Date, years: number): Date {
  const d = new Date(date)
  d.setFullYear(d.getFullYear() + years)
  return d
}

function toISODate(date: Date): string {
  return date.toISOString().split('T')[0]
}

// ═══════════════════════════════════════════════════════
// 1. LIHTC (Low-Income Housing Tax Credit)
// ═══════════════════════════════════════════════════════

/**
 * Calculate the applicable fraction for a LIHTC project.
 * The applicable fraction is the lesser of:
 *   - Unit fraction (low-income units / total units)
 *   - Floor space fraction (low-income floor space / total floor space)
 */
export function calculateApplicableFraction(
  totalUnits: number,
  lowIncomeUnits: number,
  totalFloorSpace: number,
  lowIncomeFloorSpace: number,
): ApplicableFractionResult {
  const unitFraction = totalUnits > 0 ? lowIncomeUnits / totalUnits : 0
  const floorSpaceFraction = totalFloorSpace > 0 ? lowIncomeFloorSpace / totalFloorSpace : 0
  const applicableFraction = Math.min(unitFraction, floorSpaceFraction)

  return { unitFraction, floorSpaceFraction, applicableFraction }
}

/**
 * Calculate the maximum annual LIHTC credit.
 * Credit = Qualified Basis x Applicable Fraction x Credit Percentage
 */
export function calculateMaxCredit(
  qualifiedBasis: number,
  applicableFraction: number,
  creditPercentage: number,
): number {
  return qualifiedBasis * applicableFraction * creditPercentage
}

/**
 * Get the income limit for a household based on AMI, household size, and target percentage.
 * HUD publishes income limits as percentages of Area Median Income (AMI),
 * adjusted by household size using standard multipliers.
 */
export function getIncomeLimits(
  areaMedianIncome: number,
  householdSize: number,
  percentage: 30 | 50 | 60 | 80,
): number {
  // HUD household-size adjustment factors (base = 4-person household)
  const sizeMultipliers: Record<number, number> = {
    1: 0.70,
    2: 0.80,
    3: 0.90,
    4: 1.00,
    5: 1.08,
    6: 1.16,
    7: 1.24,
    8: 1.32,
  }

  const multiplier = sizeMultipliers[Math.min(Math.max(householdSize, 1), 8)] ?? 1.0
  return areaMedianIncome * (percentage / 100) * multiplier
}

/**
 * Get the maximum rent limit for a unit.
 * Rent limit = 30% of income limit / 12 months.
 * Income limit is based on imputed household size (1.5 persons per bedroom).
 */
export function getRentLimits(
  areaMedianIncome: number,
  bedroomCount: number,
  percentage: 30 | 50 | 60 | 80,
): number {
  // Imputed household size: 1.5 persons per bedroom (HUD standard)
  const imputedHouseholdSize = Math.max(Math.round(bedroomCount * 1.5), 1)
  const incomeLimit = getIncomeLimits(areaMedianIncome, imputedHouseholdSize, percentage)
  return (incomeLimit * 0.30) / 12
}

/**
 * Check the compliance period for a LIHTC property.
 * Initial compliance period: 15 years from placed-in-service date.
 * Extended use period: additional 15 years (30 years total).
 */
export function checkCompliancePeriod(placedInServiceDate: string): CompliancePeriodResult {
  const startDate = new Date(placedInServiceDate)
  const now = new Date()

  const initialEnd = addYears(startDate, 15)
  const extendedEnd = addYears(startDate, 30)

  const isInCompliance = now <= extendedEnd
  const daysLeft = Math.max(daysBetween(now, extendedEnd), 0)
  const yearsRemaining = Math.max(Math.floor(daysLeft / 365), 0)

  return {
    initialPeriod: {
      start: toISODate(startDate),
      end: toISODate(initialEnd),
    },
    extendedUsePeriod: {
      start: toISODate(initialEnd),
      end: toISODate(extendedEnd),
    },
    isInCompliance,
    yearsRemaining,
  }
}

// ═══════════════════════════════════════════════════════
// 2. Davis-Bacon
// ═══════════════════════════════════════════════════════

/**
 * Calculate the overtime rate under Davis-Bacon.
 * Overtime = 1.5x base rate + full fringe rate.
 */
export function calculateOvertimeRate(baseRate: number, fringeRate: number): number {
  return baseRate * 1.5 + fringeRate
}

/**
 * Validate payroll against Davis-Bacon prevailing wage rates.
 * Checks each employee's effective rate against the required rate for their classification.
 */
export function validatePayroll(
  employees: PayrollEmployee[],
  wageRates: WageRate[],
): PayrollValidationResult {
  const rateMap = new Map(wageRates.map((r) => [r.classification, r]))
  const violations: PayrollValidationResult['violations'] = []

  for (const emp of employees) {
    const required = rateMap.get(emp.classification)
    if (!required) continue

    const totalHours = emp.hoursWorked + emp.overtimeHours
    if (totalHours === 0) continue

    const requiredStraightPay = emp.hoursWorked * (required.baseRate + required.fringeRate)
    const requiredOvertimePay =
      emp.overtimeHours * calculateOvertimeRate(required.baseRate, required.fringeRate)
    const requiredTotal = requiredStraightPay + requiredOvertimePay

    if (emp.totalPaid < requiredTotal) {
      violations.push({
        employee: emp.name,
        classification: emp.classification,
        required: requiredTotal,
        actual: emp.totalPaid,
        shortfall: requiredTotal - emp.totalPaid,
      })
    }
  }

  return { isValid: violations.length === 0, violations }
}

/**
 * Calculate the apprentice-to-journeyworker ratio.
 * Federal guidelines generally allow a maximum of 1 apprentice per 3 journeyworkers (ratio <= 0.333).
 */
export function calculateApprenticeRatio(
  journeyworkers: number,
  apprentices: number,
): ApprenticeRatioResult {
  const ratio = journeyworkers > 0 ? apprentices / journeyworkers : apprentices > 0 ? Infinity : 0
  // Standard max ratio is 1 apprentice per 3 journeyworkers
  const meetsRequirement = ratio <= 1 / 3

  return { ratio, meetsRequirement }
}

/**
 * Generate a WH-347 (Statement of Compliance) data object from certified payroll.
 */
export function generateWH347Data(payroll: CertifiedPayroll): WH347Data {
  const employeeRows: WH347EmployeeRow[] = payroll.employees.map((emp) => {
    const straightHoursPerDay = emp.hoursWorked / 5 // assume 5-day work week
    const overtimeHoursPerDay = emp.overtimeHours / 5
    const straightRate = emp.baseRate + emp.fringeRate
    const overtimeRate = calculateOvertimeRate(emp.baseRate, emp.fringeRate)
    const grossPay = emp.hoursWorked * straightRate + emp.overtimeHours * overtimeRate
    const deductions = grossPay - emp.totalPaid
    const netPay = emp.totalPaid

    return {
      name: emp.name,
      classification: emp.classification,
      hoursWorked: {
        day1: straightHoursPerDay + overtimeHoursPerDay,
        day2: straightHoursPerDay + overtimeHoursPerDay,
        day3: straightHoursPerDay + overtimeHoursPerDay,
        day4: straightHoursPerDay + overtimeHoursPerDay,
        day5: straightHoursPerDay + overtimeHoursPerDay,
        day6: 0,
        day7: 0,
        totalStraight: emp.hoursWorked,
        totalOvertime: emp.overtimeHours,
      },
      rateOfPay: {
        straight: straightRate,
        overtime: overtimeRate,
      },
      grossPay,
      deductions: Math.max(deductions, 0),
      netPay,
    }
  })

  return {
    contractorName: payroll.contractorName,
    contractorAddress: payroll.contractorAddress,
    projectName: payroll.projectName,
    projectNumber: payroll.projectNumber,
    weekEnding: payroll.weekEnding,
    employeeRows,
    totalGrossPaid: payroll.totalGrossPaid,
    totalDeductions: payroll.totalDeductions,
    totalNetPaid: payroll.totalNetPaid,
  }
}

// ═══════════════════════════════════════════════════════
// 3. Section 3 (HUD Economic Opportunities)
// ═══════════════════════════════════════════════════════

/**
 * Calculate the Section 3 labor hours percentage.
 */
export function calculateSection3Percentage(
  totalHours: number,
  section3Hours: number,
): number {
  if (totalHours <= 0) return 0
  return (section3Hours / totalHours) * 100
}

/**
 * Check whether Section 3 goals are met.
 * HUD benchmarks: 25% labor hours, 3% contracting for Section 3 businesses.
 */
export function checkSection3Goals(project: Section3Project): Section3GoalsResult {
  const laborPercentage = calculateSection3Percentage(
    project.totalLaborHours,
    project.section3LaborHours,
  )
  const contractingPercentage =
    project.totalContractAmount > 0
      ? (project.section3ContractAmount / project.totalContractAmount) * 100
      : 0

  return {
    laborGoalMet: laborPercentage >= 25,
    laborPercentage,
    contractingGoalMet: contractingPercentage >= 3,
    contractingPercentage,
  }
}

// ═══════════════════════════════════════════════════════
// 4. HTC (Historic Tax Credit)
// ═══════════════════════════════════════════════════════

/**
 * Calculate the Historic Tax Credit.
 * Default credit rate is 20% for certified historic structures.
 */
export function calculateHTCCredit(
  qualifiedExpenditures: number,
  creditRate: number = 0.20,
): number {
  return qualifiedExpenditures * creditRate
}

/**
 * Check the substantial rehabilitation test for HTC.
 * QRE must exceed the greater of $5,000 or the adjusted basis of the building.
 */
export function checkSubstantialRehabilitation(
  adjustedBasis: number,
  qre: number,
): SubstantialRehabResult {
  const requiredAmount = Math.max(adjustedBasis, 5_000)
  const shortfall = Math.max(requiredAmount - qre, 0)

  return {
    meetsTest: qre >= requiredAmount,
    requiredAmount,
    currentAmount: qre,
    shortfall,
  }
}

// ═══════════════════════════════════════════════════════
// 5. Energy Credits
// ═══════════════════════════════════════════════════════

/**
 * Calculate Section 45L energy-efficient home credits.
 * Base credit: $500 (Energy Star) or $1,000 (DOE Zero Energy Ready).
 * With prevailing wage: $2,500 (Energy Star) or $5,000 (Zero Energy Ready).
 */
export function calculate45LCredit(
  units: Section45LUnit[],
  prevailingWageMet: boolean,
): Section45LCreditResult {
  const perUnit = units.map((unit) => {
    if (unit.meetsZeroEnergyReady) {
      return prevailingWageMet ? 5_000 : 1_000
    }
    if (unit.meetsEnergyStar || unit.meetsDOEStandard) {
      return prevailingWageMet ? 2_500 : 500
    }
    return 0
  })

  return {
    perUnit,
    total: perUnit.reduce<number>((sum, credit) => sum + credit, 0),
  }
}

/**
 * Calculate Section 179D energy-efficient commercial building deduction.
 * Base: up to $0.50/sqft. With prevailing wage + apprenticeship: up to $2.50/sqft.
 * Energy reduction must be at least 25% to qualify.
 */
export function calculate179DCredit(
  squareFootage: number,
  energyReduction: number,
  prevailingWageMet: boolean,
  apprenticeshipMet: boolean,
): Section179DCreditResult {
  if (energyReduction < 25) {
    return { creditPerSqFt: 0, totalCredit: 0, bonusApplied: false }
  }

  const bonusApplied = prevailingWageMet && apprenticeshipMet

  // Base rate scales from $0.50 at 25% reduction up to max
  // Each percentage point above 25% adds $0.02/sqft (base) or $0.10/sqft (bonus)
  const reductionAboveMin = Math.min(energyReduction - 25, 25)
  let creditPerSqFt: number

  if (bonusApplied) {
    creditPerSqFt = 0.50 + reductionAboveMin * 0.08
    creditPerSqFt = Math.min(creditPerSqFt, 2.50)
  } else {
    creditPerSqFt = 0.50 + reductionAboveMin * 0.02
    creditPerSqFt = Math.min(creditPerSqFt, 1.00)
  }

  return {
    creditPerSqFt: Math.round(creditPerSqFt * 100) / 100,
    totalCredit: Math.round(squareFootage * creditPerSqFt * 100) / 100,
    bonusApplied,
  }
}

// ═══════════════════════════════════════════════════════
// 6. Opportunity Zone
// ═══════════════════════════════════════════════════════

/**
 * Check the substantial improvement test for Opportunity Zone investments.
 * Improvements must exceed the original basis within 30 months of acquisition.
 */
export function checkSubstantialImprovement(
  originalBasis: number,
  improvementBasis: number,
  investmentDate: string,
): SubstantialImprovementResult {
  const start = new Date(investmentDate)
  const now = new Date()
  const deadline = new Date(start)
  deadline.setMonth(deadline.getMonth() + 30)

  const daysRemaining = Math.max(daysBetween(now, deadline), 0)
  const percentageImproved = originalBasis > 0 ? (improvementBasis / originalBasis) * 100 : 0

  return {
    meetsTest: improvementBasis >= originalBasis,
    percentageImproved,
    deadline: toISODate(deadline),
    daysRemaining,
  }
}

// ═══════════════════════════════════════════════════════
// 7. Compliance Alerts
// ═══════════════════════════════════════════════════════

/**
 * Generate compliance alerts across all enrolled programs.
 * Checks for approaching deadlines, missing/expired certifications, and audit gaps.
 */
export function generateComplianceAlerts(
  programs: ComplianceProgram[],
): ComplianceAlert[] {
  const alerts: ComplianceAlert[] = []
  const now = new Date()

  for (const program of programs) {
    // Check certifications
    for (const cert of program.certifications) {
      if (cert.status === 'missing') {
        alerts.push({
          programType: program.type,
          projectId: program.projectId,
          projectName: program.projectName,
          severity: 'critical',
          title: `Missing certification: ${cert.name}`,
          message: `Required certification "${cert.name}" has not been submitted for ${program.projectName}.`,
        })
      }

      if (cert.status === 'expired') {
        alerts.push({
          programType: program.type,
          projectId: program.projectId,
          projectName: program.projectName,
          severity: 'critical',
          title: `Expired certification: ${cert.name}`,
          message: `Certification "${cert.name}" expired on ${cert.expirationDate ?? 'unknown date'}.`,
          dueDate: cert.expirationDate,
        })
      }

      if (cert.status === 'valid' && cert.expirationDate) {
        const expDate = new Date(cert.expirationDate)
        const daysUntilExpiry = daysBetween(now, expDate)

        if (daysUntilExpiry <= 30 && daysUntilExpiry > 0) {
          alerts.push({
            programType: program.type,
            projectId: program.projectId,
            projectName: program.projectName,
            severity: 'warning',
            title: `Certification expiring soon: ${cert.name}`,
            message: `"${cert.name}" expires in ${daysUntilExpiry} days on ${cert.expirationDate}.`,
            dueDate: cert.expirationDate,
            daysRemaining: daysUntilExpiry,
          })
        } else if (daysUntilExpiry <= 90 && daysUntilExpiry > 30) {
          alerts.push({
            programType: program.type,
            projectId: program.projectId,
            projectName: program.projectName,
            severity: 'info',
            title: `Certification renewal upcoming: ${cert.name}`,
            message: `"${cert.name}" expires in ${daysUntilExpiry} days on ${cert.expirationDate}.`,
            dueDate: cert.expirationDate,
            daysRemaining: daysUntilExpiry,
          })
        }
      }
    }

    // Check deadlines
    for (const deadline of program.deadlines) {
      if (deadline.completed) continue

      const dueDate = new Date(deadline.dueDate)
      const daysUntilDue = daysBetween(now, dueDate)

      if (daysUntilDue < 0) {
        alerts.push({
          programType: program.type,
          projectId: program.projectId,
          projectName: program.projectName,
          severity: 'critical',
          title: `Overdue: ${deadline.name}`,
          message: `"${deadline.name}" was due on ${deadline.dueDate} (${Math.abs(daysUntilDue)} days overdue).`,
          dueDate: deadline.dueDate,
          daysRemaining: daysUntilDue,
        })
      } else if (daysUntilDue <= 14) {
        alerts.push({
          programType: program.type,
          projectId: program.projectId,
          projectName: program.projectName,
          severity: 'warning',
          title: `Deadline approaching: ${deadline.name}`,
          message: `"${deadline.name}" is due in ${daysUntilDue} days on ${deadline.dueDate}.`,
          dueDate: deadline.dueDate,
          daysRemaining: daysUntilDue,
        })
      } else if (daysUntilDue <= 60) {
        alerts.push({
          programType: program.type,
          projectId: program.projectId,
          projectName: program.projectName,
          severity: 'info',
          title: `Upcoming deadline: ${deadline.name}`,
          message: `"${deadline.name}" is due in ${daysUntilDue} days on ${deadline.dueDate}.`,
          dueDate: deadline.dueDate,
          daysRemaining: daysUntilDue,
        })
      }
    }

    // Check for stale audits (no audit in 12+ months)
    if (program.lastAuditDate) {
      const lastAudit = new Date(program.lastAuditDate)
      const daysSinceAudit = daysBetween(lastAudit, now)

      if (daysSinceAudit > 365) {
        alerts.push({
          programType: program.type,
          projectId: program.projectId,
          projectName: program.projectName,
          severity: 'warning',
          title: 'Annual audit overdue',
          message: `Last ${program.type.toUpperCase()} audit was ${Math.floor(daysSinceAudit / 30)} months ago (${program.lastAuditDate}).`,
        })
      }
    }

    // LIHTC-specific: check compliance period
    if (program.type === 'lihtc' && program.placedInServiceDate) {
      const period = checkCompliancePeriod(program.placedInServiceDate)
      if (!period.isInCompliance) {
        alerts.push({
          programType: 'lihtc',
          projectId: program.projectId,
          projectName: program.projectName,
          severity: 'info',
          title: 'LIHTC compliance period ended',
          message: `The extended use period ended for ${program.projectName}. Property may be eligible for market-rate conversion.`,
        })
      } else if (period.yearsRemaining <= 2) {
        alerts.push({
          programType: 'lihtc',
          projectId: program.projectId,
          projectName: program.projectName,
          severity: 'warning',
          title: 'LIHTC compliance period ending soon',
          message: `Only ${period.yearsRemaining} year(s) remaining in the extended use period for ${program.projectName}.`,
          daysRemaining: period.yearsRemaining * 365,
        })
      }
    }
  }

  // Sort: critical first, then warning, then info
  const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 }
  alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  return alerts
}
