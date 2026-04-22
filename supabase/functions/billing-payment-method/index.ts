// ── billing-payment-method Edge Function ─────────────────
// Phase 6: Attach or detach Stripe payment methods to an
// organization. Adapted from
// sitesyncai-backend-main/src/billing/billing.service.ts ::
// attachOrgPaymentMethod() / deletePaymentMethod().
//
// Actions:
//   action: 'attach' - body: { organization_id, stripe_payment_method_id }
//   action: 'detach' - body: { organization_id, payment_method_id }
//   action: 'set_default' - body: { organization_id, payment_method_id }


import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  authenticateRequest,
  handleCors,
  getCorsHeaders,
  parseJsonBody,
  HttpError,
  errorResponse,
  requireUuid,
} from '../shared/auth.ts'

const STRIPE_API_BASE = 'https://api.stripe.com/v1'

function encodeForm(params: Record<string, string | number | undefined>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
}

async function stripeRequest(
  path: string,
  method: 'GET' | 'POST' | 'DELETE',
  body: Record<string, string | number | undefined> | null,
  apiKey: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${STRIPE_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body ? encodeForm(body) : undefined,
  })
  const payload = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    const message = (payload?.error as { message?: string })?.message ?? `Stripe ${res.status}`
    throw new HttpError(res.status, message, 'stripe_error')
  }
  return payload
}

async function assertMember(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from('organization_members')
    .select('user_id')
    .eq('organization_id', orgId)
    .eq('user_id', userId)
    .single()
  if (error || !data) {
    throw new HttpError(403, 'Not a member of this organization', 'forbidden')
  }
}

async function getStripeCustomerId(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from('billing_customers')
    .select('stripe_customer_id')
    .eq('organization_id', orgId)
    .single()
  if (error || !data?.stripe_customer_id) {
    throw new HttpError(404, 'Billing customer not found. Create it first.', 'not_found')
  }
  return data.stripe_customer_id as string
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req)
  if (corsResponse) return corsResponse
  const corsHeaders = getCorsHeaders(req)

  if (req.method !== 'POST') {
    return errorResponse(new HttpError(405, 'Method not allowed'), corsHeaders)
  }

  try {
    const { user } = await authenticateRequest(req)

    const body = await parseJsonBody<{
      action: 'attach' | 'detach' | 'set_default'
      organization_id: string
      stripe_payment_method_id?: string
      payment_method_id?: string
    }>(req)

    requireUuid('organization_id', body.organization_id)

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) throw new HttpError(500, 'STRIPE_SECRET_KEY not configured', 'config_error')

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })

    await assertMember(supabase, body.organization_id, user.id)
    const customerId = await getStripeCustomerId(supabase, body.organization_id)

    if (body.action === 'attach') {
      if (!body.stripe_payment_method_id) {
        throw new HttpError(400, 'stripe_payment_method_id is required', 'validation_error')
      }

      await stripeRequest(
        `/payment_methods/${body.stripe_payment_method_id}/attach`,
        'POST',
        { customer: customerId },
        stripeKey,
      )

      const pm = (await stripeRequest(
        `/payment_methods/${body.stripe_payment_method_id}`,
        'GET',
        null,
        stripeKey,
      )) as { card?: { brand: string; last4: string; exp_month: number; exp_year: number } }

      const { data: inserted, error: insertError } = await supabase
        .from('payment_methods')
        .insert({
          organization_id: body.organization_id,
          stripe_payment_method_id: body.stripe_payment_method_id,
          brand: pm.card?.brand ?? null,
          last4: pm.card?.last4 ?? null,
          exp_month: pm.card?.exp_month ?? null,
          exp_year: pm.card?.exp_year ?? null,
          added_by: user.id,
        })
        .select('*')
        .single()

      if (insertError) {
        throw new HttpError(500, `Insert payment_methods failed: ${insertError.message}`)
      }

      return new Response(JSON.stringify({ payment_method: inserted }), {
        status: 201,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    if (body.action === 'detach') {
      if (!body.payment_method_id) {
        throw new HttpError(400, 'payment_method_id is required', 'validation_error')
      }
      requireUuid('payment_method_id', body.payment_method_id)

      const { data: row, error: readError } = await supabase
        .from('payment_methods')
        .select('stripe_payment_method_id, organization_id')
        .eq('id', body.payment_method_id)
        .is('deleted_at', null)
        .single()
      if (readError || !row) {
        throw new HttpError(404, 'Payment method not found', 'not_found')
      }
      if (row.organization_id !== body.organization_id) {
        throw new HttpError(403, 'Payment method does not belong to this organization', 'forbidden')
      }

      await stripeRequest(
        `/payment_methods/${row.stripe_payment_method_id}/detach`,
        'POST',
        null,
        stripeKey,
      )

      await supabase
        .from('payment_methods')
        .update({ deleted_at: new Date().toISOString(), is_default: false })
        .eq('id', body.payment_method_id)

      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    if (body.action === 'set_default') {
      if (!body.payment_method_id) {
        throw new HttpError(400, 'payment_method_id is required', 'validation_error')
      }
      requireUuid('payment_method_id', body.payment_method_id)

      await supabase
        .from('payment_methods')
        .update({ is_default: false })
        .eq('organization_id', body.organization_id)
        .is('deleted_at', null)

      const { data: updated, error: updateError } = await supabase
        .from('payment_methods')
        .update({ is_default: true })
        .eq('id', body.payment_method_id)
        .select('*')
        .single()
      if (updateError || !updated) {
        throw new HttpError(500, 'Failed to set default payment method')
      }

      await stripeRequest(
        `/customers/${customerId}`,
        'POST',
        { 'invoice_settings[default_payment_method]': updated.stripe_payment_method_id as string },
        stripeKey,
      )

      return new Response(JSON.stringify({ payment_method: updated }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      })
    }

    throw new HttpError(400, `Unsupported action: ${body.action}`, 'validation_error')
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
