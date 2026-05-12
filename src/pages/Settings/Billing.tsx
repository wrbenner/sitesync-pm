// src/pages/settings/Billing.tsx — BRT sub-4 §4.5
//
// Org owner / admin self-serve subscription management. Shows:
//   - Current plan + status (active / trialing / paused / canceled)
//   - Trial countdown if status='trialing'
//   - Next invoice date + amount
//   - "Manage payment / invoices / cancel" → Stripe Portal
//   - "Start trial" if no subscription yet
//
// Defers all money + payment-method operations to Stripe Customer Portal —
// we don't reinvent that UI.

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '../../stores/authStore'
import {
  getSubscription,
  getPlans,
  startTrialCheckout,
  openBillingPortal,
  type Subscription,
  type Plan,
} from '../../services/billing'
import { centsToDisplay } from '../../types/money'

type Status = Subscription['status']

const STATUS_COPY: Record<Status, { label: string; color: string }> = {
  active:   { label: 'Active',     color: '#15803D' }, // green-700
  trialing: { label: 'Trial',      color: '#0066FF' }, // brand accent
  past_due: { label: 'Past due',   color: '#B45309' }, // amber-700
  paused:   { label: 'Paused',     color: '#B91C1C' }, // red-700
  canceled: { label: 'Canceled',   color: '#5C5C5C' }, // mid gray
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  if (Number.isNaN(ms)) return null
  return Math.max(0, Math.ceil(ms / 86_400_000))
}

export default function BillingSettings() {
  const { organization, currentOrgRole } = useAuthStore()
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isAdmin = currentOrgRole === 'owner' || currentOrgRole === 'admin'

  // BRT sub-4 §4.5: react-query for data load. Avoids setState-in-effect
  // and gets retry + cache + automatic refetch on the org switch for free.
  const subQuery = useQuery<Subscription | null>({
    queryKey: ['billing', 'subscription', organization?.id],
    queryFn: async () => {
      if (!organization) return null
      return await getSubscription(organization.id)
    },
    enabled: !!organization,
  })
  const planQuery = useQuery<Plan | null>({
    queryKey: ['billing', 'plan', subQuery.data?.planId ?? null],
    queryFn: async () => {
      const planId = subQuery.data?.planId
      if (!planId) return null
      const plans = await getPlans()
      return plans.find((p) => p.id === planId) ?? null
    },
    enabled: !!subQuery.data?.planId,
  })

  const sub: Subscription | null | 'loading' = subQuery.isPending ? 'loading' : (subQuery.data ?? null)
  const plan = planQuery.data ?? null

  const startTrial = async (cycle: 'monthly' | 'annual') => {
    setPending(`trial:${cycle}`)
    setError(null)
    try {
      const { sessionUrl } = await startTrialCheckout(cycle)
      window.location.assign(sessionUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start checkout')
      setPending(null)
    }
  }

  const openPortal = async () => {
    setPending('portal')
    setError(null)
    try {
      const { portalUrl } = await openBillingPortal()
      window.location.assign(portalUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open billing portal')
      setPending(null)
    }
  }

  if (!organization) {
    return (
      <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
        <p style={{ color: '#5C5C5C' }}>Pick an organization to manage billing.</p>
      </main>
    )
  }

  if (sub === 'loading') {
    return (
      <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
        <p style={{ color: '#5C5C5C' }}>Loading billing…</p>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 720, margin: '0 auto', padding: 24 }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Billing</h1>
      <p style={{ color: '#5C5C5C', marginBottom: 24 }}>
        Manage your subscription, payment method, and invoices.
      </p>

      {!isAdmin && (
        <div style={{
          padding: 12, marginBottom: 16,
          background: '#FEF3C7', border: '1px solid #FCD34D', borderRadius: 6,
          color: '#78350F', fontSize: 14,
        }}>
          Read-only view — only org owners and admins can manage billing.
        </div>
      )}

      {error && (
        <div style={{
          padding: 12, marginBottom: 16,
          background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: 6,
          color: '#7F1D1D', fontSize: 14,
        }}>{error}</div>
      )}

      {sub === null ? (
        <NoSubscription onStartTrial={startTrial} pending={pending} disabled={!isAdmin} />
      ) : (
        <ActiveSubscription
          sub={sub}
          plan={plan}
          onOpenPortal={openPortal}
          pending={pending}
          disabled={!isAdmin}
        />
      )}
    </main>
  )
}

function NoSubscription({
  onStartTrial,
  pending,
  disabled,
}: {
  onStartTrial: (cycle: 'monthly' | 'annual') => void
  pending: string | null
  disabled: boolean
}) {
  return (
    <section style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: 24 }}>
      <h2 style={{ fontSize: 18, marginBottom: 8 }}>Start your 14-day trial</h2>
      <p style={{ color: '#5C5C5C', marginBottom: 16 }}>
        Card required upfront. Cancel anytime during the trial — no charge.
        Annual prepay saves 15%.
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          type="button"
          onClick={() => onStartTrial('monthly')}
          disabled={disabled || pending !== null}
          style={{
            padding: '10px 20px',
            background: '#0066FF', color: 'white',
            border: 'none', borderRadius: 6, fontWeight: 600,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {pending === 'trial:monthly' ? 'Starting…' : 'Trial — $400/mo'}
        </button>
        <button
          type="button"
          onClick={() => onStartTrial('annual')}
          disabled={disabled || pending !== null}
          style={{
            padding: '10px 20px',
            background: 'white', color: '#0066FF',
            border: '1px solid #0066FF', borderRadius: 6, fontWeight: 600,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
          }}
        >
          {pending === 'trial:annual' ? 'Starting…' : 'Trial — $4,080/yr (save 15%)'}
        </button>
      </div>
    </section>
  )
}

function ActiveSubscription({
  sub,
  plan,
  onOpenPortal,
  pending,
  disabled,
}: {
  sub: Subscription
  plan: Plan | null
  onOpenPortal: () => void
  pending: string | null
  disabled: boolean
}) {
  const status = STATUS_COPY[sub.status]
  const trialDays = sub.status === 'trialing' ? daysUntil(sub.trialEndsAt) : null
  const renewDays = daysUntil(sub.currentPeriodEnd)
  const priceForCycle = sub.billingCycle === 'annual' ? plan?.priceAnnual : plan?.priceMonthly
  const cycleLabel = sub.billingCycle === 'annual' ? 'year' : 'month'

  return (
    <>
      <section style={{ border: '1px solid #E5E7EB', borderRadius: 8, padding: 24, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, color: '#5C5C5C', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              {plan?.name ?? sub.planId}
            </div>
            {priceForCycle !== undefined && (
              <div style={{ fontSize: 24, fontWeight: 600, marginTop: 4 }}>
                {centsToDisplay(priceForCycle)} <span style={{ fontSize: 14, color: '#5C5C5C', fontWeight: 400 }}>/ {cycleLabel}</span>
              </div>
            )}
          </div>
          <span style={{
            padding: '4px 10px',
            background: `${status.color}20`,
            color: status.color,
            borderRadius: 4,
            fontSize: 13,
            fontWeight: 600,
          }}>{status.label}</span>
        </div>

        {trialDays !== null && (
          <p style={{ color: '#5C5C5C', fontSize: 14, marginTop: 12 }}>
            {trialDays > 0
              ? `Trial ends in ${trialDays} day${trialDays === 1 ? '' : 's'}.`
              : 'Trial ends today.'}
            {' '}You'll be charged automatically when it ends. Cancel anytime via the billing portal.
          </p>
        )}

        {sub.status === 'active' && renewDays !== null && (
          <p style={{ color: '#5C5C5C', fontSize: 14, marginTop: 12 }}>
            Renews in {renewDays} day{renewDays === 1 ? '' : 's'} ({new Date(sub.currentPeriodEnd).toLocaleDateString()}).
          </p>
        )}

        {sub.status === 'past_due' && (
          <p style={{ color: '#B45309', fontSize: 14, marginTop: 12 }}>
            Your last payment didn't go through. Update your payment method
            below to keep your account active.
          </p>
        )}

        {sub.status === 'paused' && (
          <p style={{ color: '#B91C1C', fontSize: 14, marginTop: 12 }}>
            Your subscription is paused. Update your payment method to
            restore access.
          </p>
        )}

        {sub.status === 'canceled' && sub.canceledAt && (
          <p style={{ color: '#5C5C5C', fontSize: 14, marginTop: 12 }}>
            Subscription canceled on {new Date(sub.canceledAt).toLocaleDateString()}.
            Your data stays accessible for 60 days.
          </p>
        )}
      </section>

      <button
        type="button"
        onClick={onOpenPortal}
        disabled={disabled || pending !== null || !sub.stripeCustomerId}
        style={{
          padding: '10px 20px',
          background: '#0F172A', color: 'white',
          border: 'none', borderRadius: 6, fontWeight: 600,
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled || !sub.stripeCustomerId ? 0.5 : 1,
        }}
      >
        {pending === 'portal' ? 'Opening portal…' : 'Manage payment, invoices, plan'}
      </button>

      <p style={{ color: '#5C5C5C', fontSize: 12, marginTop: 12 }}>
        Opens Stripe's secure billing portal in this window.
      </p>
    </>
  )
}
