// Phase 7 — WorkflowChainTable render + grouping tests.

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import {
  WorkflowChainTable,
  groupBySequence,
  inferRowStatus,
  type WorkflowChainRow,
} from '../../../components/submittals/detail/Overview/WorkflowChainTable'

const mkRow = (over: Partial<WorkflowChainRow>): WorkflowChainRow => ({
  id: String(over.id ?? Math.random()),
  sequence: 1,
  reviewer_name: 'Test',
  reviewer_company: null,
  reviewer_role: null,
  reviewer_email: null,
  sent_at: null,
  due_date: null,
  returned_at: null,
  responded_at: null,
  disposition: null,
  comments: null,
  attachments: [],
  version: null,
  parallel_group: null,
  is_current: false,
  ...over,
})

describe('groupBySequence', () => {
  it('collapses parallel reviewers into the same step group', () => {
    const rows = [
      mkRow({ id: 'a', sequence: 1 }),
      mkRow({ id: 'b', sequence: 2, parallel_group: 1 }),
      mkRow({ id: 'c', sequence: 2, parallel_group: 1 }),
      mkRow({ id: 'd', sequence: 3 }),
    ]
    const groups = groupBySequence(rows)
    expect(groups).toHaveLength(3)
    expect(groups[1].rows).toHaveLength(2) // parallel pair
    expect(groups[1].rows[0].id).toBe('b')
    expect(groups[1].rows[1].id).toBe('c')
  })

  it('sorts groups by sequence number', () => {
    const rows = [mkRow({ sequence: 3 }), mkRow({ sequence: 1 }), mkRow({ sequence: 2 })]
    const groups = groupBySequence(rows)
    expect(groups.map((g) => g.sequence)).toEqual([1, 2, 3])
  })
})

describe('inferRowStatus', () => {
  it('returns rejected when disposition matches reject pattern', () => {
    expect(inferRowStatus(mkRow({ disposition: 'rejected' }))).toBe('rejected')
    expect(inferRowStatus(mkRow({ disposition: 'D — Rejected' }))).toBe('rejected')
  })

  it('returns done when responded_at is set', () => {
    expect(inferRowStatus(mkRow({ responded_at: '2026-05-01' }))).toBe('done')
  })

  it('returns overdue when current step + due_date in the past', () => {
    const r = mkRow({ is_current: true, due_date: '2000-01-01' })
    expect(inferRowStatus(r)).toBe('overdue')
  })

  it('returns current when is_current + future due', () => {
    const r = mkRow({ is_current: true, due_date: '2099-01-01' })
    expect(inferRowStatus(r)).toBe('current')
  })

  it('returns pending otherwise', () => {
    expect(inferRowStatus(mkRow({}))).toBe('pending')
  })
})

describe('WorkflowChainTable render', () => {
  it('renders table column headers', () => {
    render(<WorkflowChainTable rows={[mkRow({ reviewer_name: 'Alice' })]} />)
    expect(screen.getByText(/^Workflow Chain$/i)).toBeInTheDocument()
    expect(screen.getByText(/^Reviewer$/i)).toBeInTheDocument()
    expect(screen.getByText(/^Sent$/i)).toBeInTheDocument()
    expect(screen.getByText(/^Due$/i)).toBeInTheDocument()
    expect(screen.getByText(/^Returned$/i)).toBeInTheDocument()
    expect(screen.getByText(/^Response$/i)).toBeInTheDocument()
    expect(screen.getByText(/^Comments$/i)).toBeInTheDocument()
  })

  it('renders the empty-state copy when no rows', () => {
    render(<WorkflowChainTable rows={[]} />)
    expect(screen.getByText(/no reviewer chain configured/i)).toBeInTheDocument()
  })

  it('renders parallel marker on parallel reviewers', () => {
    render(<WorkflowChainTable rows={[
      mkRow({ id: 'a', sequence: 1, reviewer_name: 'A', parallel_group: 1 }),
      mkRow({ id: 'b', sequence: 1, reviewer_name: 'B', parallel_group: 1 }),
    ]} />)
    const parallelMarkers = screen.getAllByText(/parallel/i)
    expect(parallelMarkers.length).toBeGreaterThanOrEqual(2)
  })

  it('shows CURRENT badge when an attachment is marked current', () => {
    render(<WorkflowChainTable rows={[
      mkRow({
        reviewer_name: 'A',
        attachments: [
          { id: '1', name: 'r1.pdf', isCurrent: false },
          { id: '2', name: 'r2.pdf', isCurrent: true },
        ],
      }),
    ]} />)
    expect(screen.getByText('CURRENT')).toBeInTheDocument()
  })
})
