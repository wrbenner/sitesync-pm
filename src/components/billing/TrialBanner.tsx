// src/components/billing/TrialBanner.tsx — BRT sub-4 §4.5
//
// Light info banner shown only while subscription.status === 'trialing'.
// Shows days remaining. SubscriptionBanner already shows the "ending soon"
// urgent variant; this one is the friendly always-on trial indicator.

import { useSubscription } from '../../hooks/useSubscription'

export function TrialBanner() {
  const { subscription, trialDaysRemaining } = useSubscription()
  if (!subscription || subscription.status !== 'trialing') return null
  if (trialDaysRemaining === null) return null

  return (
    <div
      role="status"
      style={{
        marginBottom: 16,
        padding: '10px 14px',
        background: '#EEF4FF',
        border: '1px solid #BFDBFE',
        borderRadius: 8,
        color: '#1E3A8A',
        fontSize: 14,
        lineHeight: 1.45,
      }}
    >
      You're on a free trial: <strong>{trialDaysRemaining} day{trialDaysRemaining === 1 ? '' : 's'}</strong> remaining.
      Add a payment method in the billing portal to keep access after the trial ends.
    </div>
  )
}

export default TrialBanner
