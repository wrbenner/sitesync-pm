import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WorkflowTimeline } from './WorkflowTimeline'

const STATES = ['draft', 'submitted', 'under_review', 'answered', 'closed']

describe('WorkflowTimeline', () => {
  it('renders a progressbar with correct aria attributes', () => {
    render(
      <WorkflowTimeline
        states={STATES}
        currentState="submitted"
        completedStates={['draft']}
      />,
    )
    const bar = screen.getByRole('progressbar')
    expect(bar).toBeDefined()
    expect(bar.getAttribute('aria-valuenow')).toBe('1')
    expect(bar.getAttribute('aria-valuemin')).toBe('0')
    expect(bar.getAttribute('aria-valuemax')).toBe('4')
  })

  it('labels completed steps correctly', () => {
    render(
      <WorkflowTimeline
        states={STATES}
        currentState="submitted"
        completedStates={['draft']}
      />,
    )
    expect(
      screen.getByLabelText(/step 1: draft — completed/i),
    ).toBeDefined()
  })

  it('labels the current step correctly', () => {
    render(
      <WorkflowTimeline
        states={STATES}
        currentState="submitted"
        completedStates={['draft']}
      />,
    )
    expect(
      screen.getByLabelText(/step 2: submitted — current/i),
    ).toBeDefined()
  })

  it('labels upcoming steps correctly', () => {
    render(
      <WorkflowTimeline
        states={STATES}
        currentState="submitted"
        completedStates={['draft']}
      />,
    )
    expect(
      screen.getByLabelText(/step 3: under review — upcoming/i),
    ).toBeDefined()
  })

  it('fires onTransition only for the next step', () => {
    const onTransition = vi.fn()
    render(
      <WorkflowTimeline
        states={STATES}
        currentState="submitted"
        completedStates={['draft']}
        onTransition={onTransition}
      />,
    )
    // Next step is index 2 (under_review) — should fire
    const nextBtn = screen.getByLabelText(/step 3: under review — upcoming/i)
    fireEvent.click(nextBtn)
    expect(onTransition).toHaveBeenCalledWith('under_review')
    expect(onTransition).toHaveBeenCalledTimes(1)
  })

  it('does not fire onTransition for steps beyond next', () => {
    const onTransition = vi.fn()
    render(
      <WorkflowTimeline
        states={STATES}
        currentState="submitted"
        completedStates={['draft']}
        onTransition={onTransition}
      />,
    )
    // Two steps ahead (answered) — should NOT fire
    const futureBtn = screen.getByLabelText(/step 4: answered — upcoming/i)
    fireEvent.click(futureBtn)
    expect(onTransition).not.toHaveBeenCalled()
  })

  it('renders correct step count', () => {
    render(
      <WorkflowTimeline
        states={STATES}
        currentState="draft"
        completedStates={[]}
      />,
    )
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(STATES.length)
  })

  it('handles currentState not in states list gracefully', () => {
    render(
      <WorkflowTimeline
        states={STATES}
        currentState="void"
        completedStates={[]}
      />,
    )
    const bar = screen.getByRole('progressbar')
    expect(bar.getAttribute('aria-valuenow')).toBe('0')
  })
})
