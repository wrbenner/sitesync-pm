
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ApprovalChain } from './ApprovalChain'
import type { ApprovalStep } from './ApprovalChain'

function step(overrides: Partial<ApprovalStep> = {}): ApprovalStep {
  return {
    id: 1,
    role: 'Project Manager',
    name: 'Sarah Chen',
    initials: 'SC',
    status: 'pending',
    ...overrides,
  }
}

// ── Loading state ────────────────────────────────────────────────

describe('ApprovalChain — loading state', () => {
  it('renders an aria-busy="true" status region with no list while loading', () => {
    const { getByRole, queryByRole } = render(<ApprovalChain steps={[]} loading />)
    const status = getByRole('status', { name: 'Loading approval chain' })
    expect(status.getAttribute('aria-busy')).toBe('true')
    expect(queryByRole('list')).toBeNull()
  })
})

// ── Empty state ──────────────────────────────────────────────────

describe('ApprovalChain — empty state', () => {
  it('renders the default empty message when steps is empty', () => {
    const { getByText } = render(<ApprovalChain steps={[]} />)
    expect(getByText('No approval steps configured')).toBeTruthy()
  })

  it('renders a custom emptyMessage when provided', () => {
    const { getByText } = render(
      <ApprovalChain steps={[]} emptyMessage="Awaiting submittal review" />,
    )
    expect(getByText('Awaiting submittal review')).toBeTruthy()
  })

  it('Empty-state region has role="status" so SR announces "no approvals" politely', () => {
    const { getByRole } = render(<ApprovalChain steps={[]} />)
    expect(getByRole('status')).toBeTruthy()
  })
})

// ── List rendering ───────────────────────────────────────────────

describe('ApprovalChain — populated list', () => {
  it('Renders a role="list" with one role="listitem" per step', () => {
    const { getByRole, getAllByRole } = render(
      <ApprovalChain steps={[
        step({ id: 1 }),
        step({ id: 2, name: 'Marcus Reyes', initials: 'MR' }),
        step({ id: 3, name: 'Anika Patel', initials: 'AP' }),
      ]} />,
    )
    expect(getByRole('list', { name: 'Approval chain' })).toBeTruthy()
    expect(getAllByRole('listitem')).toHaveLength(3)
  })

  it('Renders the approver name + role + status label', () => {
    const { getByText } = render(
      <ApprovalChain steps={[step({ name: 'Sarah Chen', role: 'Project Manager', status: 'approved' })]} />,
    )
    expect(getByText('Sarah Chen')).toBeTruthy()
    expect(getByText(/Project Manager/)).toBeTruthy()
    expect(getByText('Approved')).toBeTruthy()
  })

  it('Renders all 4 status labels for the 4 lifecycle states', () => {
    const { getByText } = render(
      <ApprovalChain steps={[
        step({ id: 1, status: 'approved' }),
        step({ id: 2, status: 'pending' }),
        step({ id: 3, status: 'rejected' }),
        step({ id: 4, status: 'waiting' }),
      ]} />,
    )
    expect(getByText('Approved')).toBeTruthy()
    expect(getByText('Pending Review')).toBeTruthy()
    expect(getByText('Revision Required')).toBeTruthy()
    expect(getByText('Waiting')).toBeTruthy()
  })

  it('Date is appended after the role with " · " separator when provided', () => {
    const { container } = render(
      <ApprovalChain steps={[step({ role: 'PM', date: '2026-04-25' })]} />,
    )
    expect(container.textContent).toContain('PM · 2026-04-25')
  })

  it('Comment is rendered (italicized, quoted) when provided', () => {
    const { getByText } = render(
      <ApprovalChain steps={[step({ comment: 'Looks good — please proceed.' })]} />,
    )
    // The component wraps the comment in &quot; entities + an italic <p>
    expect(getByText(/Looks good — please proceed\./)).toBeTruthy()
  })

  it('Comment paragraph is omitted when no comment supplied', () => {
    const { container } = render(
      <ApprovalChain steps={[step()]} />,
    )
    // No italic-styled paragraph should appear
    const italicParas = Array.from(container.querySelectorAll('p')).filter(p =>
      p.style.fontStyle === 'italic',
    )
    expect(italicParas).toHaveLength(0)
  })

  it('Single-step chain: still renders one listitem (no connector logic crash)', () => {
    const { getAllByRole } = render(<ApprovalChain steps={[step()]} />)
    expect(getAllByRole('listitem')).toHaveLength(1)
  })
})
