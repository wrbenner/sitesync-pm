// ── Safety Scoring Engine ──────────────────────────────────────
// Calculates a real-time 0-100 safety score for each project.
// Factors weighted by OSHA severity hierarchy:
//   - Incident rate (TRIR)            30%
//   - Corrective action closure       20%
//   - PPE compliance                  20%
//   - Inspection pass rate            15%
//   - Training/certification status   15%
//
// Score benchmarked against industry averages from BLS data.

// ── Types ─────────────────────────────────────────────────────

export interface SafetyScoreInput {
  // Incident data
  recordableIncidents: number
  totalWorkHours: number
  daysWithoutIncident: number
  nearMissCount: number

  // Corrective actions
  totalCorrectiveActions: number
  closedCorrectiveActions: number
  overdueCorrectiveActions: number

  // PPE compliance
  totalObservations: number
  compliantObservations: number
  violationObservations: number

  // Inspections
  totalInspections: number
  passedInspections: number
  failedInspections: number

  // Certifications
  totalWorkers: number
  workersWithValidCerts: number
  expiringCertsCount: number  // within 30 days
  expiredCertsCount: number
}

export interface SafetyScore {
  overall: number           // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  components: {
    incidentRate: { score: number; weight: number; trir: number }
    correctiveActions: { score: number; weight: number; closureRate: number }
    ppeCompliance: { score: number; weight: number; complianceRate: number }
    inspections: { score: number; weight: number; passRate: number }
    certifications: { score: number; weight: number; complianceRate: number }
  }
  trend: 'improving' | 'stable' | 'declining'
  benchmarkComparison: 'above_average' | 'average' | 'below_average'
  riskLevel: 'low' | 'moderate' | 'high' | 'critical'
  recommendations: string[]
}

// ── Industry Benchmarks (BLS 2025 data) ───────────────────────

const INDUSTRY_TRIR_AVERAGE = 3.1       // Construction industry TRIR
const INDUSTRY_TRIR_BEST = 1.0          // Top quartile



// ── Weight Configuration ──────────────────────────────────────

const WEIGHTS = {
  incidentRate: 0.30,
  correctiveActions: 0.20,
  ppeCompliance: 0.20,
  inspections: 0.15,
  certifications: 0.15,
} as const

// ── Main Calculator ───────────────────────────────────────────

export function calculateSafetyScore(input: SafetyScoreInput): SafetyScore {
  // 1. Incident Rate Score (TRIR based)
  const trir = input.totalWorkHours > 0
    ? (input.recordableIncidents * 200000) / input.totalWorkHours
    : 0
  const trirScore = trir === 0
    ? 100
    : trir <= INDUSTRY_TRIR_BEST
      ? 95
      : trir <= INDUSTRY_TRIR_AVERAGE
        ? Math.max(50, 95 - ((trir - INDUSTRY_TRIR_BEST) / (INDUSTRY_TRIR_AVERAGE - INDUSTRY_TRIR_BEST)) * 45)
        : Math.max(0, 50 - ((trir - INDUSTRY_TRIR_AVERAGE) / INDUSTRY_TRIR_AVERAGE) * 50)

  // Bonus for consecutive safe days
  const safeDayBonus = Math.min(10, input.daysWithoutIncident / 10)
  const incidentScore = Math.min(100, trirScore + safeDayBonus)

  // 2. Corrective Action Closure Rate
  const caClosureRate = input.totalCorrectiveActions > 0
    ? input.closedCorrectiveActions / input.totalCorrectiveActions
    : 1
  const caOverdueePenalty = input.overdueCorrectiveActions * 5  // 5 points per overdue
  const caScore = Math.max(0, Math.round(caClosureRate * 100) - caOverdueePenalty)

  // 3. PPE Compliance Rate
  const ppeComplianceRate = input.totalObservations > 0
    ? input.compliantObservations / input.totalObservations
    : 1
  const ppeScore = Math.round(ppeComplianceRate * 100)

  // 4. Inspection Pass Rate
  const inspectionPassRate = input.totalInspections > 0
    ? input.passedInspections / input.totalInspections
    : 1
  const inspectionFrequencyBonus = Math.min(5, input.totalInspections / 4) // Bonus for frequent inspections
  const inspectionScore = Math.min(100, Math.round(inspectionPassRate * 100) + inspectionFrequencyBonus)

  // 5. Certification Compliance
  const certComplianceRate = input.totalWorkers > 0
    ? input.workersWithValidCerts / input.totalWorkers
    : 1
  const certPenalty = (input.expiredCertsCount * 10) + (input.expiringCertsCount * 3) // Heavier penalty for expired
  const certScore = Math.max(0, Math.round(certComplianceRate * 100) - certPenalty)

  // Calculate weighted overall score
  const overall = Math.round(
    incidentScore * WEIGHTS.incidentRate +
    caScore * WEIGHTS.correctiveActions +
    ppeScore * WEIGHTS.ppeCompliance +
    inspectionScore * WEIGHTS.inspections +
    certScore * WEIGHTS.certifications,
  )

  // Grade assignment
  const grade: SafetyScore['grade'] =
    overall >= 90 ? 'A' :
    overall >= 80 ? 'B' :
    overall >= 70 ? 'C' :
    overall >= 60 ? 'D' : 'F'

  // Benchmark comparison
  const benchmarkComparison: SafetyScore['benchmarkComparison'] =
    trir < INDUSTRY_TRIR_BEST ? 'above_average' :
    trir <= INDUSTRY_TRIR_AVERAGE ? 'average' : 'below_average'

  // Risk level
  const riskLevel: SafetyScore['riskLevel'] =
    overall >= 85 ? 'low' :
    overall >= 70 ? 'moderate' :
    overall >= 50 ? 'high' : 'critical'

  // Generate recommendations
  const recommendations: string[] = []
  if (incidentScore < 70) {
    recommendations.push('Increase toolbox talk frequency and review incident prevention measures')
  }
  if (caScore < 80) {
    recommendations.push(`${input.overdueCorrectiveActions} corrective actions are overdue. Prioritize closure to improve score.`)
  }
  if (ppeScore < 90) {
    recommendations.push('PPE compliance is below target. Consider additional safety stand-downs and spot checks.')
  }
  if (inspectionScore < 80) {
    recommendations.push('Increase inspection frequency and address recurring failure areas.')
  }
  if (certScore < 90) {
    if (input.expiredCertsCount > 0) {
      recommendations.push(`${input.expiredCertsCount} workers have expired certifications. Remove from active duty until renewed.`)
    }
    if (input.expiringCertsCount > 0) {
      recommendations.push(`${input.expiringCertsCount} certifications expiring within 30 days. Schedule renewal training.`)
    }
  }
  if (recommendations.length === 0) {
    recommendations.push('All safety metrics are within target range. Maintain current safety program.')
  }

  return {
    overall,
    grade,
    components: {
      incidentRate: { score: Math.round(incidentScore), weight: WEIGHTS.incidentRate, trir: Math.round(trir * 100) / 100 },
      correctiveActions: { score: Math.round(caScore), weight: WEIGHTS.correctiveActions, closureRate: Math.round(caClosureRate * 100) },
      ppeCompliance: { score: Math.round(ppeScore), weight: WEIGHTS.ppeCompliance, complianceRate: Math.round(ppeComplianceRate * 100) },
      inspections: { score: Math.round(inspectionScore), weight: WEIGHTS.inspections, passRate: Math.round(inspectionPassRate * 100) },
      certifications: { score: Math.round(certScore), weight: WEIGHTS.certifications, complianceRate: Math.round(certComplianceRate * 100) },
    },
    trend: 'stable', // Would be calculated from historical scores
    benchmarkComparison,
    riskLevel,
    recommendations,
  }
}

// ── Trend Calculation ─────────────────────────────────────────

export function calculateTrend(
  scores: Array<{ date: string; score: number }>,
): 'improving' | 'stable' | 'declining' {
  if (scores.length < 2) return 'stable'

  const recent = scores.slice(-5)
  const first = recent[0].score
  const last = recent[recent.length - 1].score
  const diff = last - first

  if (diff > 5) return 'improving'
  if (diff < -5) return 'declining'
  return 'stable'
}

// ── EMR Calculation ───────────────────────────────────────────

export function calculateEMR(
  actualLosses: number,
  expectedLosses: number,
): number {
  if (expectedLosses <= 0) return 1.0
  return Math.round((actualLosses / expectedLosses) * 100) / 100
}

// ── DART Rate ─────────────────────────────────────────────────

export function calculateDARTRate(
  daysAwayRestrictedTransfer: number,
  totalWorkHours: number,
): number {
  if (totalWorkHours <= 0) return 0
  return Math.round((daysAwayRestrictedTransfer * 200000) / totalWorkHours * 100) / 100
}
