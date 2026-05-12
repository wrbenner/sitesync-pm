// src/hooks/useSubscription.ts — BRT subsystem 4 §4.5
//
// Shared accessor for the active org's subscription. Wraps getSubscription
// in a React Query cache so all components — banners, gates, settings —
// share one fetch + automatic refetch on org switch.

import { useQuery } from '@tanstack/react-query'
import { getSubscription, type Subscription } from '../services/billing'
import { useAuthStore } from '../stores/authStore'

export interface UseSubscriptionResult {
  subscription: Subscription | null
  loading: boolean
  /** True if subscription is in any non-active state (past_due, paused, canceled). */
  isReadOnly: boolean
  /** True if status='trialing' AND trialEndsAt is within `trialEndingSoonDays` days. */
  isTrialEndingSoon: boolean
  /** Days remaining in trial; null when not trialing. */
  trialDaysRemaining: number | null
}

const TRIAL_ENDING_SOON_DAYS = 3

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (Number.isNaN(ms)) return null
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

export function useSubscription(): UseSubscriptionResult {
  const orgId = useAuthStore((s) => s.organization?.id ?? null)

  const query = useQuery<Subscription | null>({
    queryKey: ['billing', 'subscription', orgId],
    queryFn: async () => {
      if (!orgId) return null
      return await getSubscription(orgId)
    },
    enabled: !!orgId,
    staleTime: 60_000, // 1 minute — subscription state rarely changes
  })

  const subscription = query.data ?? null
  const status = subscription?.status

  // Read-only states. 'canceled' is also included so the UI can prompt the
  // user to start a new trial; the actual access cutoff is enforced by RLS
  // when current_period_end passes.
  const isReadOnly = status === 'past_due' || status === 'paused' || status === 'canceled'

  const trialDaysRemaining = status === 'trialing'
    ? daysUntil(subscription?.trialEndsAt ?? null)
    : null

  const isTrialEndingSoon = trialDaysRemaining !== null && trialDaysRemaining <= TRIAL_ENDING_SOON_DAYS

  return {
    subscription,
    loading: query.isPending,
    isReadOnly,
    isTrialEndingSoon,
    trialDaysRemaining,
  }
}
