// Phase 4 — useBallInCourtGroups aggregation tests.
//
// The hook itself is pure logic over an array of MV rows; we exercise it via
// renderHook so React's identity guarantees are tested too (memoization).

import { describe, it, expect } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useBallInCourtGroups } from '../../hooks/useBallInCourtGroups'
import type { SubmittalListRow } from '../../hooks/useSubmittalsList'

const mkRow = (over: Partial<SubmittalListRow>): SubmittalListRow => ({
  id: String(over.id ?? crypto.randomUUID()),
  project_id: 'p1',
  status: 'in_review',
  ...over,
})

describe('useBallInCourtGroups', () => {
  it('groups by current_reviewer_id, with Unassigned and Closed as special buckets', () => {
    const rows: SubmittalListRow[] = [
      mkRow({ id: '1', current_reviewer_id: 'u1', current_reviewer_name: 'Alice', days_in_court: 5 }),
      mkRow({ id: '2', current_reviewer_id: 'u1', current_reviewer_name: 'Alice', days_in_court: 9 }),
      mkRow({ id: '3', current_reviewer_id: 'u2', current_reviewer_name: 'Bob', days_in_court: 12 }),
      mkRow({ id: '4', current_reviewer_id: null, status: 'draft' }),
      mkRow({ id: '5', current_reviewer_id: 'u1', status: 'closed' }),
      mkRow({ id: '6', current_reviewer_id: 'u3', status: 'void' }),
    ]

    const { result } = renderHook(() => useBallInCourtGroups(rows))
    const buckets = result.current

    expect(buckets.unassigned.totalCount).toBe(1)
    expect(buckets.unassigned.rows.map((r) => r.id)).toEqual(['4'])

    expect(buckets.closed.totalCount).toBe(2)
    expect(buckets.closed.rows.map((r) => r.id).sort()).toEqual(['5', '6'])

    // Two real reviewers, sorted by avgDaysInCourt desc (Bob 12 > Alice 7).
    expect(buckets.reviewers).toHaveLength(2)
    expect(buckets.reviewers[0].reviewerName).toBe('Bob')
    expect(buckets.reviewers[0].avgDaysInCourt).toBeCloseTo(12, 5)
    expect(buckets.reviewers[1].reviewerName).toBe('Alice')
    expect(buckets.reviewers[1].avgDaysInCourt).toBeCloseTo(7, 5)
  })

  it('counts overdue per reviewer using required_on_site_date', () => {
    const past = '2000-01-01'
    const future = '2099-01-01'
    const rows: SubmittalListRow[] = [
      mkRow({ id: '1', current_reviewer_id: 'u1', required_on_site_date: past }),
      mkRow({ id: '2', current_reviewer_id: 'u1', required_on_site_date: future }),
      mkRow({ id: '3', current_reviewer_id: 'u1', required_on_site_date: past }),
    ]
    const { result } = renderHook(() => useBallInCourtGroups(rows))
    expect(result.current.reviewers[0].overdueCount).toBe(2)
  })

  it('picks the oldest submittal per reviewer by days_in_court', () => {
    const rows: SubmittalListRow[] = [
      mkRow({ id: 'short', current_reviewer_id: 'u1', days_in_court: 3 }),
      mkRow({ id: 'oldest', current_reviewer_id: 'u1', days_in_court: 21 }),
      mkRow({ id: 'med',   current_reviewer_id: 'u1', days_in_court: 9 }),
    ]
    const { result } = renderHook(() => useBallInCourtGroups(rows))
    expect(result.current.reviewers[0].oldestSubmittal?.id).toBe('oldest')
  })

  it('uses denormalized current_reviewer_name when available', () => {
    const rows: SubmittalListRow[] = [
      mkRow({ id: '1', current_reviewer_id: 'u1', current_reviewer_name: 'Melissa Ellis' }),
    ]
    const { result } = renderHook(() => useBallInCourtGroups(rows))
    expect(result.current.reviewers[0].reviewerName).toBe('Melissa Ellis')
  })

  it('returns empty buckets for an empty input', () => {
    const { result } = renderHook(() => useBallInCourtGroups([]))
    expect(result.current.unassigned.totalCount).toBe(0)
    expect(result.current.closed.totalCount).toBe(0)
    expect(result.current.reviewers).toEqual([])
  })

  it('memoizes — same input produces a stable reference', () => {
    const rows: SubmittalListRow[] = [
      mkRow({ id: '1', current_reviewer_id: 'u1' }),
    ]
    const { result, rerender } = renderHook(
      ({ data }) => useBallInCourtGroups(data),
      { initialProps: { data: rows } },
    )
    const first = result.current
    rerender({ data: rows })
    expect(result.current).toBe(first)
  })
})
