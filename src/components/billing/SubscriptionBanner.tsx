// src/components/billing/SubscriptionBanner.tsx — BRT sub-4 §4.6
//
// Single global banner that surfaces the subscription's worst-case state.
// Renders nothing when subscription is healthy.
//
// States (priority highest first):
//   1. paused        — subscription paused (post-dunning); strong red warning
//   2. past_due      — payment failed; amber warning
//   3. canceled      — past or in grace period; gray informational
//   4. trial_ending  — trialing with ≤ 3 days left; blue informational
//
// Routed link goes to /settings/billing where the user can open Stripe
// portal to update payment / restart trial.

import { Link } from 'react-router-dom'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { useSubscription } from '../../hooks/useSubscription'

interface BannerStyle {
  bg: string
  border: string
  text: string
  cta: string
}

const PALETTE: Record<'red' | 'amber' | 'gray' | 'blue', BannerStyle> = {
  red:   { bg: colors.statusCriticalSubtle, border: colors.statusCritical, text: colors.statusCritical,  cta: colors.statusCritical },
  amber: { bg: colors.statusPendingSubtle,  border: colors.statusPending,  text: colors.statusPending,   cta: colors.statusPending },
  gray:  { bg: colors.surfaceInset,         border: colors.borderSubtle,   text: colors.textPrimary,     cta: colors.textPrimary },
  blue:  { bg: colors.statusInfoSubtle,     border: colors.statusInfo,     text: colors.statusInfo,      cta: colors.statusInfo },
}

export default function SubscriptionBanner() {
  const { subscription, isTrialEndingSoon, trialDaysRemaining } = useSubscription()
  if (!subscription) return null

  let palette: keyof typeof PALETTE = 'blue'
  let title = ''
  let body = ''
  let ctaLabel = 'Manage billing'

  if (subscription.status === 'paused') {
    palette = 'red'
    title = 'Your subscription is paused'
    body = 'Update your payment method to restore access to writes. Reads continue to work.'
    ctaLabel = 'Update payment method'
  } else if (subscription.status === 'past_due') {
    palette = 'amber'
    title = 'Your last payment didn’t go through'
    body = 'We’re retrying automatically. Update your payment method to avoid a pause on day 8.'
    ctaLabel = 'Update payment method'
  } else if (subscription.status === 'canceled') {
    palette = 'gray'
    title = 'Subscription canceled'
    body = 'Your data stays accessible for 60 days. Restart anytime.'
    ctaLabel = 'Restart subscription'
  } else if (isTrialEndingSoon && trialDaysRemaining !== null) {
    palette = 'blue'
    title = trialDaysRemaining === 0
      ? 'Your trial ends today'
      : `Your trial ends in ${trialDaysRemaining} day${trialDaysRemaining === 1 ? '' : 's'}`
    body = 'You’ll be charged automatically. Cancel anytime via the billing portal.'
    ctaLabel = 'Manage billing'
  } else {
    return null
  }

  const style = PALETTE[palette]

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="subscription-banner"
      style={{
        background: style.bg,
        borderBottom: `1px solid ${style.border}`,
        color: style.text,
        padding: `${spacing['2']} ${spacing['4']}`,
        display: 'flex',
        alignItems: 'center',
        gap: spacing['3'],
        fontSize: typography.fontSize.sm,
        fontFamily: typography.fontFamily,
      }}
    >
      <div style={{ flex: '1 1 auto' }}>
        <strong style={{ marginRight: spacing['2'] }}>{title}.</strong>
        <span style={{ opacity: 0.85 }}>{body}</span>
      </div>
      <Link
        to="/settings/billing"
        style={{
          background: style.cta,
          color: colors.white,
          textDecoration: 'none',
          padding: `${spacing['1']} ${spacing['3']}`,
          borderRadius: borderRadius.base,
          fontWeight: typography.fontWeight.semibold,
          fontSize: typography.fontSize.sm,
          fontFamily: typography.fontFamily,
          whiteSpace: 'nowrap',
        }}
      >
        {ctaLabel}
      </Link>
    </div>
  )
}

// `isReadOnly` from useSubscription is consumed by route-level mutate gates
// elsewhere. The banner itself doesn't need it for its own render.
