// Phase 2 — primary data hook for the dense Items view.
//
// Reads the submittals_log_mv (D37) via submittalService.loadSubmittalsLogView.
// The MV is denormalised: sub_name, current_reviewer_name, days_in_court, and
// risk_band are pre-joined so the table doesn't N+1.
//
// Falls back to loadSubmittals() when the MV isn't yet visible to the typed
// client (e.g. before db-types:write regenerates database.ts). The page can
// still render with row-level data; the only thing missing is the
// denormalised reviewer name (em-dash for active reviewers — graceful
// degradation).
//
// Exposes a paint telemetry helper the table calls once the first frame
// settles, keyed by (user_id, project_id, row_count, p50, p95).

import { useCallback, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { submittalService } from '../services/submittalService'
import analytics from '../lib/analytics'
import { useAuthStore } from '../stores/authStore'

export type SubmittalListRow = Record<string, unknown> & {
  id: string
  project_id: string
  number?: string | number | null
  title?: string | null
  status?: string | null
  kind?: string | null
  csi_section?: string | null
  csi_division?: string | null
  rev_number?: number | null
  sub_name?: string | null
  current_reviewer_id?: string | null
  current_reviewer_name?: string | null
  days_in_court?: number | null
  ball_in_court_since?: string | null
  required_on_site_date?: string | null
  submit_by_date?: string | null
  due_date?: string | null
  responsible_sub_id?: string | null
  is_critical_path?: boolean | null
  risk_band?: 'overdue' | 'at_risk' | 'on_track' | 'submit_overdue' | 'unscheduled' | string | null
  iris_preflight_findings?: unknown
}

export interface UseSubmittalsListResult {
  rows: SubmittalListRow[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<unknown>
  /** True when the MV-backed read hit; false when we fell back to the base table. */
  fromLogView: boolean
}

export function useSubmittalsList(projectId: string | null | undefined): UseSubmittalsListResult {
  const query = useQuery<{ rows: SubmittalListRow[]; fromLogView: boolean }>({
    queryKey: ['submittals_log_mv', projectId ?? ''],
    enabled: !!projectId,
    staleTime: 30_000,
    queryFn: async () => {
      if (!projectId) return { rows: [], fromLogView: false }

      // Preferred: D37 materialised view (denormalised + risk_band).
      const mvResult = await submittalService.loadSubmittalsLogView(projectId)
      if (!mvResult.error && mvResult.data) {
        return { rows: mvResult.data as SubmittalListRow[], fromLogView: true }
      }

      // Fallback: base table.
      const baseResult = await submittalService.loadSubmittals(projectId)
      if (baseResult.error) {
        throw new Error(baseResult.error.message)
      }
      return { rows: (baseResult.data ?? []) as unknown as SubmittalListRow[], fromLogView: false }
    },
  })

  return {
    rows: query.data?.rows ?? [],
    loading: query.isPending,
    error: (query.error as Error) ?? null,
    refetch: query.refetch,
    fromLogView: query.data?.fromLogView ?? false,
  }
}

// ── Paint-perf telemetry ────────────────────────────────────────────────────

export interface PaintSample {
  paintMs: number
}

/**
 * Records paint timings per-render and emits a single posthog event keyed by
 * (user_id, project_id, row_count, p50, p95) once we've collected enough
 * samples (default 5).
 */
export function useItemsViewPaintTelemetry(opts: {
  projectId: string | null | undefined
  rowCount: number
  minSamples?: number
}): (sample: PaintSample) => void {
  const { projectId, rowCount, minSamples = 5 } = opts
  const userId = useAuthStore((s) => s.user?.id ?? null)
  const samplesRef = useRef<number[]>([])
  const emittedRef = useRef(false)

  useEffect(() => {
    samplesRef.current = []
    emittedRef.current = false
  }, [projectId, rowCount])

  return useCallback((sample: PaintSample) => {
    if (emittedRef.current) return
    samplesRef.current.push(sample.paintMs)
    if (samplesRef.current.length < minSamples) return

    const sorted = [...samplesRef.current].sort((a, b) => a - b)
    const pIdx = (p: number) => Math.min(sorted.length - 1, Math.floor(sorted.length * p))
    const p50 = sorted[pIdx(0.5)]
    const p95 = sorted[pIdx(0.95)]

    analytics.capture('submittals.items_view_paint_perf', {
      user_id: userId,
      project_id: projectId,
      row_count: rowCount,
      p50_ms: Math.round(p50),
      p95_ms: Math.round(p95),
      sample_count: sorted.length,
    })

    emittedRef.current = true
  }, [minSamples, projectId, rowCount, userId])
}
