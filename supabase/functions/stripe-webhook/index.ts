// Stripe Webhook Handler
// Processes payment events from Stripe and updates SiteSync payment status.
// Handles: payment_intent.succeeded, payment_intent.failed, account.updated, transfer.created


import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://sitesync-pm.vercel.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
}

// ── Signature Verification ──────────────────────────────

async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const parts = signature.split(',')
  const timestamp = parts.find((p) => p.startsWith('t='))?.split('=')[1]
  const v1Signature = parts.find((p) => p.startsWith('v1='))?.split('=')[1]

  if (!timestamp || !v1Signature) return false

  // Replay attack protection: reject signatures older than 5 minutes
  const age = Math.floor(Date.now() / 1000) - parseInt(timestamp, 10)
  if (Number.isNaN(age) || age < 0 || age > 300) return false

  const signedPayload = `${timestamp}.${payload}`
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload))
  const expected = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('')

  // Constant-time comparison
  if (expected.length !== v1Signature.length) return false
  let mismatch = 0
  for (let i = 0; i < expected.length; i++) {
    mismatch |= expected.charCodeAt(i) ^ v1Signature.charCodeAt(i)
  }
  return mismatch === 0
}

// ── Handler ─────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    const body = await req.text()
    const signature = req.headers.get('stripe-signature') ?? ''

    // Verify webhook signature
    const valid = await verifyStripeSignature(body, signature, stripeWebhookSecret)
    if (!valid) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const event = JSON.parse(body)
    const eventType = event.type as string
    const eventId = event.id as string | undefined
    const data = event.data?.object ?? {}

    // BRT sub-4 §4.3 — idempotency: dedupe via stripe_processed_events.
    // Stripe occasionally retries deliveries; without this guard a single
    // subscription.created would fire its handler twice.
    if (eventId) {
      const { error: dedupErr } = await supabase
        .from('stripe_processed_events')
        .insert({ event_id: eventId, event_type: eventType, result: 'success' })
      if (dedupErr && !String(dedupErr.message ?? '').toLowerCase().includes('duplicate')) {
        // Don't fail open on a real DB error — log and continue (Stripe will
        // retry; we'd rather double-process than drop).
        console.warn('[stripe-webhook] dedup insert failed:', dedupErr)
      } else if (dedupErr) {
        // Duplicate key → we've already processed this event. Acknowledge
        // and exit so Stripe stops retrying.
        console.log(`[stripe-webhook] duplicate event ${eventId} (${eventType}); skipping`)
        return new Response(
          JSON.stringify({ received: true, duplicate: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
        )
      }
    }

    switch (eventType) {
      case 'payment_intent.succeeded': {
        const applicationId = data.metadata?.application_id
        if (applicationId) {
          // Update payment application to paid
          await supabase.from('payment_applications').update({
            status: 'paid',
            paid_at: new Date().toISOString(),
            check_number: data.id, // Use Stripe payment intent ID as reference
          }).eq('id', applicationId)

          // Update payment transaction record
          await supabase.from('payment_transactions').update({
            status: 'succeeded',
            stripe_payment_intent_id: data.id,
          }).eq('stripe_payment_intent_id', data.id)

          // Convert conditional lien waivers to unconditional
          await supabase.from('lien_waivers').update({
            status: 'unconditional',
            updated_at: new Date().toISOString(),
          }).eq('application_id', applicationId).eq('status', 'conditional')

          // Write audit trail
          await supabase.from('audit_trail').insert({
            project_id: data.metadata?.project_id,
            action: 'payment_received',
            entity_type: 'payment_application',
            entity_id: applicationId,
            new_value: { amount: data.amount, stripe_id: data.id },
          })
        }
        break
      }

      case 'payment_intent.payment_failed': {
        const applicationId = data.metadata?.application_id
        if (applicationId) {
          await supabase.from('payment_transactions').update({
            status: 'failed',
            error: data.last_payment_error?.message ?? 'Payment failed',
          }).eq('stripe_payment_intent_id', data.id)
        }
        break
      }

      case 'account.updated': {
        // Connected account onboarding status changed
        const accountId = data.id
        const chargesEnabled = data.charges_enabled
        const payoutsEnabled = data.payouts_enabled

        await supabase.from('stripe_connected_accounts').update({
          charges_enabled: chargesEnabled,
          payouts_enabled: payoutsEnabled,
          onboarding_complete: chargesEnabled && payoutsEnabled,
          updated_at: new Date().toISOString(),
        }).eq('stripe_account_id', accountId)
        break
      }

      case 'transfer.created': {
        // Payout to subcontractor initiated
        const transferId = data.id
        const destination = data.destination
        const amount = data.amount

        await supabase.from('payment_transactions').insert({
          stripe_transfer_id: transferId,
          stripe_account_id: destination,
          amount,
          status: 'processing',
          type: 'transfer',
          created_at: new Date().toISOString(),
        })
        break
      }

      // ── BRT sub-4 §4.3 — subscription lifecycle events ──────────

      case 'checkout.session.completed': {
        // Frontend redirected user back from Checkout success URL. The
        // subscription is created server-side here, before the user lands
        // on /settings/billing.
        const orgId = data.metadata?.organization_id ?? data.client_reference_id
        const customerId = data.customer
        const subscriptionId = data.subscription
        const billingCycle = data.metadata?.billing_cycle ?? 'monthly'
        if (orgId && subscriptionId) {
          await supabase.from('subscriptions').upsert({
            organization_id: orgId,
            plan_id: 'pro',
            status: 'trialing',
            billing_cycle: billingCycle,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
          }, { onConflict: 'organization_id' })
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        // Backstop in case checkout.session.completed missed; also covers
        // proration / plan changes / status transitions.
        const subscriptionId = data.id
        const status = data.status as string
        const trialEndsAt = data.trial_end ? new Date(data.trial_end * 1000).toISOString() : null
        const currentPeriodStart = data.current_period_start
          ? new Date(data.current_period_start * 1000).toISOString()
          : null
        const currentPeriodEnd = data.current_period_end
          ? new Date(data.current_period_end * 1000).toISOString()
          : null
        const cancelAtPeriodEnd = data.cancel_at_period_end === true
        await supabase.from('subscriptions').update({
          status,
          trial_ends_at: trialEndsAt,
          ...(currentPeriodStart ? { current_period_start: currentPeriodStart } : {}),
          ...(currentPeriodEnd ? { current_period_end: currentPeriodEnd } : {}),
          ...(cancelAtPeriodEnd ? { canceled_at: new Date().toISOString() } : {}),
        }).eq('stripe_subscription_id', subscriptionId)
        break
      }

      case 'customer.subscription.deleted': {
        // Final state. Mark canceled + record canceled_at if not already set.
        const subscriptionId = data.id
        await supabase.from('subscriptions').update({
          status: 'canceled',
          canceled_at: new Date().toISOString(),
        }).eq('stripe_subscription_id', subscriptionId)
        break
      }

      case 'customer.subscription.trial_will_end': {
        // Stripe fires this 3 days before trial_end. We log; the
        // SubscriptionBanner handles the actual user-facing copy.
        const subscriptionId = data.id
        console.log(`[stripe-webhook] trial_will_end for ${subscriptionId}`)
        // (Email send wired via dunning-email-send cron in a follow-up slice.)
        break
      }

      case 'invoice.payment_succeeded': {
        // Reset any past_due / paused state when a payment finally lands.
        const subscriptionId = data.subscription
        if (subscriptionId) {
          await supabase.from('subscriptions').update({
            status: 'active',
          }).eq('stripe_subscription_id', subscriptionId).in('status', ['past_due', 'paused'])
        }
        // Cache the invoice locally for the billing UI.
        await supabase.from('invoices').upsert({
          stripe_payment_intent_id: data.payment_intent,
          invoice_number: data.number,
          amount_cents: data.amount_paid,
          status: 'paid',
          paid_at: new Date().toISOString(),
          due_at: data.due_date ? new Date(data.due_date * 1000).toISOString() : null,
          invoice_pdf_url: data.invoice_pdf,
          receipt_pdf_url: data.hosted_invoice_url,
        }, { onConflict: 'invoice_number' })
        break
      }

      case 'invoice.payment_failed': {
        // Mark the invoice failed; subscription state will be set by the
        // matching subscription.updated event from Stripe (status='past_due').
        await supabase.from('invoices').upsert({
          invoice_number: data.number,
          amount_cents: data.amount_due,
          status: 'failed',
          due_at: data.due_date ? new Date(data.due_date * 1000).toISOString() : null,
        }, { onConflict: 'invoice_number' })
        break
      }

      case 'invoice.created':
      case 'invoice.upcoming': {
        // Cache the invoice metadata locally for the billing UI's history list.
        await supabase.from('invoices').upsert({
          invoice_number: data.number,
          amount_cents: data.amount_due,
          status: data.status === 'paid' ? 'paid' : 'pending',
          due_at: data.due_date ? new Date(data.due_date * 1000).toISOString() : null,
          invoice_pdf_url: data.invoice_pdf,
        }, { onConflict: 'invoice_number' })
        break
      }

      case 'payment_method.attached': {
        // Customer added a card. Useful for the billing UI to show
        // "card on file" without re-fetching from Stripe.
        const customerId = data.customer
        if (customerId) {
          await supabase.from('subscriptions').update({
            // No dedicated has_payment_method column today; reflect via the
            // updated_at touch so the UI re-fetches. A future migration
            // adds the explicit column.
            updated_at: new Date().toISOString(),
          }).eq('stripe_customer_id', customerId)
        }
        break
      }

      case 'customer.updated': {
        // Sync billing email / address changes from Stripe back to the
        // subscription row so our UI matches what Stripe has on file.
        const customerId = data.id
        const email = data.email
        if (customerId && email) {
          // Find org via subscription.stripe_customer_id, then update
          // organizations.billing_email if the column exists.
          const { data: subRow } = await supabase
            .from('subscriptions')
            .select('organization_id')
            .eq('stripe_customer_id', customerId)
            .single()
          const orgId = (subRow as { organization_id?: string } | null)?.organization_id
          if (orgId) {
            await supabase.from('organizations')
              .update({ billing_email: email })
              .eq('id', orgId)
          }
        }
        break
      }

      default:
        // Log unhandled events for debugging
        console.log(`Unhandled Stripe event: ${eventType}`)
    }

    return new Response(
      JSON.stringify({ received: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    console.error('Stripe webhook error:', error)
    return new Response(
      JSON.stringify({ error: 'Webhook processing failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  }
})
