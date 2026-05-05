import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WorkflowTimeline } from '../../components/WorkflowTimeline'

const STATES = ['draft', 'open', 'under_review', 'answered', 'closed']
const LABELS = {
  draft: 'Draft',
  open: 'Open',
  under_review: 'Under Review',
  answered: 'Answered',
  closed: 'Closed',
}

describe('WorkflowTimeline', () => {
  beforeEach(() => {
    // window.innerWidth defaults to 1024 in jsdom — desktop mode
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('renders all states', () => {
    render(
      <WorkflowTimeline
        states={STATES}
        currentState="open"
        completedStates={['draft']}
        labels={LABELS}
      />,
    )
    expect(screen.getByText('Draft')).toBeDefined()
    expect(screen.getByText('Open')).toBeDefined()
    expect(screen.getByText('Under Review')).toBeDefined()
    expect(screen.getByText('Answered')).toBeDefined()
    expect(screen.getByText('Closed')).toBeDefined()
  })

  it('has progressbar role with correct aria attributes', () => {
    render(
      <WorkflowTimeline
        states={STATES}
        currentState="under_review"
        completedStates={['draft', 'open']}
        labels={LABELS}
      />,
    )
    const bar = screen.getByRole('progressbar')
    expect(bar).toBeDefined()
    expect(bar.getAttribute('aria-valuenow')).toBe('2') // index of under_review
    expect(bar.getAttribute('aria-valuemin')).toBe('0')
    expect(bar.getAttribute('aria-valuemax')).toBe('4') // states.length - 1
  })

  it('marks current step with aria-current="step"', () => {
    render(
      <WorkflowTimeline
        states={STATES}
        currentState="open"
        completedStates={['draft']}
        labels={LABELS}
      />,
    )
    const currentBtn = screen.getByLabelText(/Step 2: Open — current/i)
    expect(currentBtn.getAttribute('aria-current')).toBe('step')
  })

  it('labels completed steps correctly', () => {
    render(
      <WorkflowTimeline
        states={STATES}
        currentState="under_review"
        completedStates={['draft', 'open']}
        labels={LABELS}
      />,
    )
    expect(screen.getByLabelText(/Step 1: Draft — completed/i)).toBeDefined()
    expect(screen.getByLabelText(/Step 2: Open — completed/i)).toBeDefined()
    expect(screen.getByLabelText(/Step 3: Under Review — current/i)).toBeDefined()
    expect(screen.getByLabelText(/Step 4: Answered — upcoming/i)).toBeDefined()
  })

  it('upcoming step buttons are disabled when no onTransition provided', () => {
    render(
      <WorkflowTimeline
        states={STATES}
        currentState="open"
        completedStates={['draft']}
        labels={LABELS}
      />,
    )
    const upcomingBtn = screen.getByLabelText(/Step 3: Under Review — upcoming/i)
    expect(upcomingBtn.getAttribute('disabled')).toBeDefined()
  })

  it('only the immediately next step is clickable when onTransition provided', () => {
    const onTransition = vi.fn()
    render(
      <WorkflowTimeline
        states={STATES}
        currentState="open"
        completedStates={['draft']}
        labels={LABELS}
        onTransition={onTransition}
      />,
    )
    // Next step (under_review) should be enabled
    const nextBtn = screen.getByLabelText(/Step 3: Under Review — upcoming/i)
    expect(nextBtn.getAttribute('disabled')).toBeNull()
    fireEvent.click(nextBtn)
    expect(onTransition).toHaveBeenCalledWith('under_review')

    // Further steps (answered, closed) should remain disabled
    const skippedBtn = screen.getByLabelText(/Step 4: Answered — upcoming/i)
    expect(skippedBtn.getAttribute('disabled')).toBeDefined()
  })

  it('completed steps are not clickable', () => {
    const onTransition = vi.fn()
    render(
      <WorkflowTimeline
        states={STATES}
        currentState="under_review"
        completedStates={['draft', 'open']}
        labels={LABELS}
        onTransition={onTransition}
      />,
    )
    const completedBtn = screen.getByLabelText(/Step 1: Draft — completed/i)
    fireEvent.click(completedBtn)
    expect(onTransition).not.toHaveBeenCalled()
  })

  it('falls back to title-cased state name when no labels provided', () => {
    render(
      <WorkflowTimeline
        states={['draft', 'under_review', 'closed']}
        currentState="under_review"
        completedStates={['draft']}
      />,
    )
    expect(screen.getByText('Draft')).toBeDefined()
    expect(screen.getByText('Under Review')).toBeDefined()
    expect(screen.getByText('Closed')).toBeDefined()
  })
})
