// ────────────────────────────────────────────────────────────────────────────
// CancelWindowBanner — in-app 60-second cancel surface
// ────────────────────────────────────────────────────────────────────────────
// Spec: docs/audits/AUTO_EXECUTE_CANCEL_WINDOW_SPEC_2026-05-04.md
//
// Shown when a hardened executor enters the 60-second cancel window. Wraps
// the pure `evaluateCancelWindow` timer so all 5 cancel surfaces (in-app
// banner, mobile push, email, SMS, desktop notification) read the same
// authority on whether the window is still open.

import { useEffect, useMemo, useState } from 'react'

import { evaluateCancelWindow, type CancelWindowState } from '../../services/iris/cancelWindow'
import { spacing } from '../../styles/theme'

export interface CancelWindowBannerProps {
  /** ISO timestamp when the executor's decision was emitted. */
  decided_at: string
  /** Friendly description of the pending action (renders in the banner copy). */
  action_label: string
  /** Caller's cancel handler. Called when the user taps Cancel. */
  on_cancel: () => Promise<void> | void
  /** Called once when the window expires without a cancel (auto-commit). */
  on_commit?: () => void
}

export function CancelWindowBanner({
  decided_at,
  action_label,
  on_cancel,
  on_commit,
}: CancelWindowBannerProps) {
  const [now, setNow] = useState(() => Date.now())
  const [cancelling, setCancelling] = useState(false)

  const state: CancelWindowState = useMemo(
    () => evaluateCancelWindow({ decided_at, now }),
    [decided_at, now],
  )

  useEffect(() => {
    if (state.status !== 'pending') return
    const interval = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(interval)
  }, [state.status])

  useEffect(() => {
    if (state.status === 'committed') on_commit?.()
  }, [state.status, on_commit])

  if (state.status !== 'pending') return null

  const secondsRemaining = Math.ceil(state.ms_remaining / 1000)

  async function handleCancel() {
    setCancelling(true)
    try {
      await on_cancel()
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      data-testid="cancel-window-banner"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing[4],
        padding: spacing[3],
        borderRadius: 8,
        background: 'var(--color-surface-inset, #fff7e6)',
        borderLeft: '4px solid var(--color-warning, #f5a623)',
        fontSize: '0.95rem',
      }}
    >
      <div>
        <strong>{action_label}</strong> will commit in {secondsRemaining}s. Tap Cancel to stop.
      </div>
      <button
        type="button"
        disabled={cancelling}
        onClick={handleCancel}
        data-testid="cancel-window-cancel-button"
        style={{
          minHeight: 56,
          minWidth: 120,
          padding: `0 ${spacing[4]}`,
          borderRadius: 8,
          border: 'none',
          background: 'var(--color-primary, #c84a00)',
          color: '#fff',
          fontWeight: 600,
          cursor: cancelling ? 'wait' : 'pointer',
        }}
      >
        {cancelling ? 'Cancelling…' : 'Cancel'}
      </button>
    </div>
  )
}
