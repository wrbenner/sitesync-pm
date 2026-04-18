// Phase 4, Module 8: AI Cost Tracking hook.
// Queries the ai_cost_tracking ledger and derives the aggregates the cost
// dashboard displays: daily spend by service, per project totals, ROI.

import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// ── Types ────────────────────────────────────────────────

export interface AICostRow {
  id: string
  project_id: string | null
  user_id: string | null
  service: string
  operation: string | null
  input_tokens: number
  output_tokens: number
  total_cost_cents: number
  model: string | null
  created_at: string
}

export interface DailyServiceCost {
  date: string
  service: string
  cost_cents: number
  calls: number
}

export interface ProjectCost {
  project_id: string | null
  cost_cents: number
  calls: number
}

export interface ServiceCost {
  service: string
  cost_cents: number
  calls: number
  avg_latency_ms?: number
}

export interface AICostSummary {
  totalCents: number
  totalCalls: number
  byService: ServiceCost[]
  byProject: ProjectCost[]
  daily: DailyServiceCost[]
  estimatedHoursSaved: number
  hourlyRateCents: number
  roiMultiple: number
}

// ── Constants ────────────────────────────────────────────

// Coarse ROI assumption: each AI classification saves ~0.25 hours of engineer time.
// Each discrepancy analysis call saves ~0.5 hours. Copilot calls save ~0.1 hours.
// Assumed loaded engineer rate: $120/hour = 12000 cents/hour.
const ENGINEER_RATE_CENTS_PER_HOUR = 12000

const HOURS_SAVED_PER_CALL: Record<string, number> = {
  classification: 0.25,
  edge_detection: 0.25,
  discrepancy_analysis: 0.5,
  copilot: 0.1,
  revision_diff: 0.15,
  field_photo_comparison: 0.2,
}

// ── Aggregation ──────────────────────────────────────────

function aggregate(rows: AICostRow[]): AICostSummary {
  let totalCents = 0
  let totalCalls = 0
  let estimatedHoursSaved = 0

  const byServiceMap = new Map<string, { cost_cents: number; calls: number }>()
  const byProjectMap = new Map<string | null, { cost_cents: number; calls: number }>()
  const dailyMap = new Map<string, { cost_cents: number; calls: number }>()

  for (const row of rows) {
    totalCents += row.total_cost_cents
    totalCalls += 1
    estimatedHoursSaved += HOURS_SAVED_PER_CALL[row.service] ?? 0.1

    const svc = byServiceMap.get(row.service) ?? { cost_cents: 0, calls: 0 }
    svc.cost_cents += row.total_cost_cents
    svc.calls += 1
    byServiceMap.set(row.service, svc)

    const proj = byProjectMap.get(row.project_id) ?? { cost_cents: 0, calls: 0 }
    proj.cost_cents += row.total_cost_cents
    proj.calls += 1
    byProjectMap.set(row.project_id, proj)

    const dateKey = row.created_at.slice(0, 10)
    const compositeKey = `${dateKey}::${row.service}`
    const daily = dailyMap.get(compositeKey) ?? { cost_cents: 0, calls: 0 }
    daily.cost_cents += row.total_cost_cents
    daily.calls += 1
    dailyMap.set(compositeKey, daily)
  }

  const byService: ServiceCost[] = Array.from(byServiceMap.entries())
    .map(([service, v]) => ({ service, cost_cents: v.cost_cents, calls: v.calls }))
    .sort((a, b) => b.cost_cents - a.cost_cents)

  const byProject: ProjectCost[] = Array.from(byProjectMap.entries())
    .map(([project_id, v]) => ({ project_id, cost_cents: v.cost_cents, calls: v.calls }))
    .sort((a, b) => b.cost_cents - a.cost_cents)

  const daily: DailyServiceCost[] = Array.from(dailyMap.entries())
    .map(([key, v]) => {
      const [date, service] = key.split('::')
      return { date, service, cost_cents: v.cost_cents, calls: v.calls }
    })
    .sort((a, b) => a.date.localeCompare(b.date))

  const estimatedValueCents = Math.round(estimatedHoursSaved * ENGINEER_RATE_CENTS_PER_HOUR)
  const roiMultiple = totalCents > 0 ? estimatedValueCents / totalCents : 0

  return {
    totalCents,
    totalCalls,
    byService,
    byProject,
    daily,
    estimatedHoursSaved,
    hourlyRateCents: ENGINEER_RATE_CENTS_PER_HOUR,
    roiMultiple,
  }
}

// ── Hook ─────────────────────────────────────────────────

export interface AICostFilters {
  projectId?: string | null
  sinceDays?: number
}

export function useAICostTracking(filters: AICostFilters = {}) {
  const { projectId, sinceDays = 30 } = filters

  return useQuery<AICostSummary>({
    queryKey: ['ai-cost-tracking', projectId ?? null, sinceDays],
    queryFn: async () => {
      const sinceIso = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString()

      let query = supabase
        .from('ai_cost_tracking')
        .select('id, project_id, user_id, service, operation, input_tokens, output_tokens, total_cost_cents, model, created_at')
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(5000)

      if (projectId) query = query.eq('project_id', projectId)

      const { data, error } = await query
      if (error) throw error

      const rows = (data ?? []) as AICostRow[]
      return aggregate(rows)
    },
    staleTime: 60 * 1000,
  })
}
