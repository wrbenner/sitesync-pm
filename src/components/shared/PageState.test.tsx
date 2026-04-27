import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { PageState } from './PageState'

describe('PageState', () => {
  it('renders skeleton rows when status is loading', () => {
    render(<PageState status="loading" loading={{ rows: 4, ariaLabel: 'Loading RFIs' }} />)
    expect(screen.getByRole('status', { name: /loading rfis/i })).toBeDefined()
    expect(screen.getByRole('status').getAttribute('aria-busy')).toBe('true')
  })

  it('renders the empty state with title and CTA when status is empty', () => {
    const onClick = vi.fn()
    render(
      <PageState
        status="empty"
        empty={{
          title: 'No RFIs yet',
          description: 'Create your first RFI to get a documented question to the design team.',
          cta: { label: 'New RFI', onClick },
        }}
      />,
    )
    expect(screen.getByText('No RFIs yet')).toBeDefined()
    const btn = screen.getByRole('button', { name: /new rfi/i })
    expect(btn).toBeDefined()
    fireEvent.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('renders both primary and secondary CTAs when supplied', () => {
    const onPrimary = vi.fn()
    const onSecondary = vi.fn()
    render(
      <PageState
        status="empty"
        empty={{
          title: 'No projects',
          cta: { label: 'New project', onClick: onPrimary },
          secondaryCta: { label: 'Import from Procore', onClick: onSecondary },
        }}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /new project/i }))
    fireEvent.click(screen.getByRole('button', { name: /import from procore/i }))
    expect(onPrimary).toHaveBeenCalledTimes(1)
    expect(onSecondary).toHaveBeenCalledTimes(1)
  })

  it('renders the error state with retry handler when status is error', () => {
    const onRetry = vi.fn()
    render(
      <PageState
        status="error"
        error={{ title: 'Unable to load RFIs', message: 'Network blip', onRetry }}
      />,
    )
    expect(screen.getByText('Unable to load RFIs')).toBeDefined()
    expect(screen.getByText('Network blip')).toBeDefined()
    const btn = screen.getByRole('button', { name: /retry/i })
    fireEvent.click(btn)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('hides the retry button when no onRetry is provided', () => {
    render(
      <PageState
        status="error"
        error={{ title: 'Unable to load', message: 'Permission denied' }}
      />,
    )
    expect(screen.queryByRole('button', { name: /retry/i })).toBeNull()
  })

  it('shows retrying copy + disables button when retrying is true', () => {
    render(
      <PageState
        status="error"
        error={{ message: 'Network error', onRetry: () => {}, retrying: true }}
      />,
    )
    const btn = screen.getByRole('button', { name: /retrying/i }) as HTMLButtonElement
    expect(btn.disabled).toBe(true)
  })

  it('renders children when status is ready', () => {
    render(
      <PageState status="ready">
        <div data-testid="real-content">Hello world</div>
      </PageState>,
    )
    expect(screen.getByTestId('real-content').textContent).toBe('Hello world')
  })

  it('renders nothing for empty status when no empty config provided (graceful fallback)', () => {
    const { container } = render(<PageState status="empty" />)
    expect(container.textContent).toBe('')
  })

  it('error alert has role=alert for screen-reader announcement', () => {
    render(<PageState status="error" error={{ message: 'Down' }} />)
    expect(screen.getByRole('alert')).toBeDefined()
  })
})
