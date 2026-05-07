// Phase 4 — ReviewerSidePanel browser-equivalent test.
//
// Real React + DOM via jsdom + RTL. Validates ADR-004 contract:
//   * opens when `open=true` + reviewer present
//   * renders status counts + items list
//   * clicking an item navigates and closes the panel
//   * closes via the explicit close button and via Escape key
//
// Uses MemoryRouter to capture navigate calls without a real router stack.

import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { ReviewerSidePanel } from '../../../components/submittals/BallInCourtView/ReviewerSidePanel'
import type { ReviewerStats } from '../../../hooks/useBallInCourtGroups'
import type { SubmittalListRow } from '../../../hooks/useSubmittalsList'

const mkRow = (over: Partial<SubmittalListRow>): SubmittalListRow => ({
  id: String(over.id ?? Math.random()),
  project_id: 'p1',
  ...over,
})

const mkReviewer = (over: Partial<ReviewerStats> = {}): ReviewerStats => ({
  reviewerId: 'u1',
  reviewerName: 'Melissa Ellis',
  reviewerRole: 'Cross Architect',
  totalCount: 14,
  overdueCount: 6,
  oldestSubmittal: mkRow({ id: 'oldest', days_in_court: 21 }),
  avgDaysInCourt: 8.3,
  rows: [
    mkRow({ id: 'a', number: '0231', title: 'Storefront frame', status: 'in_review', days_in_court: 5 }),
    mkRow({ id: 'b', number: '0232', title: 'Handrails', status: 'sent_to_reviewer', days_in_court: 12 }),
  ],
  ...over,
})

const LocationProbe: React.FC<{ onChange: (path: string) => void }> = ({ onChange }) => {
  const loc = useLocation()
  React.useEffect(() => { onChange(loc.pathname) }, [loc.pathname, onChange])
  return null
}

const renderPanel = (props: Partial<React.ComponentProps<typeof ReviewerSidePanel>> = {}): {
  closeMock: ReturnType<typeof vi.fn>
  pathRef: { current: string }
} => {
  const closeMock = vi.fn()
  const pathRef = { current: '/start' }
  render(
    <MemoryRouter initialEntries={['/start']}>
      <ReviewerSidePanel
        open
        onClose={closeMock}
        reviewer={mkReviewer()}
        {...props}
      />
      <Routes>
        <Route path="*" element={<LocationProbe onChange={(p) => { pathRef.current = p }} />} />
      </Routes>
    </MemoryRouter>,
  )
  return { closeMock, pathRef }
}

beforeEach(() => cleanup())

describe('ReviewerSidePanel', () => {
  it('renders nothing when no reviewer is provided', () => {
    const { container } = render(
      <MemoryRouter>
        <ReviewerSidePanel open onClose={() => {}} reviewer={null} />
      </MemoryRouter>,
    )
    expect(container.querySelector('aside')).toBeNull()
  })

  it('renders the reviewer name, role, and stats grid', () => {
    renderPanel()
    expect(screen.getByText('Melissa Ellis')).toBeInTheDocument()
    expect(screen.getByText('Cross Architect')).toBeInTheDocument()
    // Total on plate value is the rows.length, not the reviewer.totalCount mock —
    // the panel reads stats.totalCount which we passed verbatim. We check label.
    expect(screen.getByText('Total on plate')).toBeInTheDocument()
    expect(screen.getByText('Overdue')).toBeInTheDocument()
    expect(screen.getByText('Avg days in court')).toBeInTheDocument()
  })

  it('lists every row with number + title', () => {
    renderPanel()
    expect(screen.getByText('Storefront frame')).toBeInTheDocument()
    expect(screen.getByText('Handrails')).toBeInTheDocument()
    expect(screen.getByText('0231')).toBeInTheDocument()
    expect(screen.getByText('0232')).toBeInTheDocument()
  })

  it('shows status breakdown chips', () => {
    renderPanel()
    expect(screen.getByText(/in_review: 1/)).toBeInTheDocument()
    expect(screen.getByText(/sent_to_reviewer: 1/)).toBeInTheDocument()
  })

  it('navigates to the submittal detail and closes when an item is clicked', () => {
    const { closeMock, pathRef } = renderPanel()
    fireEvent.click(screen.getByText('Storefront frame'))
    expect(closeMock).toHaveBeenCalledTimes(1)
    expect(pathRef.current).toBe('/submittals/a')
  })

  it('closes when the × button is clicked', () => {
    const { closeMock } = renderPanel()
    fireEvent.click(screen.getByLabelText('Close side panel'))
    expect(closeMock).toHaveBeenCalledTimes(1)
  })

  it('closes when Escape is pressed', () => {
    const { closeMock } = renderPanel()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(closeMock).toHaveBeenCalledTimes(1)
  })
})
