/**
 * useFieldSuperPMF — surface the metric that decides whether the
 * vision is working: median field-super sessions per day over the
 * last 30 days for this project. Target: 8+. See VISION.md.
 *
 * This hook returns enough information to render the dashboard tile:
 *   • metric value (median sessions/day)
 *   • per-user breakdown (top 5)
 *   • a "is this PMF?" boolean computed against the threshold
 *   • last refresh timestamp
 */

import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export interface FieldSuperPMF {
  /** Median field-surface sessions per active user per day, last 30d. */
  medianSessionsPerDay: number
  /** Number of distinct users contributing sessions in window. */
  activeUsers: number
  /** Days the project has been live in the window (capped at 30). */
  windowDays: number
  /** True when medianSessionsPerDay >= 8 — the PMF threshold. */
  hitsPmfThreshold: boolean
  /** Top contributors: user_id + session count over the window. */
  topUsers: Array<{ user_id: string; session_count: number }>
}

const PMF_THRESHOLD = 8

interface SessionRow {
  user_id: string
  started_at: string
  surface: string | null
}

export function useFieldSuperPMF(projectId: string | undefined) {
  return useQuery({
    queryKey: ['field_super_pmf', projectId],
    enabled: !!projectId,
    queryFn: async (): Promise<FieldSuperPMF> => {
      const since = new Date()
      since.setDate(since.getDate() - 30)

      const { data, error } = await supabase
        .from('field_session_events')
        .select('user_id, started_at, surface')
        .eq('project_id', projectId!)
        .gte('started_at', since.toISOString())
        .order('started_at', { ascending: false })

      if (error) {
        // Migration may not have run in dev — return zeros gracefully.
        if (error.message?.includes('field_session_events')) {
          return zeroPmf(0)
        }
        throw error
      }

      const rows = (data ?? []) as SessionRow[]
      const fieldRows = rows.filter((r) => r.surface === 'field')

      // Sessions-per-(user, day) counter
      const perUserDay = new Map<string, Map<string, number>>()
      for (const r of fieldRows) {
        const day = r.started_at.slice(0, 10)
        if (!perUserDay.has(r.user_id)) perUserDay.set(r.user_id, new Map())
        const dayMap = perUserDay.get(r.user_id)!
        dayMap.set(day, (dayMap.get(day) ?? 0) + 1)
      }

      // Per-user totals
      const perUserTotal = Array.from(perUserDay.entries())
        .map(([user_id, dayMap]) => ({
          user_id,
          session_count: Array.from(dayMap.values()).reduce((a, b) => a + b, 0),
        }))
        .sort((a, b) => b.session_count - a.session_count)

      // Median sessions per active day across all users
      const allDailyCounts: number[] = []
      for (const dayMap of perUserDay.values()) {
        for (const c of dayMap.values()) allDailyCounts.push(c)
      }
      allDailyCounts.sort((a, b) => a - b)
      const median =
        allDailyCounts.length === 0
          ? 0
          : allDailyCounts.length % 2 === 1
            ? allDailyCounts[(allDailyCounts.length - 1) >> 1]
            : (allDailyCounts[allDailyCounts.length / 2 - 1] + allDailyCounts[allDailyCounts.length / 2]) / 2

      const distinctDays = new Set<string>()
      for (const dayMap of perUserDay.values()) {
        for (const day of dayMap.keys()) distinctDays.add(day)
      }

      return {
        medianSessionsPerDay: Math.round(median * 10) / 10,
        activeUsers: perUserDay.size,
        windowDays: Math.min(30, distinctDays.size),
        hitsPmfThreshold: median >= PMF_THRESHOLD,
        topUsers: perUserTotal.slice(0, 5),
      }
    },
    staleTime: 60_000,
  })
}

function zeroPmf(activeUsers: number): FieldSuperPMF {
  return {
    medianSessionsPerDay: 0,
    activeUsers,
    windowDays: 0,
    hitsPmfThreshold: false,
    topUsers: [],
  }
}
