// src/components/billing/PausedAccountBanner.tsx — BRT sub-4 §4.6
//
// Strong-warning banner shown when subscription.status is past_due or paused.
// Tells the user the org is in read-only mode and what to do.
//
// Read-only enforcement itself happens at RLS via is_org_writable() — this
// banner is purely the human-facing explanation.

import { useSubscription } from '../../hooks/useSubscription'

export function PausedAccountBanner() {
  const { subscription } = useSubscription()
  const status = subscription?.status
  if (status !== 'past_due' && status !== 'paused') return null

  const isPaused = status === 'paused'

  return (
    <div
      role="alert"
      style={{
        marginBottom: 16,
        padding: '12px 14px',
        background: '#FEE2E2',
        border: '1px solid #FCA5A5',
        borderRadius: 8,
        color: '#7F1D1D',
        fontSize: 14,
        lineHeight: 1.5,
      }}
    >
      <strong>{isPaused ? 'Your account is paused.' : 'Your payment failed.'}</strong>{' '}
      Your workspace is in <strong>read-only mode</strong>. Existing data is
      visible, but new RFIs, submittals, daily logs, and edits are blocked
      until billing is restored. Click <em>Manage billing</em> below to
      update your payment method.
    </div>
  )
}

export default PausedAccountBanner
