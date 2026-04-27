import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { StatusTag, PriorityTag } from './Primitives'

describe('StatusTag', () => {
  it('renders the documented label for each status', () => {
    const cases: Array<[string, RegExp]> = [
      ['pending', /Pending/],
      ['draft', /Draft/],
      ['submitted', /Submitted/],
      ['under_review', /Under Review/],
      ['review_in_progress', /In Review/],
      ['gc_review', /GC Review/],
      ['architect_review', /Architect Review/],
      ['approved', /Approved/],
      ['approved_as_noted', /Approved as Noted/],
      ['revise_resubmit', /Revise & Resubmit/],
      ['resubmit', /Resubmit/],
      ['rejected', /Rejected/],
      ['complete', /Complete/],
      ['active', /Active/],
      ['closed', /Closed/],
      ['pending_approval', /Pending Approval/],
    ]
    for (const [status, label] of cases) {
      const { unmount, getByText } = render(<StatusTag status={status} />)
      expect(getByText(label)).toBeTruthy()
      unmount()
    }
  })

  it('falls back to "Pending" config for unknown status', () => {
    const { getByText } = render(<StatusTag status="mystery_status" />)
    expect(getByText('Pending')).toBeTruthy()
  })

  it('honours an explicit label prop, overriding the default', () => {
    const { getByText } = render(<StatusTag status="approved" label="Final Approval" />)
    expect(getByText('Final Approval')).toBeTruthy()
  })

  it('approved + complete + active all render successfully (positive-outcome trio)', () => {
    for (const status of ['approved', 'complete', 'active']) {
      const { unmount, container } = render(<StatusTag status={status} />)
      expect(container.firstChild).toBeTruthy()
      unmount()
    }
  })
})

describe('PriorityTag', () => {
  it.each(['low', 'medium', 'high', 'critical'] as const)(
    'renders the label for "%s" priority',
    (priority) => {
      const { getByText } = render(<PriorityTag priority={priority} />)
      const expected = priority[0].toUpperCase() + priority.slice(1)
      expect(getByText(expected)).toBeTruthy()
    },
  )

  it('falls back to "Medium" for unknown priority (graceful crash protection)', () => {
    const { getByText } = render(<PriorityTag priority={'unknown' as 'low'} />)
    expect(getByText('Medium')).toBeTruthy()
  })

  it('falls back to "Medium" when priority is undefined (unset row protection)', () => {
    const { getByText } = render(<PriorityTag priority={undefined as unknown as 'low'} />)
    expect(getByText('Medium')).toBeTruthy()
  })

  it('honours an explicit label prop', () => {
    const { getByText } = render(<PriorityTag priority="high" label="P1" />)
    expect(getByText('P1')).toBeTruthy()
  })
})
