// billing-portal — BRT subsystem 4 §4.5
//
// Returns a Stripe Customer Portal session URL for the calling user's org.
// The portal handles: update payment method, view invoices, change plan
// (monthly ↔ annual only), cancel subscription with retention prompt.
//
// Request:
//   POST /functions/v1/billing-portal
//   Authorization: Bearer <user JWT>
//
// Response:
//   { "portal_url": "https://billing.stripe.com/..." }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateRequest,
  handleCors,
  getCorsHeaders,
  HttpError,
  errorResponse,
} from '../shared/auth.ts'

interface StripePortalResponse {
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

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    const returnUrl = Deno.env.get('STRIPE_PORTAL_RETURN_URL')
      ?? 'https://app.sitesyncai.com/settings/billing'
    if (!stripeKey) throw new HttpError(500, 'Stripe not configured (STRIPE_SECRET_KEY missing)')

    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    // Resolve org + customer id from the caller's profile.
    const { data: profile } = await adminClient
      .from('profiles')
      .select('organization_id')
      .eq('user_id', user.id)
      .single()

    const orgId = (profile as { organization_id?: string | null } | null)?.organization_id
    if (!orgId) throw new HttpError(400, 'User has no organization')

    const { data: sub } = await adminClient
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('organization_id', orgId)
      .maybeSingle()

    const customerId = (sub as { stripe_customer_id?: string | null } | null)?.stripe_customer_id
    if (!customerId) {
      throw new HttpError(400, 'No Stripe customer on file. Start a trial first.')
    }

    // Authorization: only org owner / admin can open the portal.
    const { data: membership } = await adminClient
      .from('organization_members')
      .select('role')
      .eq('organization_id', orgId)
      .eq('user_id', user.id)
      .single()

    const role = (membership as { role?: string } | null)?.role
    if (role !== 'owner' && role !== 'admin') {
      throw new HttpError(403, 'Only org owner or admin can manage billing')
    }

    const params = new URLSearchParams()
    params.set('customer', customerId)
    params.set('return_url', returnUrl)

    const stripeRes = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Stripe-Version': '2025-04-30.basil',
      },
      body: params.toString(),
    })

    const stripeBody = await stripeRes.json() as StripePortalResponse
    if (!stripeRes.ok) {
      console.error('[billing-portal] Stripe API error:', stripeBody)
      throw new HttpError(502, stripeBody.error?.message ?? 'Stripe API error')
    }
    if (!stripeBody.url) {
      throw new HttpError(502, 'Stripe did not return a portal URL')
    }

    return new Response(
      JSON.stringify({ portal_url: stripeBody.url }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    )
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
