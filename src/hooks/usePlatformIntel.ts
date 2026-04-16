// ── usePlatformIntel ──────────────────────────────────────────
// Queries for cross-project intelligence: benchmarks,
// subcontractor reputation, material pricing, risk predictions.
// All data is anonymized and aggregated. Individual project
// data is NEVER shared across organizations.

import { useQuery } from '@tanstack/react-query'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useProjectId } from './useProjectId'
import type {
  BenchmarkData,
  BenchmarkComparison,
  BenchmarkMetric,
  SubcontractorProfile,
  MaterialPriceTrend,
  MaterialCategory,
  ProjectType,
  RiskPrediction,
} from '../types/platformIntel'

// ── Benchmark Queries ─────────────────────────────────────────

export function useBenchmarks(
  projectType?: ProjectType,
  region?: string,
  period?: string,
) {
  return useQuery({
    queryKey: ['benchmarks', projectType, region, period],
    queryFn: async (): Promise<BenchmarkData[]> => {
      if (!isSupabaseConfigured) return []
      let query = supabase
        .from('benchmarks')
        .select('*')
        .order('calculated_at', { ascending: false })

      if (projectType) query = query.eq('project_type', projectType)
      if (region) query = query.eq('region', region)
      if (period) query = query.eq('period', period)

      const { data, error } = await query.limit(100)
      if (error) throw error

      return (data ?? []).map((row) => ({
        id: row.id,
        metricType: row.metric_type as BenchmarkMetric,
        projectType: row.project_type as ProjectType,
        region: row.region ?? '',
        value: row.value ?? 0,
        p25: row.p25 ?? 0,
        p50: row.p50 ?? 0,
        p75: row.p75 ?? 0,
        p90: row.p90 ?? 0,
        sampleSize: row.sample_size ?? 0,
        period: row.period ?? '',
        calculatedAt: row.calculated_at ?? '',
      }))
    },
    enabled: isSupabaseConfigured,
    staleTime: 5 * 60_000, // 5 minute cache (benchmark data changes slowly)
  })
}

// Compare your project metrics against benchmarks
export function useBenchmarkComparisons(projectType?: ProjectType, region?: string) {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['benchmark-comparisons', projectId, projectType, region],
    queryFn: async (): Promise<BenchmarkComparison[]> => {
      if (!projectId || !isSupabaseConfigured) return []

      // Fetch benchmark data
      let bmQuery = supabase
        .from('benchmarks')
        .select('*')
        .order('calculated_at', { ascending: false })
      if (projectType) bmQuery = bmQuery.eq('project_type', projectType)
      if (region) bmQuery = bmQuery.eq('region', region)
      const { data: benchmarks } = await bmQuery.limit(50)

      // Fetch your project's metrics
      const [rfiResult, taskResult, budgetResult] = await Promise.all([
        supabase.from('rfis').select('created_at, answered_at, status').eq('project_id', projectId),
        supabase.from('tasks').select('planned_end, actual_end, status, percent_complete').eq('project_id', projectId),
        supabase.from('budget_items').select('original_amount, actual_amount').eq('project_id', projectId),
      ])

      const rfis = rfiResult.data ?? []

      const budget = budgetResult.data ?? []

      // Calculate your RFI turnaround
      const answeredRfis = rfis.filter((r) => r.answered_at && r.created_at)
      const avgRfiDays = answeredRfis.length > 0
        ? answeredRfis.reduce((sum, r) => {
            const days = (new Date(r.answered_at!).getTime() - new Date(r.created_at!).getTime()) / (1000 * 60 * 60 * 24)
            return sum + days
          }, 0) / answeredRfis.length
        : 0

      // Calculate change order rate
      const totalBudget = budget.reduce((s, b) => s + (b.original_amount || 0), 0)
      const actualSpend = budget.reduce((s, b) => s + (b.actual_amount || 0), 0)
      const coRate = totalBudget > 0 ? ((actualSpend - totalBudget) / totalBudget) * 100 : 0

      // Build comparisons
      const comparisons: BenchmarkComparison[] = []
      const benchmarkMap = new Map<string, BenchmarkData>()
      for (const bm of (benchmarks ?? [])) {
        const key = bm.metric_type as string
        if (!benchmarkMap.has(key)) {
          benchmarkMap.set(key, {
            id: bm.id,
            metricType: bm.metric_type as BenchmarkMetric,
            projectType: bm.project_type as ProjectType,
            region: bm.region ?? '',
            value: bm.value ?? 0,
            p25: bm.p25 ?? 0,
            p50: bm.p50 ?? 0,
            p75: bm.p75 ?? 0,
            p90: bm.p90 ?? 0,
            sampleSize: bm.sample_size ?? 0,
            period: bm.period ?? '',
            calculatedAt: bm.calculated_at ?? '',
          })
        }
      }

      // RFI turnaround comparison
      const rfisBm = benchmarkMap.get('rfi_turnaround_days')
      if (rfisBm && avgRfiDays > 0) {
        const percentile = calculatePercentile(avgRfiDays, rfisBm.p25, rfisBm.p50, rfisBm.p75, rfisBm.p90, true)
        comparisons.push({
          metric: 'rfi_turnaround_days',
          yourValue: Math.round(avgRfiDays * 10) / 10,
          benchmarkMedian: rfisBm.p50,
          benchmarkP25: rfisBm.p25,
          benchmarkP75: rfisBm.p75,
          percentile,
          trend: avgRfiDays < rfisBm.p50 ? 'better' : avgRfiDays > rfisBm.p75 ? 'worse' : 'same',
          sampleSize: rfisBm.sampleSize,
        })
      }

      // Change order rate comparison
      const coBm = benchmarkMap.get('change_order_rate')
      if (coBm) {
        const percentile = calculatePercentile(Math.abs(coRate), coBm.p25, coBm.p50, coBm.p75, coBm.p90, true)
        comparisons.push({
          metric: 'change_order_rate',
          yourValue: Math.round(Math.abs(coRate) * 10) / 10,
          benchmarkMedian: coBm.p50,
          benchmarkP25: coBm.p25,
          benchmarkP75: coBm.p75,
          percentile,
          trend: Math.abs(coRate) < coBm.p50 ? 'better' : Math.abs(coRate) > coBm.p75 ? 'worse' : 'same',
          sampleSize: coBm.sampleSize,
        })
      }

      return comparisons
    },
    enabled: !!projectId && isSupabaseConfigured,
    staleTime: 10 * 60_000,
  })
}

// ── Subcontractor Reputation ──────────────────────────────────

export function useSubcontractorProfiles(trade?: string, region?: string) {
  return useQuery({
    queryKey: ['sub-profiles', trade, region],
    queryFn: async (): Promise<SubcontractorProfile[]> => {
      if (!isSupabaseConfigured) return []

      const query = supabase
        .from('subcontractor_ratings')
        .select('company_id, metrics, period')
        .order('created_at', { ascending: false })

      const { data: ratings, error } = await query.limit(500)
      if (error) throw error

      // Aggregate ratings by company
      const companyMap = new Map<string, {
        ratings: Array<Record<string, unknown>>
        metrics: Array<Record<string, number>>
      }>()

      for (const rating of ratings ?? []) {
        const cid = rating.company_id as string
        if (!companyMap.has(cid)) {
          companyMap.set(cid, { ratings: [], metrics: [] })
        }
        companyMap.get(cid)!.ratings.push(rating as Record<string, unknown>)
        if (rating.metrics) {
          companyMap.get(cid)!.metrics.push(rating.metrics as Record<string, number>)
        }
      }

      // Fetch company details
      const companyIds = Array.from(companyMap.keys())
      if (companyIds.length === 0) return []

      const { data: companies } = await supabase
        .from('directory_contacts')
        .select('id, company, trade')
        .in('id', companyIds)
        .limit(100)

      const profiles: SubcontractorProfile[] = []
      for (const [companyId, data] of companyMap) {
        const company = (companies ?? []).find((c) => c.id === companyId)
        if (!company) continue

        const avgMetrics = averageMetrics(data.metrics)

        profiles.push({
          companyId,
          companyName: company.company ?? 'Unknown',
          trade: company.trade ?? 'General',
          region: '',
          overallScore: Math.round(
            (avgMetrics.on_time * 20 + avgMetrics.quality * 20 + avgMetrics.safety * 20 +
              avgMetrics.communication * 20 + avgMetrics.rework_inverse * 20),
          ),
          onTimeRate: avgMetrics.on_time / 100,
          rfiResponseDays: avgMetrics.rfi_response || 0,
          reworkRate: (100 - avgMetrics.rework_inverse) / 100,
          safetyScore: avgMetrics.safety,
          paymentHistory: avgMetrics.on_time >= 90 ? 'excellent' : avgMetrics.on_time >= 75 ? 'good' : avgMetrics.on_time >= 60 ? 'fair' : 'poor',
          projectCount: data.ratings.length,
          ratingCount: data.metrics.length,
          activeProjects: 0,
          scoreTrend: 'stable',
          verified: data.ratings.length >= 3,
          featured: avgMetrics.on_time >= 90 && avgMetrics.safety >= 90,
          certifications: [],
        })
      }

      return profiles.sort((a, b) => b.overallScore - a.overallScore)
    },
    enabled: isSupabaseConfigured,
    staleTime: 10 * 60_000,
  })
}

// ── Material Price Trends ─────────────────────────────────────

export function useMaterialPriceTrends(region?: string) {
  return useQuery({
    queryKey: ['material-prices', region],
    queryFn: async (): Promise<MaterialPriceTrend[]> => {
      if (!isSupabaseConfigured) return []

      let query = supabase
        .from('material_prices')
        .select('material_type, unit, price, region, recorded_at')
        .order('recorded_at', { ascending: true })

      if (region) query = query.eq('region', region)
      const { data, error } = await query.limit(1000)
      if (error) throw error

      // Group by material type
      const grouped = new Map<string, Array<{ date: string; price: number }>>()
      for (const row of data ?? []) {
        const key = row.material_type as string
        if (!grouped.has(key)) grouped.set(key, [])
        grouped.get(key)!.push({
          date: row.recorded_at ?? '',
          price: row.price ?? 0,
        })
      }

      const trends: MaterialPriceTrend[] = []
      for (const [materialType, history] of grouped) {
        if (history.length < 2) continue
        const current = history[history.length - 1].price
        const previous = history[history.length - 2].price
        const change = current - previous
        const changePct = previous > 0 ? (change / previous) * 100 : 0

        trends.push({
          materialType: materialType as MaterialCategory,
          region: region || '',
          current,
          previous,
          change,
          changePct: Math.round(changePct * 10) / 10,
          direction: changePct > 1 ? 'up' : changePct < -1 ? 'down' : 'stable',
          history,
        })
      }

      return trends
    },
    enabled: isSupabaseConfigured,
    staleTime: 30 * 60_000, // Material prices change slowly
  })
}

// ── Risk Predictions ──────────────────────────────────────────

export function useRiskPredictions() {
  const projectId = useProjectId()

  return useQuery({
    queryKey: ['risk-predictions', projectId],
    queryFn: async (): Promise<RiskPrediction[]> => {
      if (!projectId || !isSupabaseConfigured) return []

      const { data, error } = await supabase
        .from('risk_predictions')
        .select('*')
        .eq('project_id', projectId)
        .order('probability', { ascending: false })
        .limit(20)

      if (error) throw error
      return (data ?? []).map((r) => ({
        id: r.id,
        projectId: r.project_id,
        riskType: r.risk_type,
        probability: r.probability,
        impact: r.impact,
        description: r.description,
        factors: r.factors ?? [],
        recommendation: r.recommendation ?? '',
        predictedAt: r.predicted_at ?? r.created_at ?? '',
      }))
    },
    enabled: !!projectId && isSupabaseConfigured,
    staleTime: 5 * 60_000,
  })
}

// ── Helpers ───────────────────────────────────────────────────

function calculatePercentile(
  value: number,
  p25: number,
  p50: number,
  p75: number,
  p90: number,
  lowerIsBetter: boolean,
): number {
  // Map value to percentile based on distribution
  let percentile: number
  if (value <= p25) percentile = 25 * (value / p25)
  else if (value <= p50) percentile = 25 + 25 * ((value - p25) / (p50 - p25))
  else if (value <= p75) percentile = 50 + 25 * ((value - p50) / (p75 - p50))
  else if (value <= p90) percentile = 75 + 15 * ((value - p75) / (p90 - p75))
  else percentile = 90 + 10 * Math.min(1, (value - p90) / p90)

  return lowerIsBetter ? 100 - Math.round(percentile) : Math.round(percentile)
}

function averageMetrics(
  metricsArr: Array<Record<string, number>>,
): Record<string, number> {
  if (metricsArr.length === 0) {
    return { on_time: 0, quality: 0, safety: 0, communication: 0, rework_inverse: 0, rfi_response: 0 }
  }

  const sums: Record<string, number> = {}
  const counts: Record<string, number> = {}

  for (const m of metricsArr) {
    for (const [key, val] of Object.entries(m)) {
      if (typeof val !== 'number') continue
      sums[key] = (sums[key] || 0) + val
      counts[key] = (counts[key] || 0) + 1
    }
  }

  const result: Record<string, number> = {}
  for (const key of Object.keys(sums)) {
    result[key] = Math.round((sums[key] / counts[key]) * 10) / 10
  }
  return result
}
