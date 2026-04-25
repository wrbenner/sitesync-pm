// HUD & Tax Credit Compliance Types

// ── LIHTC ───────────────────────────────────────────────

export interface ApplicableFractionResult {
  unitFraction: number
  floorSpaceFraction: number
  applicableFraction: number
}

export interface CompliancePeriodResult {
  initialPeriod: { start: string; end: string }
  extendedUsePeriod: { start: string; end: string }
  isInCompliance: boolean
  yearsRemaining: number
}

// ── Davis-Bacon ─────────────────────────────────────────

export interface PayrollEmployee {
  id: string
  name: string
  classification: string
  hoursWorked: number
  overtimeHours: number
  baseRate: number
  fringeRate: number
  totalPaid: number
}

export interface WageRate {
  classification: string
  baseRate: number
  fringeRate: number
}

export interface PayrollViolation {
  employee: string
  classification: string
  required: number
  actual: number
  shortfall: number
}

export interface PayrollValidationResult {
  isValid: boolean
  violations: PayrollViolation[]
}

export interface ApprenticeRatioResult {
  ratio: number
  meetsRequirement: boolean
}

export interface CertifiedPayroll {
  contractorName: string
  contractorAddress: string
  projectName: string
  projectNumber: string
  weekEnding: string
  employees: PayrollEmployee[]
  totalGrossPaid: number
  totalDeductions: number
  totalNetPaid: number
}

export interface WH347Data {
  contractorName: string
  contractorAddress: string
  projectName: string
  projectNumber: string
  weekEnding: string
  employeeRows: WH347EmployeeRow[]
  totalGrossPaid: number
  totalDeductions: number
  totalNetPaid: number
}

export interface WH347EmployeeRow {
  name: string
  classification: string
  hoursWorked: {
    day1: number
    day2: number
    day3: number
    day4: number
    day5: number
    day6: number
    day7: number
    totalStraight: number
    totalOvertime: number
  }
  rateOfPay: {
    straight: number
    overtime: number
  }
  grossPay: number
  deductions: number
  netPay: number
}

// ── Section 3 ───────────────────────────────────────────

export interface Section3Project {
  totalLaborHours: number
  section3LaborHours: number
  totalContractAmount: number
  section3ContractAmount: number
}

export interface Section3GoalsResult {
  laborGoalMet: boolean
  laborPercentage: number
  contractingGoalMet: boolean
  contractingPercentage: number
}

// ── HTC (Historic Tax Credit) ───────────────────────────

export interface SubstantialRehabResult {
  meetsTest: boolean
  requiredAmount: number
  currentAmount: number
  shortfall: number
}

// ── Energy Credits ──────────────────────────────────────

export type Section45LDwellingType =
  | 'single_family'
  | 'multifamily'
  | 'manufactured'

export interface Section45LUnit {
  unitId: string
  dwellingType: Section45LDwellingType
  meetsDOEStandard: boolean
  meetsEnergyStar: boolean
  meetsZeroEnergyReady: boolean
}

export interface Section45LCreditResult {
  perUnit: number[]
  total: number
}

export interface Section179DCreditResult {
  creditPerSqFt: number
  totalCredit: number
  bonusApplied: boolean
}

// ── Opportunity Zone ────────────────────────────────────

export interface SubstantialImprovementResult {
  meetsTest: boolean
  percentageImproved: number
  deadline: string
  daysRemaining: number
}

// ── Compliance Alerts ───────────────────────────────────

export type ComplianceProgramType =
  | 'lihtc'
  | 'davis_bacon'
  | 'section3'
  | 'htc'
  | 'section_45l'
  | 'section_179d'
  | 'opportunity_zone'

export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface ComplianceProgram {
  type: ComplianceProgramType
  projectId: string
  projectName: string
  certifications: ComplianceCertification[]
  deadlines: ComplianceDeadline[]
  lastAuditDate?: string
  placedInServiceDate?: string
}

export interface ComplianceCertification {
  name: string
  status: 'valid' | 'expired' | 'pending' | 'missing'
  expirationDate?: string
  issuedDate?: string
}

export interface ComplianceDeadline {
  name: string
  dueDate: string
  completed: boolean
}

export interface ComplianceAlert {
  programType: ComplianceProgramType
  projectId: string
  projectName: string
  severity: AlertSeverity
  title: string
  message: string
  dueDate?: string
  daysRemaining?: number
}
