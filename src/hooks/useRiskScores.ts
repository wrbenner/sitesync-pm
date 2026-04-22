import { useQuery } from '@tanstack/react-query'
import { fromTable } from '../lib/supabase'
import {
  computeRFIRisk, computeBudgetRisk, computeScheduleRisk, computeSafetyRisk,
  overallProjectRisk,
  type ScoredEntity, type RiskScore,
} from '../lib/riskEngine'

interface RiskBundle {
  rfi: ScoredEntity[]
  budget: ScoredEntity[]
  schedule: ScoredEntity[]
  safety: RiskScore
  overallScore: number
  categoryAverages: { rfi: number; budget: number; schedule: number; safety: number }
  topRisks: ScoredEntity[]
}

function avg(xs: number[]): number {
  if (!xs.length) return 0
  return Math.round(xs.reduce((a, b) => a + b, 0) / xs.length)
}

export function useRiskScores(projectId: string | null | undefined) {
  return useQuery<RiskBundle>({
    queryKey: ['risk-scores', projectId],
    enabled: !!projectId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const safeRun = async <T,>(fn: () => Promise<{ data: unknown; error: unknown }>): Promise<T[]> => {
        try {
          const res = await fn()
          if (res.error) {
            if (import.meta.env.DEV) console.warn('[useRiskScores] query error:', res.error)
            return []
          }
          return Array.isArray(res.data) ? (res.data as T[]) : []
        } catch (err) {
          if (import.meta.env.DEV) console.warn('[useRiskScores] query threw:', err)
          return []
        }
      }

      const [rfis, budgets, activities, incidents, inspections] = await Promise.all([
        safeRun<{ id: string; title: string | null; created_at: string; status: string | null; priority: string | null }>(() =>
          fromTable('rfis').select('id,title,created_at,status,priority').eq('project_id', projectId!).limit(200)),
        safeRun<{ id: string; code: string | null; description: string | null; budget: number; actual: number; committed: number }>(() =>
          fromTable('budget_items').select('id,cost_code,description,original_amount,actual_amount,committed_amount').eq('project_id', projectId!).limit(200)),
        safeRun<{ id: string; name: string; percent_complete: number; planned_start: string | null; planned_finish: string | null }>(() =>
          fromTable('schedule_activities').select('id,name,percent_complete,planned_start,planned_finish').eq('project_id', projectId!).limit(200)),
        safeRun<{ incident_date: string }>(() =>
          fromTable('safety_incidents').select('id,incident_date').eq('project_id', projectId!).order('incident_date', { ascending: false }).limit(1)),
        safeRun<{ status: string | null; inspection_date: string }>(() =>
          fromTable('safety_inspections').select('id,status,inspection_date').eq('project_id', projectId!).limit(200)),
      ])

      const rfiScored: ScoredEntity[] = rfis
        .filter((r) => r.status !== 'closed' && r.status !== 'approved')
        .map((r) => ({
          entityType: 'rfi',
          entityId: r.id,
          entityName: r.title ?? 'RFI',
          category: 'rfi',
          href: '/rfis',
          risk: computeRFIRisk({
            id: r.id,
            title: r.title,
            created_at: r.created_at,
            status: r.status,
            priority: r.priority,
          }),
        }))

      const budgetScored: ScoredEntity[] = budgets
        .filter((b) => (b.budget ?? 0) > 0)
        .map((b) => ({
          entityType: 'budget_line_item',
          entityId: b.id,
          entityName: b.description ?? b.code ?? 'Line Item',
          category: 'budget',
          href: '/budget',
          risk: computeBudgetRisk({
            code: b.code ?? undefined,
            description: b.description,
            budget: Number(b.budget) || 0,
            actual: Number(b.actual) || 0,
            committed: Number(b.committed) || 0,
          }),
        }))

      const now = Date.now()
      const scheduleScored: ScoredEntity[] = activities.map((a) => {
        const start = a.planned_start ? new Date(a.planned_start).getTime() : now
        const finish = a.planned_finish ? new Date(a.planned_finish).getTime() : now
        const total = Math.max(1, finish - start)
        const elapsed = Math.max(0, Math.min(total, now - start))
        const expected = (elapsed / total) * 100
        return {
          entityType: 'schedule_activity',
          entityId: a.id,
          entityName: a.name,
          category: 'schedule',
          href: '/schedule',
          risk: computeScheduleRisk({
            id: a.id,
            name: a.name,
            percent_complete: Number(a.percent_complete) || 0,
            expected_percent: expected,
          }),
        }
      })

      const lastIncident = incidents[0]
      const daysSinceIncident = lastIncident
        ? Math.max(0, Math.floor((Date.now() - new Date(lastIncident.incident_date).getTime()) / 86400000))
        : 365

      const thirty = Date.now() - 30 * 86400000
      const recent = inspections.filter((i) => new Date(i.inspection_date).getTime() >= thirty)
      const completed = recent.filter((i) => i.status === 'completed' || i.status === 'passed').length

      const safety = computeSafetyRisk({
        days_since_last_incident: daysSinceIncident,
        inspections_required_30d: Math.max(8, recent.length),
        inspections_completed_30d: completed,
        open_corrective_actions: 0,
        certs_expiring_30d: 0,
      })

      const categoryAverages = {
        rfi: avg(rfiScored.map((r) => r.risk.score)),
        budget: avg(budgetScored.map((b) => b.risk.score)),
        schedule: avg(scheduleScored.map((s) => s.risk.score)),
        safety: safety.score,
      }

      const overall = overallProjectRisk(categoryAverages)

      const allScored = [...rfiScored, ...budgetScored, ...scheduleScored]
      const topRisks = allScored.sort((a, b) => b.risk.score - a.risk.score).slice(0, 10)

      return {
        rfi: rfiScored,
        budget: budgetScored,
        schedule: scheduleScored,
        safety,
        overallScore: overall,
        categoryAverages,
        topRisks,
      }
    },
  })
}
