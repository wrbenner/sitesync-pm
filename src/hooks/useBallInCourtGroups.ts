// Phase 4 — derives Ball-in-Court groups + per-reviewer aggregates from
// submittals_log_mv rows. Three special buckets:
//   * "Unassigned"  — status='draft' or null current_reviewer_id
//   * Real reviewer groups — keyed by current_reviewer_id
//   * "Closed"      — status in ('closed', 'void')

import { useMemo } from 'react'
import type { SubmittalListRow } from './useSubmittalsList'

export interface ReviewerStats {
  reviewerId: string | null
  reviewerName: string
  reviewerRole: string | null
  totalCount: number
  overdueCount: number
  oldestSubmittal: SubmittalListRow | null
  avgDaysInCourt: number
  rows: SubmittalListRow[]
}

export interface BallInCourtBuckets {
  unassigned: ReviewerStats
  reviewers: ReviewerStats[]
  closed: ReviewerStats
}

const isOverdueDate = (date: string | null | undefined): boolean => {
  if (!date) return false
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return d < today
}

export function useBallInCourtGroups(rows: SubmittalListRow[]): BallInCourtBuckets {
  return useMemo(() => {
    const unassigned: SubmittalListRow[] = []
    const closed: SubmittalListRow[] = []
    const byReviewer = new Map<string, SubmittalListRow[]>()

    for (const row of rows) {
      const status = String(row.status ?? '').toLowerCase()
      if (status === 'closed' || status === 'void') {
        closed.push(row)
        continue
      }
      const reviewerId = (row.current_reviewer_id as string | null | undefined) ?? null
      if (!reviewerId || status === 'draft') {
        unassigned.push(row)
        continue
      }
      const list = byReviewer.get(reviewerId)
      if (list) list.push(row)
      else byReviewer.set(reviewerId, [row])
    }

    const buildStats = (
      reviewerId: string | null,
      bucket: SubmittalListRow[],
      fallbackName: string,
    ): ReviewerStats => {
      const overdueCount = bucket.filter((r) => {
        return isOverdueDate(r.required_on_site_date as string | null) && String(r.status ?? '') !== 'closed'
      }).length

      // oldest = max days_in_court (or oldest ball_in_court_since)
      const oldest = [...bucket].sort((a, b) => {
        const da = (a.days_in_court as number | null) ?? -1
        const db = (b.days_in_court as number | null) ?? -1
        return db - da
      })[0] ?? null

      const days = bucket.map((r) => (r.days_in_court as number | null) ?? 0)
      const avg = days.length > 0
        ? days.reduce((sum, n) => sum + n, 0) / days.length
        : 0

      // Best display name: use the row's current_reviewer_name (denormalized on
      // the MV); fall back to fallbackName when no rows.
      const firstWithName = bucket.find((r) => (r.current_reviewer_name as string | null) ?? null)
      const reviewerName = (firstWithName?.current_reviewer_name as string | null) ?? fallbackName

      const reviewerRole = (bucket[0]?.current_reviewer_role as string | null | undefined) ?? null

      return {
        reviewerId,
        reviewerName,
        reviewerRole,
        totalCount: bucket.length,
        overdueCount,
        oldestSubmittal: oldest,
        avgDaysInCourt: avg,
        rows: bucket,
      }
    }

    const reviewers: ReviewerStats[] = Array.from(byReviewer.entries())
      .map(([id, bucket]) => buildStats(id, bucket, 'Unknown reviewer'))
      .sort((a, b) => b.avgDaysInCourt - a.avgDaysInCourt)

    return {
      unassigned: buildStats(null, unassigned, 'Unassigned'),
      reviewers,
      closed: buildStats(null, closed, 'Closed'),
    }
  }, [rows])
}
