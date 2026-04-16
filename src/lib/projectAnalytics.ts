// Construction Project Analytics Engine
// Computes health scores, predictions, and performance metrics from real data

export interface HealthDimension {
  name: string
  score: number
  weight: number
  trend: 'improving' | 'stable' | 'declining'
  details: string
}

export interface ProjectHealthScore {
  overall: number
  dimensions: HealthDimension[]
  prediction: {
    completionDate: string
    confidenceLevel: number
    finalCost: number
    costConfidence: number
    riskLevel: 'low' | 'medium' | 'high' | 'critical'
  }
}

export function computeScheduleScore(phases: Array<{ percent_complete: number | null; status: string | null; is_critical_path: boolean | null }>): number {
  if (phases.length === 0) return 100
  const onTrack = phases.filter(p => p.status !== 'at_risk' && p.status !== 'delayed').length
  const criticalDelayed = phases.filter(p => p.is_critical_path && (p.status === 'at_risk' || p.status === 'delayed')).length
  const score = (onTrack / phases.length) * 100 - criticalDelayed * 15
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function computeCostScore(items: Array<{ original_amount: number | null; actual_amount: number | null; percent_complete: number | null }>): number {
  if (items.length === 0) return 100
  const budget = items.reduce((s, b) => s + (b.original_amount || 0), 0)
  const spent = items.reduce((s, b) => s + (b.actual_amount || 0), 0)
  const avgComplete = items.reduce((s, b) => s + (b.percent_complete || 0), 0) / items.length / 100
  if (budget === 0) return 100
  const cpi = avgComplete > 0 ? (avgComplete * budget) / Math.max(spent, 1) : 1
  return Math.max(0, Math.min(100, Math.round(Math.min(100, cpi * 85 + 15))))
}

export function computeQualityScore(punchItems: Array<{ status: string | null }>, rfis: Array<{ status: string | null; due_date: string | null }>): number {
  let score = 100
  if (punchItems.length > 0) {
    const closed = punchItems.filter(p => p.status === 'resolved' || p.status === 'verified').length
    score = (closed / punchItems.length) * 60 + 40
  }
  const overdue = rfis.filter(r => (r.status === 'open' || r.status === 'under_review') && r.due_date && new Date(r.due_date) < new Date()).length
  score -= overdue * 3
  return Math.max(0, Math.min(100, Math.round(score)))
}

export function computeSafetyScore(logs: Array<{ incidents: number | null; total_hours: number | null }>): number {
  const totalIncidents = logs.reduce((s, l) => s + (l.incidents || 0), 0)
  const totalHours = logs.reduce((s, l) => s + (l.total_hours || 0), 0)
  if (totalHours === 0 || totalIncidents === 0) return 100
  const trir = (totalIncidents * 200000) / totalHours
  return Math.max(50, Math.min(100, Math.round(100 - trir * 10)))
}

export function computeProjectHealth(
  phases: Array<{ percent_complete: number | null; status: string | null; is_critical_path: boolean | null }>,
  budget: Array<{ original_amount: number | null; actual_amount: number | null; percent_complete: number | null }>,
  punch: Array<{ status: string | null }>,
  rfis: Array<{ status: string | null; due_date: string | null }>,
  logs: Array<{ incidents: number | null; total_hours: number | null }>,
  targetCompletion?: string | null,
): ProjectHealthScore {
  const schedule = computeScheduleScore(phases)
  const cost = computeCostScore(budget)
  const quality = computeQualityScore(punch, rfis)
  const safety = computeSafetyScore(logs)
  const team = Math.round(schedule * 0.4 + quality * 0.6)

  const dimensions: HealthDimension[] = [
    { name: 'Schedule', score: schedule, weight: 0.25, trend: schedule >= 80 ? 'improving' : schedule >= 60 ? 'stable' : 'declining', details: `${phases.filter(p => p.status === 'at_risk' || p.status === 'delayed').length} at risk` },
    { name: 'Budget', score: cost, weight: 0.25, trend: cost >= 80 ? 'improving' : cost >= 60 ? 'stable' : 'declining', details: `CPI: ${(cost / 85).toFixed(2)}` },
    { name: 'Quality', score: quality, weight: 0.20, trend: quality >= 80 ? 'improving' : 'stable', details: `${punch.filter(p => p.status === 'open').length} open punch` },
    { name: 'Safety', score: safety, weight: 0.15, trend: safety >= 90 ? 'improving' : 'stable', details: `${logs.reduce((s, l) => s + (l.incidents || 0), 0)} incidents` },
    { name: 'Team', score: team, weight: 0.15, trend: 'stable', details: 'Completion and response rates' },
  ]

  const overall = Math.round(dimensions.reduce((s, d) => s + d.score * d.weight, 0))

  // Predictive: final cost
  const totalBudget = budget.reduce((s, b) => s + (b.original_amount || 0), 0)
  const totalSpent = budget.reduce((s, b) => s + (b.actual_amount || 0), 0)
  const avgProgress = phases.length > 0 ? phases.reduce((s, p) => s + (p.percent_complete || 0), 0) / phases.length : 0
  const costPerPercent = avgProgress > 0 ? totalSpent / avgProgress : 0
  const predictedCost = costPerPercent > 0 ? costPerPercent * 100 : totalBudget

  return {
    overall,
    dimensions,
    prediction: {
      completionDate: targetCompletion || new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      confidenceLevel: overall >= 80 ? 85 : overall >= 60 ? 65 : 45,
      finalCost: predictedCost || totalBudget,
      costConfidence: cost >= 80 ? 80 : cost >= 60 ? 60 : 40,
      riskLevel: overall >= 80 ? 'low' : overall >= 60 ? 'medium' : overall >= 40 ? 'high' : 'critical',
    },
  }
}
