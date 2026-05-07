// Phase 4 — GroupedView grouping/aggregation tests.
//
// Validates the per-group aggregate math (total, approved, overdue) computed
// inline by GroupedSubmittalsView. Renders a minimal harness so we exercise
// the production component, not a re-implementation.

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { GroupedSubmittalsView, type GroupBucket } from '../../../components/submittals/GroupedView/GroupedSubmittalsView'
import type { SubmittalListRow } from '../../../hooks/useSubmittalsList'

vi.mock('../../../hooks/useColumnState', () => ({
  useColumnState: () => ({
    getColumn: () => ({ width: 120, hidden: false, pin: null, sort: null }),
    setWidth: vi.fn(),
    setSort: vi.fn(),
    setPin: vi.fn(),
    setHidden: vi.fn(),
  }),
}))
vi.mock('../../../hooks/useSubmittalSelection', () => ({
  useSubmittalSelection: () => ({
    selectedIds: new Set<string>(),
    isSelected: () => false,
    toggle: vi.fn(),
    toggleAll: vi.fn(),
    headerStateFor: () => 'none' as const,
    clear: vi.fn(),
    size: 0,
  }),
}))
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (sel: (s: { user: { id: string } | null }) => unknown) =>
    sel({ user: { id: 'test-user' } }),
}))
vi.mock('../../../components/submittals/columns', () => ({
  buildColumns: () => [
    { id: 'number', header: '#', defaultWidth: 80, minWidth: 40, maxWidth: 200, collapsible: false, numeric: false, render: () => null },
  ],
}))
vi.mock('../../../components/submittals/SubmittalRow', () => ({
  SubmittalRow: ({ row }: { row: SubmittalListRow }) => (
    <div data-testid="row" data-id={String(row.id)}>{String(row.title ?? row.id)}</div>
  ),
}))

const mkRow = (over: Partial<SubmittalListRow>): SubmittalListRow => ({
  id: String(over.id ?? Math.random()),
  project_id: 'p1',
  title: 'r',
  status: 'in_review',
  ...over,
})

const renderView = (groups: GroupBucket[]): void => {
  render(
    <MemoryRouter>
      <GroupedSubmittalsView
        projectId="p1"
        viewType="packages"
        resetToken="t1"
        numberingFormat="{spec_section}-{seq}"
        groups={groups}
      />
    </MemoryRouter>,
  )
}

describe('GroupedSubmittalsView', () => {
  it('renders one GroupHeader per bucket and includes the aggregate row counts', () => {
    const future = '2099-01-01'
    const past = '2000-01-01'
    const groups: GroupBucket[] = [
      {
        id: 'g1',
        label: 'Group One',
        rows: [
          mkRow({ id: 'a', status: 'approved', required_on_site_date: future }),
          mkRow({ id: 'b', status: 'in_review', required_on_site_date: past }), // overdue
          mkRow({ id: 'c', status: 'in_review', required_on_site_date: future }),
        ],
      },
      {
        id: 'g2',
        label: 'Group Two',
        rows: [
          mkRow({ id: 'd', status: 'approved', required_on_site_date: future }),
        ],
      },
    ]

    renderView(groups)

    expect(screen.getByText('Group One')).toBeInTheDocument()
    expect(screen.getByText('Group Two')).toBeInTheDocument()

    // total counts render via "{n} total"
    expect(screen.getByText('3 total')).toBeInTheDocument()
    expect(screen.getByText('1 total')).toBeInTheDocument()

    // approved/total mini progress label
    expect(screen.getByText('1/3')).toBeInTheDocument()
    expect(screen.getByText('1/1')).toBeInTheDocument()

    // overdue badge present for group with one overdue row
    expect(screen.getByLabelText('1 overdue')).toBeInTheDocument()

    // group counts header
    expect(screen.getByText('2 groups · 2 expanded')).toBeInTheDocument()
  })

  it('toggles a group collapsed/expanded', () => {
    const groups: GroupBucket[] = [
      { id: 'g1', label: 'G', rows: [mkRow({ id: 'a' })] },
    ]
    renderView(groups)

    expect(screen.getByTestId('row')).toBeInTheDocument()
    const toggle = screen.getByLabelText('Collapse group')
    fireEvent.click(toggle)
    expect(screen.queryByTestId('row')).not.toBeInTheDocument()
  })

  it('renders the empty state when there are zero groups', () => {
    renderView([])
    expect(screen.getByRole('status')).toHaveTextContent(/No groups to display/)
  })
})
