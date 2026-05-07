// Phase 4 — Ball-in-Court view.
//
// Groups submittals by current_reviewer_id with two special buckets:
//   * "Unassigned" pinned at top (status='draft' or no current_reviewer_id)
//   * "Closed" pinned at bottom (status in ('closed', 'void')), default-collapsed
//
// Click reviewer name → opens ReviewerSidePanel with their full plate.

import React, { useMemo, useState } from 'react'
import { useSubmittalsList, type SubmittalListRow } from '../../../hooks/useSubmittalsList'
import { useBallInCourtGroups, type ReviewerStats } from '../../../hooks/useBallInCourtGroups'
import { GroupedSubmittalsView, type GroupBucket } from '../GroupedView/GroupedSubmittalsView'
import { ReviewerSidePanel } from './ReviewerSidePanel'

const C = {
  ink2: '#5C5550',
  ink3: '#8C857E',
}

const FONT = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

export interface BallInCourtViewProps {
  projectId: string
  resetToken: string
  numberingFormat: string
  filterFn?: (row: SubmittalListRow) => boolean
  selectionClearToken?: number
  onSelectionIdsChange?: (ids: string[]) => void
}

export const BallInCourtView: React.FC<BallInCourtViewProps> = ({
  projectId,
  resetToken,
  numberingFormat,
  filterFn,
  selectionClearToken,
  onSelectionIdsChange,
}) => {
  const { rows, loading } = useSubmittalsList(projectId)

  const filteredRows = useMemo(() => (filterFn ? rows.filter(filterFn) : rows), [rows, filterFn])
  const buckets = useBallInCourtGroups(filteredRows)

  const [activeReviewer, setActiveReviewer] = useState<ReviewerStats | null>(null)

  const groups = useMemo<GroupBucket[]>(() => {
    const out: GroupBucket[] = []

    if (buckets.unassigned.totalCount > 0) {
      out.push({
        id: '__unassigned__',
        label: `Unassigned (${buckets.unassigned.totalCount})`,
        subtitle: 'Drafts and submittals without a current reviewer.',
        rows: buckets.unassigned.rows,
      })
    }

    for (const r of buckets.reviewers) {
      const subtitle = `${r.totalCount} item${r.totalCount === 1 ? '' : 's'}`
        + (r.overdueCount > 0 ? ` · ${r.overdueCount} overdue` : '')
        + (r.avgDaysInCourt > 0 ? ` · avg ${r.avgDaysInCourt.toFixed(1)} days in court` : '')
      out.push({
        id: r.reviewerId ?? `reviewer-${r.reviewerName}`,
        label: r.reviewerRole ? `${r.reviewerName} (${r.reviewerRole})` : r.reviewerName,
        subtitle,
        rows: r.rows,
        onLabelClick: () => setActiveReviewer(r),
      })
    }

    if (buckets.closed.totalCount > 0) {
      out.push({
        id: '__closed__',
        label: `Closed (${buckets.closed.totalCount})`,
        subtitle: 'Approved + voided submittals.',
        rows: buckets.closed.rows,
        defaultCollapsed: true,
      })
    }

    return out
  }, [buckets])

  const emptyState = (
    <div style={{ textAlign: 'center', maxWidth: 460, fontFamily: FONT }}>
      <h3 style={{ margin: 0, fontSize: 14, color: C.ink2, fontWeight: 600 }}>
        All submittals are closed
      </h3>
      <p style={{ margin: '6px 0 0', fontSize: 13, color: C.ink3, lineHeight: 1.5 }}>
        Reopen one to see ball-in-court tracking.
      </p>
    </div>
  )

  return (
    <>
      <GroupedSubmittalsView
        projectId={projectId}
        viewType="ball_in_court"
        resetToken={resetToken}
        numberingFormat={numberingFormat}
        groups={groups}
        selectionClearToken={selectionClearToken}
        onSelectionIdsChange={onSelectionIdsChange}
        emptyState={emptyState}
        loading={loading}
      />
      <ReviewerSidePanel
        open={activeReviewer != null}
        reviewer={activeReviewer}
        onClose={() => setActiveReviewer(null)}
      />
    </>
  )
}

export default BallInCourtView
