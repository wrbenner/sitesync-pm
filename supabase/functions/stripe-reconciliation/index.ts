// stripe-reconciliation — BRT subsystem 4 §4.3 §4.7
//
// Every-4-hours cron that re-fetches subscription state from Stripe and
// fixes drift in our local subscriptions table. Defends against:
//
//   - webhook delivery delays > 1 hour
//   - silent webhook handler failures (the dedup table acks the event,
//     the handler errors before the DB write)
//   - manual changes made in Stripe Dashboard
//
// Strategy: pull every subscription with a stripe_subscription_id, ask
// Stripe for the canonical state, write back if it differs.
//
// Auth: cron-secret-gated.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { authenticateCron, errorResponse, HttpError } from '../shared/auth.ts'

interface SubRow {
  id: string
  organization_id: string
  status: string
  stripe_subscription_id: string | null
  trial_ends_at: string | null
  current_period_start: string | null
  current_period_end: string | null
  canceled_at: string | null
}

interface StripeSubscription {
  id: string
  status: string
  trial_end: number | null
  current_period_start: number
  current_period_end: number
  cancel_at_period_end: boolean
  canceled_at: number | null
}

function isoOrNull(epochSec: number | null | undefined): string | null {
  if (!epochSec) return null
  return new Date(epochSec * 1000).toISOString()
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed')
    authenticateCron(req)

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) throw new HttpError(500, 'STRIPE_SECRET_KEY missing')

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const { data: subs, error } = await supabase
      .from('subscriptions')
      .select('id, organization_id, status, stripe_subscription_id, trial_ends_at, current_period_start, current_period_end, canceled_at')
      .not('stripe_subscription_id', 'is', null)

    if (error) throw new HttpError(502, `subscriptions query failed: ${error.message}`)

    const ranAt = new Date().toISOString()
    let scanned = 0
    let updated = 0
    let errors = 0

    for (const subRow of (subs ?? []) as SubRow[]) {
      const subId = subRow.stripe_subscription_id
      if (!subId) continue
      scanned++

      try {
        const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
          headers: {
            'Authorization': `Bearer ${stripeKey}`,
            'Stripe-Version': '2025-04-30.basil',
          },
        })

        if (res.status === 404) {
          // Stripe says the subscription doesn't exist. Mark canceled
          // locally so the UI doesn't keep showing a phantom active row.
          await supabase.from('subscriptions').update({
            status: 'canceled',
            canceled_at: subRow.canceled_at ?? ranAt,
          }).eq('id', subRow.id)
          updated++
          continue
        }

        if (!res.ok) {
          errors++
          console.error(`[reconciliation] Stripe ${res.status} for ${subId}`)
          continue
        }

        const remote = (await res.json()) as StripeSubscription

        const remoteTrialEnd = isoOrNull(remote.trial_end)
        const remotePeriodStart = isoOrNull(remote.current_period_start)
        const remotePeriodEnd = isoOrNull(remote.current_period_end)
        const remoteCanceledAt = remote.cancel_at_period_end
          ? (subRow.canceled_at ?? ranAt)
          : isoOrNull(remote.canceled_at)

        const drift =
          remote.status !== subRow.status ||
          remoteTrialEnd !== subRow.trial_ends_at ||
          remotePeriodStart !== subRow.current_period_start ||
          remotePeriodEnd !== subRow.current_period_end ||
          remoteCanceledAt !== subRow.canceled_at

        if (drift) {
          await supabase.from('subscriptions').update({
            status: remote.status,
            trial_ends_at: remoteTrialEnd,
            current_period_start: remotePeriodStart,
            current_period_end: remotePeriodEnd,
            canceled_at: remoteCanceledAt,
          }).eq('id', subRow.id)
          updated++
          console.log(`[reconciliation] drift fixed for ${subId}: ${subRow.status} → ${remote.status}`)
        }
      } catch (e) {
        errors++
        console.error(`[reconciliation] exception for ${subId}:`, e)
      }
    }

    return new Response(
      JSON.stringify({ ran_at: ranAt, scanned, updated, errors }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return errorResponse(err)
  }
})
