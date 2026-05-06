import { useQuery } from '@tanstack/react-query'
import { isSupabaseConfigured } from '../../lib/supabase'
import { fromTable } from '../../lib/db/queries'

export interface LaborForecastRow {
  id: string
  project_id: string
  week_start: string
  trade: string | null
  headcount_needed: number | null
  hours_needed: number | null
  source: 'manual' | 'ai_predicted' | null
  confidence: number | null
  created_at: string
}

export function useLaborForecasts(
  projectId: string | undefined,
  opts?: { from?: string; to?: string },
) {
  return useQuery({
    queryKey: ['labor_forecasts', projectId, opts?.from ?? null, opts?.to ?? null],
    queryFn: async (): Promise<LaborForecastRow[]> => {
      if (!projectId || !isSupabaseConfigured) return []
      let q = fromTable('labor_forecasts')
        .select('*')
        .eq('project_id' as never, projectId)
        .order('week_start', { ascending: true })
      if (opts?.from) q = q.gte('week_start' as never, opts.from)
      if (opts?.to) q = q.lte('week_start' as never, opts.to)
      const { data, error } = await q
      if (error) throw error
      return (data ?? []).map((r: Record<string, unknown>) => ({
        id: r.id as string,
        project_id: r.project_id as string,
        week_start: r.week_start as string,
        trade: (r.trade as string | null) ?? null,
        headcount_needed: r.headcount_needed != null ? Number(r.headcount_needed) : null,
        hours_needed: r.hours_needed != null ? Number(r.hours_needed) : null,
        source: (r.source as 'manual' | 'ai_predicted' | null) ?? null,
        confidence: r.confidence != null ? Number(r.confidence) : null,
        created_at: r.created_at as string,
      }))
    },
    enabled: !!projectId && isSupabaseConfigured,
  })
}
