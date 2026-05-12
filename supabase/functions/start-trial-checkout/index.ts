// start-trial-checkout — BRT subsystem 4 §4.2
//
// Creates a Stripe Checkout Session for the SiteSync Pro plan (PR #451)
// with a 14-day trial and card-required-upfront. Returns the session URL
// for the frontend to redirect to.
//
// Request:
//   POST /functions/v1/start-trial-checkout
//   Authorization: Bearer <user JWT>
//   { "billing_cycle": "monthly" | "annual" }
//
// Response:
//   { "session_url": "https://checkout.stripe.com/..." }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateRequest,
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  HttpError,
  errorResponse,
} from '../shared/auth.ts'

interface StartTrialRequest {
  billing_cycle?: 'monthly' | 'annual'
}

interface StripeCheckoutResponse {
  id?: string
  url?: string
  error?: { message?: string }
}

Deno.serve(async (req: Request) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const corsHeaders = getCorsHeaders(req)

  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed')

    const { user } = await authenticateRequest(req)
    const body = await parseJsonBody<StartTrialRequest>(req)
    const cycle: 'monthly' | 'annual' = body.billing_cycle === 'annual' ? 'annual' : 'monthly'

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    const priceId = cycle === 'annual'
      ? Deno.env.get('STRIPE_PRICE_ID_ANNUAL')
      : Deno.env.get('STRIPE_PRICE_ID_MONTHLY')
    const successUrl = Deno.env.get('STRIPE_CHECKOUT_SUCCESS_URL')
      ?? 'https://app.sitesyncai.com/settings/billing?status=trial_started'
    const cancelUrl = Deno.env.get('STRIPE_CHECKOUT_CANCEL_URL')
      ?? 'https://app.sitesyncai.com/dashboard?status=trial_canceled'

    if (!stripeKey) throw new HttpError(500, 'Stripe not configured (STRIPE_SECRET_KEY missing)')
    if (!priceId)   throw new HttpError(500, `Stripe price not configured for ${cycle} cycle`)

    // Find the user's org + existing subscription (if any).
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    const { data: profile } = await adminClient
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    const orgId = (profile as { organization_id?: string | null } | null)?.organization_id
    if (!orgId) throw new HttpError(400, 'User has no organization yet')

    const { data: existingSub } = await adminClient
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('organization_id', orgId)
      .maybeSingle()

    const existingCustomer = (existingSub as { stripe_customer_id?: string | null } | null)?.stripe_customer_id

    // Build the Checkout Session params. Use form-urlencoded per Stripe REST API.
    const params = new URLSearchParams()
    params.set('mode', 'subscription')
    params.set('payment_method_collection', 'always')
    params.set('subscription_data[trial_period_days]', '14')
    params.set('subscription_data[trial_settings][end_behavior][missing_payment_method]', 'cancel')
    params.set('automatic_tax[enabled]', 'true')
    params.set('customer_update[address]', 'auto')
    params.set('customer_update[name]', 'auto')
    params.set('billing_address_collection', 'required')
    params.set('line_items[0][price]', priceId)
    params.set('line_items[0][quantity]', '1')
    params.set('success_url', successUrl)
    params.set('cancel_url', cancelUrl)
    params.set('client_reference_id', orgId)
    params.set('metadata[organization_id]', orgId)
    params.set('metadata[user_id]', user.id)
    params.set('metadata[billing_cycle]', cycle)
    if (existingCustomer) {
      params.set('customer', existingCustomer)
    } else if (user.email) {
      params.set('customer_email', user.email)
    }

    const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': '2025-04-30.basil',
      },
      body: params.toString(),
    })

    const stripeBody = await stripeRes.json() as StripeCheckoutResponse
    if (!stripeRes.ok) {
      console.error('[start-trial-checkout] Stripe API error:', stripeBody)
      throw new HttpError(502, stripeBody.error?.message ?? 'Stripe API error')
    }
    if (!stripeBody.url) {
      throw new HttpError(502, 'Stripe did not return a session URL')
    }

    return new Response(
      JSON.stringify({ session_url: stripeBody.url }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    )
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
