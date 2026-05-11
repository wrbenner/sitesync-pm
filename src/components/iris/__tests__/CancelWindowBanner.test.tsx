// ────────────────────────────────────────────────────────────────────────────
// CancelWindowBanner tests
// ────────────────────────────────────────────────────────────────────────────

import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CancelWindowBanner } from '../CancelWindowBanner'
import { CANCEL_WINDOW_DURATION_MS } from '../../../services/iris/cancelWindow'

describe('CancelWindowBanner', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-05-11T12:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the action label and seconds remaining while pending', () => {
    render(
      <CancelWindowBanner
        decided_at="2026-05-11T12:00:00.000Z"
        action_label="Routing RFI #42 to Casey"
        on_cancel={() => Promise.resolve()}
      />,
    )
    const banner = screen.getByTestId('cancel-window-banner')
    expect(banner.textContent).toContain('Routing RFI #42 to Casey')
    expect(banner.textContent).toMatch(/will commit in \d+s/)
  })

  it('hides when the 60-second window expires and calls on_commit', () => {
    const on_commit = vi.fn()
    render(
      <CancelWindowBanner
        decided_at="2026-05-11T12:00:00.000Z"
        action_label="X"
        on_cancel={() => Promise.resolve()}
        on_commit={on_commit}
      />,
    )
    expect(screen.getByTestId('cancel-window-banner')).toBeTruthy()
    act(() => {
      vi.advanceTimersByTime(CANCEL_WINDOW_DURATION_MS + 250)
    })
    expect(screen.queryByTestId('cancel-window-banner')).toBeNull()
    expect(on_commit).toHaveBeenCalledTimes(1)
  })

  it('button has a 56px minimum height for gloved-hand targets', () => {
    render(
      <CancelWindowBanner
        decided_at="2026-05-11T12:00:00.000Z"
        action_label="X"
        on_cancel={() => Promise.resolve()}
      />,
    )
    const btn = screen.getByTestId('cancel-window-cancel-button') as HTMLButtonElement
    expect(btn.style.minHeight).toBe('56px')
  })
})
