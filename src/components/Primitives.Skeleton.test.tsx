import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { Skeleton, EmptyState, Modal } from './Primitives'

describe('Skeleton — variant rendering', () => {
  it('default variant uses rect styling (8px radius)', () => {
    const { container } = render(<Skeleton />)
    const sk = container.firstChild as HTMLElement
    expect(sk.style.borderRadius).toBe('8px')
    expect(sk.style.height).toBe('20px')
  })

  it('text variant uses 14px height + 4px radius', () => {
    const { container } = render(<Skeleton variant="text" />)
    const sk = container.firstChild as HTMLElement
    expect(sk.style.height).toBe('14px')
    expect(sk.style.borderRadius).toBe('4px')
  })

  it('circle variant uses 50% radius (perfect circle)', () => {
    const { container } = render(<Skeleton variant="circle" />)
    expect((container.firstChild as HTMLElement).style.borderRadius).toBe('50%')
  })

  it('honours explicit width and height props', () => {
    const { container } = render(<Skeleton width="200px" height="40px" />)
    const sk = container.firstChild as HTMLElement
    expect(sk.style.width).toBe('200px')
    expect(sk.style.height).toBe('40px')
  })

  it('honours explicit borderRadius override on text variant', () => {
    const { container } = render(<Skeleton variant="text" borderRadius="0px" />)
    expect((container.firstChild as HTMLElement).style.borderRadius).toBe('0px')
  })

  it('aria-hidden="true" so the loading shimmer is not announced by screen readers', () => {
    const { container } = render(<Skeleton />)
    expect((container.firstChild as HTMLElement).getAttribute('aria-hidden')).toBe('true')
  })

  it('uses skeletonPulse animation (visual shimmer)', () => {
    const { container } = render(<Skeleton />)
    expect((container.firstChild as HTMLElement).style.animation).toContain('skeletonPulse')
  })
})

describe('EmptyState — content + CTA', () => {
  it('renders title + description', () => {
    const { getByText } = render(
      <EmptyState title="No RFIs yet" description="Create your first RFI to get started." />,
    )
    expect(getByText('No RFIs yet')).toBeTruthy()
    expect(getByText(/Create your first RFI/)).toBeTruthy()
  })

  it('renders an action button when actionLabel + onAction are supplied', () => {
    const onAction = vi.fn()
    const { getByText } = render(
      <EmptyState title="x" description="y" actionLabel="New RFI" onAction={onAction} />,
    )
    const btn = getByText('New RFI')
    fireEvent.click(btn)
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('renders a secondary action when secondaryActionLabel + onSecondaryAction are supplied', () => {
    const onPrimary = vi.fn()
    const onSecondary = vi.fn()
    const { getByText } = render(
      <EmptyState
        title="x" description="y"
        actionLabel="Primary" onAction={onPrimary}
        secondaryActionLabel="Import" onSecondaryAction={onSecondary}
      />,
    )
    fireEvent.click(getByText('Primary'))
    fireEvent.click(getByText('Import'))
    expect(onPrimary).toHaveBeenCalledTimes(1)
    expect(onSecondary).toHaveBeenCalledTimes(1)
  })

  it('omits action button when onAction is not supplied', () => {
    const { queryByText } = render(
      <EmptyState title="x" description="y" actionLabel="New" />,
    )
    // actionLabel without onAction → no button rendered
    expect(queryByText('New')).toBeNull()
  })
})

describe('Modal — open / close lifecycle', () => {
  it('returns null when open=false (no DOM rendered)', () => {
    const { container } = render(<Modal open={false} onClose={() => {}} title="X">body</Modal>)
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('renders dialog with role="dialog" + aria-modal="true" when open=true', () => {
    const { getByRole } = render(<Modal open={true} onClose={() => {}} title="X">body</Modal>)
    const dialog = getByRole('dialog')
    expect(dialog.getAttribute('aria-modal')).toBe('true')
  })

  it('renders the title in the dialog', () => {
    const { getByText } = render(<Modal open={true} onClose={() => {}} title="My Modal">body</Modal>)
    expect(getByText('My Modal')).toBeTruthy()
  })

  it('renders children inside the dialog', () => {
    const { getByText } = render(
      <Modal open={true} onClose={() => {}} title="X"><p>Modal body</p></Modal>,
    )
    expect(getByText('Modal body')).toBeTruthy()
  })

  it('clicking the backdrop fires onClose', () => {
    const onClose = vi.fn()
    const { getByRole } = render(<Modal open={true} onClose={onClose} title="X">body</Modal>)
    // The backdrop is the parent of the dialog
    const dialog = getByRole('dialog')
    fireEvent.click(dialog.parentElement!)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Escape key fires onClose (a11y modal-dismiss invariant)', () => {
    const onClose = vi.fn()
    render(<Modal open={true} onClose={onClose} title="X">body</Modal>)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('locks body scroll while open', () => {
    document.body.style.overflow = ''
    const { unmount } = render(<Modal open={true} onClose={() => {}} title="X">body</Modal>)
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('')
  })
})
