import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Pure business logic used by the Submittals page (replicated here since
// buildFallbackSteps and buildReviewerSteps are internal page functions).
// ---------------------------------------------------------------------------

type StepStatus = 'pending' | 'current' | 'approved' | 'rejected' | 'approved_as_noted'

interface ReviewerStep {
  id: string | number
  role: string
  status: StepStatus
  date?: string
}

type ReviewerRow = {
  id: string
  role: string | null
  status: string | null
  stamp: string | null
  comments: string | null
  approver_id: string | null
}

// ── buildFallbackSteps ─────────────────────────────────────
// Maps a submittal status string to a 3-step review ladder
// (Subcontractor → GC Review → Architect Review).
function buildFallbackSteps(status: string): ReviewerStep[] {
  let s0: StepStatus = 'pending'
  let s1: StepStatus = 'pending'
  let s2: StepStatus = 'pending'

  if (status === 'pending') {
    s0 = 'current'
  } else if (status === 'submitted' || status === 'under_review' || status === 'review_in_progress') {
    s0 = 'approved'; s1 = 'current'
  } else if (status === 'approved') {
    s0 = 'approved'; s1 = 'approved'; s2 = 'approved'
  } else if (status === 'approved_as_noted') {
    s0 = 'approved'; s1 = 'approved'; s2 = 'approved_as_noted'
  } else if (status === 'rejected' || status === 'revise_resubmit') {
    s0 = 'approved'; s1 = 'approved'; s2 = 'rejected'
  } else {
    s0 = 'current'
  }

  return [
    { id: 1, role: 'Subcontractor', status: s0 },
    { id: 2, role: 'GC Review', status: s1 },
    { id: 3, role: 'Architect Review', status: s2 },
  ]
}

// ── buildReviewerSteps ─────────────────────────────────────
// Maps actual reviewer rows from the database to ReviewerStep objects.
function buildReviewerSteps(reviewers: ReviewerRow[]): ReviewerStep[] {
  return reviewers.map((r) => {
    let stepStatus: StepStatus = 'pending'
    if (r.status === 'approved') stepStatus = 'approved'
    else if (r.status === 'approved_as_noted') stepStatus = 'approved_as_noted'
    else if (r.status === 'rejected' || r.status === 'revise_resubmit') stepStatus = 'rejected'
    else if (r.status === 'current' || r.status === 'in_review') stepStatus = 'current'
    return {
      id: r.id,
      role: r.role || 'Reviewer',
      status: stepStatus,
      date: r.stamp ? new Date(r.stamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : undefined,
    }
  })
}

// ── isOverdue ──────────────────────────────────────────────
const isOverdue = (dateStr: string) => new Date(dateStr) < new Date()

// ---------------------------------------------------------------------------
// buildFallbackSteps tests
// ---------------------------------------------------------------------------

describe('buildFallbackSteps', () => {
  it('should always return exactly 3 steps', () => {
    const statuses = ['pending', 'submitted', 'under_review', 'approved', 'approved_as_noted', 'rejected', 'revise_resubmit', 'unknown']
    for (const status of statuses) {
      expect(buildFallbackSteps(status)).toHaveLength(3)
    }
  })

  it('should set Subcontractor as current when status is pending', () => {
    const steps = buildFallbackSteps('pending')
    expect(steps[0].status).toBe('current')
    expect(steps[1].status).toBe('pending')
    expect(steps[2].status).toBe('pending')
  })

  it('should show Subcontractor approved and GC as current when submitted', () => {
    const steps = buildFallbackSteps('submitted')
    expect(steps[0].status).toBe('approved')
    expect(steps[1].status).toBe('current')
    expect(steps[2].status).toBe('pending')
  })

  it('should show Subcontractor approved and GC as current when under_review', () => {
    const steps = buildFallbackSteps('under_review')
    expect(steps[0].status).toBe('approved')
    expect(steps[1].status).toBe('current')
    expect(steps[2].status).toBe('pending')
  })

  it('should show Subcontractor approved and GC as current when review_in_progress', () => {
    const steps = buildFallbackSteps('review_in_progress')
    expect(steps[0].status).toBe('approved')
    expect(steps[1].status).toBe('current')
    expect(steps[2].status).toBe('pending')
  })

  it('should mark all 3 steps approved when fully approved', () => {
    const steps = buildFallbackSteps('approved')
    expect(steps[0].status).toBe('approved')
    expect(steps[1].status).toBe('approved')
    expect(steps[2].status).toBe('approved')
  })

  it('should mark last step approved_as_noted for approved_as_noted status', () => {
    const steps = buildFallbackSteps('approved_as_noted')
    expect(steps[0].status).toBe('approved')
    expect(steps[1].status).toBe('approved')
    expect(steps[2].status).toBe('approved_as_noted')
  })

  it('should mark last step rejected when status is rejected', () => {
    const steps = buildFallbackSteps('rejected')
    expect(steps[0].status).toBe('approved')
    expect(steps[1].status).toBe('approved')
    expect(steps[2].status).toBe('rejected')
  })

  it('should mark last step rejected when status is revise_resubmit', () => {
    const steps = buildFallbackSteps('revise_resubmit')
    expect(steps[0].status).toBe('approved')
    expect(steps[1].status).toBe('approved')
    expect(steps[2].status).toBe('rejected')
  })

  it('should default to Subcontractor as current for unknown status', () => {
    const steps = buildFallbackSteps('some_unknown_status')
    expect(steps[0].status).toBe('current')
  })

  it('should use correct role labels', () => {
    const steps = buildFallbackSteps('pending')
    expect(steps[0].role).toBe('Subcontractor')
    expect(steps[1].role).toBe('GC Review')
    expect(steps[2].role).toBe('Architect Review')
  })
})

// ---------------------------------------------------------------------------
// buildReviewerSteps tests
// ---------------------------------------------------------------------------

describe('buildReviewerSteps', () => {
  it('should return empty array for no reviewers', () => {
    expect(buildReviewerSteps([])).toEqual([])
  })

  it('should map approved status correctly', () => {
    const reviewers: ReviewerRow[] = [
      { id: 'rev-1', role: 'GC', status: 'approved', stamp: null, comments: null, approver_id: null },
    ]
    const steps = buildReviewerSteps(reviewers)
    expect(steps[0].status).toBe('approved')
  })

  it('should map approved_as_noted status correctly', () => {
    const reviewers: ReviewerRow[] = [
      { id: 'rev-1', role: 'Architect', status: 'approved_as_noted', stamp: null, comments: null, approver_id: null },
    ]
    const steps = buildReviewerSteps(reviewers)
    expect(steps[0].status).toBe('approved_as_noted')
  })

  it('should map rejected status to rejected', () => {
    const reviewers: ReviewerRow[] = [
      { id: 'rev-1', role: 'Architect', status: 'rejected', stamp: null, comments: null, approver_id: null },
    ]
    const steps = buildReviewerSteps(reviewers)
    expect(steps[0].status).toBe('rejected')
  })

  it('should map revise_resubmit status to rejected', () => {
    const reviewers: ReviewerRow[] = [
      { id: 'rev-1', role: 'Architect', status: 'revise_resubmit', stamp: null, comments: null, approver_id: null },
    ]
    const steps = buildReviewerSteps(reviewers)
    expect(steps[0].status).toBe('rejected')
  })

  it('should map in_review status to current', () => {
    const reviewers: ReviewerRow[] = [
      { id: 'rev-1', role: 'GC', status: 'in_review', stamp: null, comments: null, approver_id: null },
    ]
    const steps = buildReviewerSteps(reviewers)
    expect(steps[0].status).toBe('current')
  })

  it('should map current status to current', () => {
    const reviewers: ReviewerRow[] = [
      { id: 'rev-1', role: 'GC', status: 'current', stamp: null, comments: null, approver_id: null },
    ]
    const steps = buildReviewerSteps(reviewers)
    expect(steps[0].status).toBe('current')
  })

  it('should default null/unknown status to pending', () => {
    const reviewers: ReviewerRow[] = [
      { id: 'rev-1', role: 'Sub', status: null, stamp: null, comments: null, approver_id: null },
    ]
    const steps = buildReviewerSteps(reviewers)
    expect(steps[0].status).toBe('pending')
  })

  it('should use "Reviewer" as fallback role when role is null', () => {
    const reviewers: ReviewerRow[] = [
      { id: 'rev-1', role: null, status: 'approved', stamp: null, comments: null, approver_id: null },
    ]
    const steps = buildReviewerSteps(reviewers)
    expect(steps[0].role).toBe('Reviewer')
  })

  it('should format stamp date for display when present', () => {
    const reviewers: ReviewerRow[] = [
      { id: 'rev-1', role: 'Architect', status: 'approved', stamp: '2026-03-15T14:00:00Z', comments: null, approver_id: null },
    ]
    const steps = buildReviewerSteps(reviewers)
    // Date is formatted as "Mar 15" (locale-dependent, but contains the day)
    expect(steps[0].date).toBeDefined()
    expect(typeof steps[0].date).toBe('string')
  })

  it('should set date to undefined when stamp is null', () => {
    const reviewers: ReviewerRow[] = [
      { id: 'rev-1', role: 'Architect', status: 'approved', stamp: null, comments: null, approver_id: null },
    ]
    const steps = buildReviewerSteps(reviewers)
    expect(steps[0].date).toBeUndefined()
  })

  it('should preserve reviewer id on the step', () => {
    const reviewers: ReviewerRow[] = [
      { id: 'reviewer-uuid-abc', role: 'GC', status: 'approved', stamp: null, comments: null, approver_id: null },
    ]
    const steps = buildReviewerSteps(reviewers)
    expect(steps[0].id).toBe('reviewer-uuid-abc')
  })

  it('should map a multi-step review chain in order', () => {
    const reviewers: ReviewerRow[] = [
      { id: 'r1', role: 'GC', status: 'approved', stamp: '2026-01-10T00:00:00Z', comments: null, approver_id: null },
      { id: 'r2', role: 'Architect', status: 'in_review', stamp: null, comments: null, approver_id: null },
      { id: 'r3', role: 'Owner', status: null, stamp: null, comments: null, approver_id: null },
    ]
    const steps = buildReviewerSteps(reviewers)
    expect(steps).toHaveLength(3)
    expect(steps[0].status).toBe('approved')
    expect(steps[1].status).toBe('current')
    expect(steps[2].status).toBe('pending')
  })
})

// ---------------------------------------------------------------------------
// isOverdue tests (submittal context)
// ---------------------------------------------------------------------------

describe('isOverdue (Submittals)', () => {
  it('should flag a submittal due last month as overdue', () => {
    const lastMonth = new Date()
    lastMonth.setMonth(lastMonth.getMonth() - 1)
    expect(isOverdue(lastMonth.toISOString())).toBe(true)
  })

  it('should not flag a submittal due next month as overdue', () => {
    const nextMonth = new Date()
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    expect(isOverdue(nextMonth.toISOString())).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Submittal status coverage (ensure all statuses have a defined path)
// ---------------------------------------------------------------------------

describe('Submittal status completeness', () => {
  const knownStatuses = [
    'pending',
    'submitted',
    'under_review',
    'review_in_progress',
    'approved',
    'approved_as_noted',
    'rejected',
    'revise_resubmit',
  ]

  it('should produce exactly 3 steps for every known status', () => {
    for (const status of knownStatuses) {
      const steps = buildFallbackSteps(status)
      expect(steps).toHaveLength(3)
    }
  })

  it('should never produce undefined step statuses', () => {
    for (const status of knownStatuses) {
      const steps = buildFallbackSteps(status)
      for (const step of steps) {
        expect(step.status).toBeDefined()
        expect(['pending', 'current', 'approved', 'rejected', 'approved_as_noted']).toContain(step.status)
      }
    }
  })
})
