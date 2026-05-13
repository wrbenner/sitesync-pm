// src/pages/Settings/Billing.tsx — BRT subsystem 4 §4.5
//
// Billing dashboard. Surfaces the active org's plan, status, period, and
// "Manage Billing" CTA (opens Stripe Customer Portal). Trial banner +
// paused-account banner live in src/components/billing/.
//
// All price strings are derived from the plans table — never hardcoded.

import { useState } from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useSubscription } from '../../hooks/useSubscription'
import { useActiveOrg } from '../../hooks/useActiveOrg'
import { getPlans, createPortalSession } from '../../services/billing'
import { TrialBanner } from '../../components/billing/TrialBanner'
import { PausedAccountBanner } from '../../components/billing/PausedAccountBanner'
import { CancelModal } from '../../components/billing/CancelModal'
import { colors, spacing, typography, borderRadius } from '../../styles/theme'
import { centsToDisplay } from '../../types/money'

export default function Billing() {
  const { subscription, loading } = useSubscription()
  const { orgId } = useActiveOrg()
  const [portalError, setPortalError] = useState<string | null>(null)
  const [portalOpening, setPortalOpening] = useState(false)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)

  const { data: plans } = useQuery({
    queryKey: ['billing', 'plans'],
    queryFn: getPlans,
    staleTime: 5 * 60_000,
  })

  const activePlan = subscription
    ? plans?.find((p) => p.id === subscription.planId) ?? null
    : null

  const openPortal = async () => {
    if (!orgId) return
    setPortalError(null)
    setPortalOpening(true)
    const result = await createPortalSession(orgId).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : 'Unknown error'
      setPortalError(`Couldn't open the billing portal: ${msg}`)
      return null
    })
    setPortalOpening(false)
    if (result?.url) {
      window.location.href = result.url
    }
  }

  if (loading) {
    return (
      <div style={{ padding: spacing['8'], textAlign: 'center', color: colors.textSecondary }}>
        <Loader2 size={20} style={{ animation: 'spin-loader 0.8s linear infinite' }} />
        <style>{`@keyframes spin-loader { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const status = subscription?.status ?? 'none'
  const statusLabel: Record<string, string> = {
    active: 'Active',
    trialing: 'Trial',
    past_due: 'Past due',
    paused: 'Paused',
    canceled: 'Canceled',
    none: 'No subscription',
  }
  const statusColor: Record<string, string> = {
    active: '#0E6F4D',
    trialing: '#1E3A8A',
    past_due: '#B45309',
    paused: '#B91C1C',
    canceled: '#5C5C5C',
    none: '#5C5C5C',
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: spacing['6'] }}>
      <h1
        style={{
          fontFamily: '"EB Garamond", Garamond, serif',
          fontStyle: 'italic',
          fontSize: 32,
          fontWeight: 500,
          color: colors.textPrimary,
          margin: 0,
          marginBottom: spacing['2'],
          letterSpacing: '-0.01em',
        }}
      >
        Billing
      </h1>
      <p style={{ color: colors.textSecondary, marginTop: 0, marginBottom: spacing['6'] }}>
        Manage your plan, invoices, and payment method.
      </p>

      <TrialBanner />
      <PausedAccountBanner />

      <div
        style={{
          padding: spacing['6'],
          background: colors.surfaceRaised,
          border: `1px solid ${colors.borderDefault}`,
          borderRadius: borderRadius.lg,
          marginBottom: spacing['4'],
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing['4'] }}>
          <div>
            <p style={{ margin: 0, color: colors.textTertiary, fontSize: typography.fontSize.sm, letterSpacing: typography.letterSpacing.wide, textTransform: 'uppercase' }}>
              Current plan
            </p>
            <h2 style={{ margin: `${spacing['1']} 0 0`, fontSize: 22, color: colors.textPrimary }}>
              {activePlan?.name ?? 'No active plan'}
            </h2>
          </div>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              fontSize: typography.fontSize.sm,
              fontWeight: 600,
              background: '#F3F4F6',
              color: statusColor[status],
            }}
          >
            {statusLabel[status]}
          </span>
        </div>

        {activePlan && (
          <>
            <p style={{ margin: 0, marginBottom: spacing['1'], color: colors.textSecondary }}>
              {activePlan.description}
            </p>
            <p style={{ margin: 0, marginBottom: spacing['4'], color: colors.textPrimary, fontSize: 18, fontWeight: 600 }}>
              {subscription?.billingCycle === 'annual'
                ? `${centsToDisplay(activePlan.priceAnnual)} / year`
                : `${centsToDisplay(activePlan.priceMonthly)} / month`}
            </p>
          </>
        )}

        {subscription?.currentPeriodEnd && (
          <p style={{ margin: 0, marginBottom: spacing['4'], color: colors.textTertiary, fontSize: typography.fontSize.sm }}>
            Next billing date: {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
          </p>
        )}

        <div style={{ display: 'flex', gap: spacing['3'] }}>
          <button
            type="button"
            onClick={openPortal}
            disabled={portalOpening || !orgId}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: spacing['2'],
              padding: '10px 18px',
              background: colors.primaryOrange,
              color: colors.white,
              border: 'none',
              borderRadius: borderRadius.md,
              fontWeight: 600,
              fontSize: typography.fontSize.body,
              cursor: portalOpening ? 'wait' : 'pointer',
              opacity: portalOpening ? 0.7 : 1,
            }}
          >
            {portalOpening ? <Loader2 size={16} /> : <ExternalLink size={16} />}
            Manage billing
          </button>

          {subscription && status !== 'canceled' && (
            <button
              type="button"
              onClick={() => setCancelModalOpen(true)}
              style={{
                padding: '10px 18px',
                background: 'transparent',
                color: colors.textSecondary,
                border: `1px solid ${colors.borderDefault}`,
                borderRadius: borderRadius.md,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              Cancel subscription
            </button>
          )}
        </div>

        {portalError && (
          <p role="alert" style={{ marginTop: spacing['3'], color: colors.statusCritical, fontSize: typography.fontSize.sm }}>
            {portalError}
          </p>
        )}
      </div>

      <CancelModal
        open={cancelModalOpen}
        onClose={() => setCancelModalOpen(false)}
        onConfirmed={openPortal}
      />
    </div>
  )
}
