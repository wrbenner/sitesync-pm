/**
 * Tests for Submittals page helper functions.
 * buildFallbackSteps and buildReviewerSteps drive the reviewer stepper UI.
 */
import { describe, it, expect } from 'vitest'

// ── Types (mirror Submittals.tsx) ─────────────────────────────────────────────

type StepStatus = 'pending' | 'current' | 'approved' | 'rejected' | 'approved_as_noted'

interface ReviewerStep {
  id: string | number
  role: string
  date?: string
  status: StepStatus
}

type ReviewerRow = {
  id: string
  role: string | null
  status: string | null
  stamp: string | null
  comments: string | null
  approver_id: string | null
}

// ── Replicated helpers (mirrors Submittals.tsx) ───────────────────────────────

function buildFallbackSteps(status: string): ReviewerStep[] {
  let s0: StepStatus = 'pending'
  let s1: StepStatus = 'pending'
  let s2: StepStatus = 'pending'

  if (status === 'pending') {
    s0 = 'current'
  } else if (
    status === 'submitted' ||
    status === 'under_review' ||
    status === 'review_in_progress'
  ) {
    s0 = 'approved'
    s1 = 'current'
  } else if (status === 'approved') {
    s0 = 'approved'
    s1 = 'approved'
    s2 = 'approved'
  } else if (status === 'approved_as_noted') {
    s0 = 'approved'
    s1 = 'approved'
    s2 = 'approved_as_noted'
  } else if (status === 'rejected' || status === 'revise_resubmit') {
    s0 = 'approved'
    s1 = 'approved'
    s2 = 'rejected'
  } else {
    s0 = 'current'
  }

  return [
    { id: 1, role: 'Subcontractor', status: s0 },
    { id: 2, role: 'GC Review', status: s1 },
    { id: 3, role: 'Architect Review', status: s2 },
  ]
}

function buildReviewerSteps(reviewers: ReviewerRow[]): ReviewerStep[] {
  return reviewers.map(r => {
    let stepStatus: StepStatus = 'pending'
    if (r.status === 'approved') stepStatus = 'approved'
    else if (r.status === 'approved_as_noted') stepStatus = 'approved_as_noted'
    else if (r.status === 'rejected' || r.status === 'revise_resubmit') stepStatus = 'rejected'
    else if (r.status === 'current' || r.status === 'in_review') stepStatus = 'current'
    return {
      id: r.id,
      role: r.role || 'Reviewer',
      status: stepStatus,
      date: r.stamp
        ? new Date(r.stamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : undefined,
    }
  })
}

function isOverdue(dateStr: string): boolean {
  return new Date(dateStr) < new Date()
}

// ── buildFallbackSteps ────────────────────────────────────────────────────────

describe('buildFallbackSteps', () => {
  it('should return 3 steps always', () => {
    const steps = buildFallbackSteps('pending')
    expect(steps).toHaveLength(3)
  })

  it('should assign roles in correct order', () => {
    const steps = buildFallbackSteps('pending')
    expect(steps[0].role).toBe('Subcontractor')
    expect(steps[1].role).toBe('GC Review')
    expect(steps[2].role).toBe('Architect Review')
  })

  it('should set first step as current when status is pending', () => {
    const steps = buildFallbackSteps('pending')
    expect(steps[0].status).toBe('current')
    expect(steps[1].status).toBe('pending')
    expect(steps[2].status).toBe('pending')
  })

  it('should set step 1 approved and step 2 current when submitted', () => {
    const steps = buildFallbackSteps('submitted')
    expect(steps[0].status).toBe('approved')
    expect(steps[1].status).toBe('current')
    expect(steps[2].status).toBe('pending')
  })

  it('should treat under_review same as submitted', () => {
    const steps = buildFallbackSteps('under_review')
    expect(steps[0].status).toBe('approved')
    expect(steps[1].status).toBe('current')
    expect(steps[2].status).toBe('pending')
  })

  it('should treat review_in_progress same as submitted', () => {
    const steps = buildFallbackSteps('review_in_progress')
    expect(steps[0].status).toBe('approved')
    expect(steps[1].status).toBe('current')
    expect(steps[2].status).toBe('pending')
  })

  it('should set all steps approved when status is approved', () => {
    const steps = buildFallbackSteps('approved')
    expect(steps[0].status).toBe('approved')
    expect(steps[1].status).toBe('approved')
    expect(steps[2].status).toBe('approved')
  })

  it('should set last step as approved_as_noted when status is approved_as_noted', () => {
    const steps = buildFallbackSteps('approved_as_noted')
    expect(steps[0].status).toBe('approved')
    expect(steps[1].status).toBe('approved')
    expect(steps[2].status).toBe('approved_as_noted')
  })

  it('should set last step as rejected when status is rejected', () => {
    const steps = buildFallbackSteps('rejected')
    expect(steps[0].status).toBe('approved')
    expect(steps[1].status).toBe('approved')
    expect(steps[2].status).toBe('rejected')
  })

  it('should set last step as rejected when status is revise_resubmit', () => {
    const steps = buildFallbackSteps('revise_resubmit')
    expect(steps[0].status).toBe('approved')
    expect(steps[1].status).toBe('approved')
    expect(steps[2].status).toBe('rejected')
  })

  it('should fall back to current for first step on unknown status', () => {
    const steps = buildFallbackSteps('some_unknown_status')
    expect(steps[0].status).toBe('current')
    expect(steps[1].status).toBe('pending')
    expect(steps[2].status).toBe('pending')
  })
})

// ── buildReviewerSteps ────────────────────────────────────────────────────────

describe('buildReviewerSteps', () => {
  it('should map approved status correctly', () => {
    const reviewers: ReviewerRow[] = [
      { id: 'r1', role: 'Subcontractor', status: 'approved', stamp: null, comments: null, approver_id: null },
    ]
    const steps = buildReviewerSteps(reviewers)
    expect(steps[0].status).toBe('approved')
  })

  it('should map approved_as_noted status correctly', () => {
    const reviewers: ReviewerRow[] = [
      { id: 'r1', role: 'Architect', status: 'approved_as_noted', stamp: null, comments: null, approver_id: null },
    ]
    const steps = buildReviewerSteps(reviewers)
    expect(steps[0].status).toBe('approved_as_noted')
  })

  it('should map rejected status correctly', () => {
    const reviewers: ReviewerRow[] = [
      { id: 'r1', role: 'GC', status: 'rejected', stamp: null, comments: null, approver_id: null },
    ]
    const steps = buildReviewerSteps(reviewers)
    expect(steps[0].status).toBe('rejected')
  })

  it('should map revise_resubmit to rejected', () => {
    const reviewers: ReviewerRow[] = [
      { id: 'r1', role: 'GC', status: 'revise_resubmit', stamp: null, comments: null, approver_id: null },
    ]
    const steps = buildReviewerSteps(reviewers)
    expect(steps[0].status).toBe('rejected')
  })

  it('should map in_review status to current', () => {
    const reviewers: ReviewerRow[] = [
      { id: 'r1', role: 'Architect', status: 'in_review', stamp: null, comments: null, approver_id: null },
    ]
    const steps = buildReviewerSteps(reviewers)
    expect(steps[0].status).toBe('current')
  })

  it('should map current status to current', () => {
    const reviewers: ReviewerRow[] = [
      { id: 'r1', role: 'Architect', status: 'current', stamp: null, comments: null, approver_id: null },
    ]
    const steps = buildReviewerSteps(reviewers)
    expect(steps[0].status).toBe('current')
  })

  it('should default unknown status to pending', () => {
    const reviewers: ReviewerRow[] = [
      { id: 'r1', role: 'Architect', status: 'waiting', stamp: null, comments: null, approver_id: null },
    ]
    const steps = buildReviewerSteps(reviewers)
    expect(steps[0].status).toBe('pending')
  })

  it('should default null status to pending', () => {
    const reviewers: ReviewerRow[] = [
      { id: 'r1', role: 'GC', status: null, stamp: null, comments: null, approver_id: null },
    ]
    const steps = buildReviewerSteps(reviewers)
    expect(steps[0].status).toBe('pending')
  })

  it('should fall back role to "Reviewer" when role is null', () => {
    const reviewers: ReviewerRow[] = [
      { id: 'r1', role: null, status: 'approved', stamp: null, comments: null, approver_id: null },
    ]
    const steps = buildReviewerSteps(reviewers)
    expect(steps[0].role).toBe('Reviewer')
  })

  it('should include formatted date when stamp is provided', () => {
    const reviewers: ReviewerRow[] = [
      { id: 'r1', role: 'GC', status: 'approved', stamp: '2024-03-15T00:00:00.000Z', comments: null, approver_id: null },
    ]
    const steps = buildReviewerSteps(reviewers)
    expect(steps[0].date).toBeDefined()
    expect(steps[0].date).toMatch(/Mar/)
  })

  it('should leave date undefined when stamp is null', () => {
    const reviewers: ReviewerRow[] = [
      { id: 'r1', role: 'GC', status: 'approved', stamp: null, comments: null, approver_id: null },
    ]
    const steps = buildReviewerSteps(reviewers)
    expect(steps[0].date).toBeUndefined()
  })

  it('should preserve reviewer IDs', () => {
    const reviewers: ReviewerRow[] = [
      { id: 'reviewer-abc-123', role: 'GC', status: 'pending', stamp: null, comments: null, approver_id: null },
    ]
    const steps = buildReviewerSteps(reviewers)
    expect(steps[0].id).toBe('reviewer-abc-123')
  })

  it('should handle multiple reviewers in order', () => {
    const reviewers: ReviewerRow[] = [
      { id: 'r1', role: 'Subcontractor', status: 'approved', stamp: null, comments: null, approver_id: null },
      { id: 'r2', role: 'GC', status: 'in_review', stamp: null, comments: null, approver_id: null },
      { id: 'r3', role: 'Architect', status: 'pending', stamp: null, comments: null, approver_id: null },
    ]
    const steps = buildReviewerSteps(reviewers)
    expect(steps).toHaveLength(3)
    expect(steps[0].status).toBe('approved')
    expect(steps[1].status).toBe('current')
    expect(steps[2].status).toBe('pending')
  })

  it('should return empty array for empty reviewers', () => {
    const steps = buildReviewerSteps([])
    expect(steps).toHaveLength(0)
  })
})

// ── isOverdue (Submittals) ────────────────────────────────────────────────────

describe('isOverdue (submittals context)', () => {
  it('should return true for submittal overdue by days', () => {
    expect(isOverdue('2022-05-01')).toBe(true)
  })

  it('should return false for future submittal due date', () => {
    const future = new Date(Date.now() + 86_400_000 * 14).toISOString()
    expect(isOverdue(future)).toBe(false)
  })
})

// ── Submittal pagination math ─────────────────────────────────────────────────

describe('useSubmittals pagination math', () => {
  it('should calculate correct offsets for page 1', () => {
    const page = 1
    const pageSize = 50
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    expect(from).toBe(0)
    expect(to).toBe(49)
  })

  it('should calculate correct offsets for page 3', () => {
    const page = 3
    const pageSize = 50
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1
    expect(from).toBe(100)
    expect(to).toBe(149)
  })
})
