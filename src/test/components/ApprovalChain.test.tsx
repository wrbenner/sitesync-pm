import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ApprovalChain, type ApprovalStep } from '../../components/shared/ApprovalChain'

const makeStep = (overrides: Partial<ApprovalStep> = {}): ApprovalStep => ({
  id: 1,
  role: 'Project Manager',
  name: 'Alice Johnson',
  initials: 'AJ',
  status: 'approved',
  ...overrides,
})

describe('ApprovalChain', () => {
  it('renders steps with name and role', () => {
    render(<ApprovalChain steps={[makeStep()]} />)
    expect(screen.getByText('Alice Johnson')).toBeDefined()
    expect(screen.getByText('Project Manager')).toBeDefined()
  })

  it('shows correct status label for each status', () => {
    const steps: ApprovalStep[] = [
      makeStep({ id: 1, status: 'approved', name: 'Alice' }),
      makeStep({ id: 2, status: 'pending', name: 'Bob' }),
      makeStep({ id: 3, status: 'rejected', name: 'Carol' }),
      makeStep({ id: 4, status: 'waiting', name: 'Dave' }),
    ]
    render(<ApprovalChain steps={steps} />)
    expect(screen.getByText('Approved')).toBeDefined()
    expect(screen.getByText('Pending Review')).toBeDefined()
    expect(screen.getByText('Revision Required')).toBeDefined()
    expect(screen.getByText('Waiting')).toBeDefined()
  })

  it('renders optional comment when provided', () => {
    render(<ApprovalChain steps={[makeStep({ comment: 'Looks good to me' })]} />)
    expect(screen.getByText(/"Looks good to me"/)).toBeDefined()
  })

  it('renders date inline with role when provided', () => {
    render(<ApprovalChain steps={[makeStep({ date: 'Apr 10' })]} />)
    expect(screen.getByText('Project Manager · Apr 10')).toBeDefined()
  })

  it('uses role="list" for accessibility', () => {
    render(<ApprovalChain steps={[makeStep()]} />)
    expect(screen.getByRole('list')).toBeDefined()
  })

  it('each step is a listitem', () => {
    render(<ApprovalChain steps={[makeStep({ id: 1 }), makeStep({ id: 2, name: 'Bob' })]} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(2)
  })

  it('shows empty state when no steps provided', () => {
    render(<ApprovalChain steps={[]} />)
    expect(screen.getByText('No approval steps configured')).toBeDefined()
  })

  it('accepts custom emptyMessage', () => {
    render(<ApprovalChain steps={[]} emptyMessage="No reviewers assigned yet" />)
    expect(screen.getByText('No reviewers assigned yet')).toBeDefined()
  })

  it('shows loading skeleton with aria-busy', () => {
    render(<ApprovalChain steps={[]} loading />)
    const loader = screen.getByRole('status')
    expect(loader.getAttribute('aria-busy')).toBe('true')
  })

  it('loading state does not render step data', () => {
    render(<ApprovalChain steps={[makeStep({ name: 'Alice' })]} loading />)
    expect(screen.queryByText('Alice')).toBeNull()
  })
})
