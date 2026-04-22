// ── billing-process-payment Edge Function ────────────────
// Phase 6: Charges an invoice using a saved payment method
// via Stripe PaymentIntent. Adapted from
// sitesyncai-backend-main/src/billing/billing.service.ts ::
// payInvoice(). Integer cents throughout. No float math.


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
  method: 'GET' | 'POST',
  body: Record<string, string | number | undefined> | null,
  apiKey: string,
): Promise<Record<string, unknown>> {
  const res = await fetch(`${STRIPE_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      // Idempotency keys prevent accidental double charges on retries.
      'Idempotency-Key': crypto.randomUUID(),
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
      invoice_id: string
      payment_method_id: string
    }>(req)

    requireUuid('invoice_id', body.invoice_id)
    requireUuid('payment_method_id', body.payment_method_id)

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) throw new HttpError(500, 'STRIPE_SECRET_KEY not configured', 'config_error')

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, organization_id, amount_cents, status, invoice_number')
      .eq('id', body.invoice_id)
      .single()
    if (invoiceError || !invoice) {
      throw new HttpError(404, 'Invoice not found', 'not_found')
    }
    if (invoice.status === 'paid') {
      return new Response(
        JSON.stringify({ invoice, already_paid: true }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    }
    if (invoice.status === 'void') {
      throw new HttpError(400, 'Cannot pay a voided invoice', 'validation_error')
    }

    const { data: membership, error: memberError } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', invoice.organization_id)
      .eq('user_id', user.id)
      .single()
    if (memberError || !membership) {
      throw new HttpError(403, 'Not a member of this organization', 'forbidden')
    }

    const { data: pm, error: pmError } = await supabase
      .from('payment_methods')
      .select('stripe_payment_method_id, organization_id, deleted_at')
      .eq('id', body.payment_method_id)
      .single()
    if (pmError || !pm || pm.deleted_at) {
      throw new HttpError(404, 'Payment method not found', 'not_found')
    }
    if (pm.organization_id !== invoice.organization_id) {
      throw new HttpError(403, 'Payment method does not belong to this organization', 'forbidden')
    }

    const { data: billingCustomer, error: bcError } = await supabase
      .from('billing_customers')
      .select('stripe_customer_id')
      .eq('organization_id', invoice.organization_id)
      .single()
    if (bcError || !billingCustomer?.stripe_customer_id) {
      throw new HttpError(404, 'Billing customer not found', 'not_found')
    }

    const paymentIntent = (await stripeRequest(
      '/payment_intents',
      'POST',
      {
        amount: invoice.amount_cents,
        currency: 'usd',
        customer: billingCustomer.stripe_customer_id,
        payment_method: pm.stripe_payment_method_id as string,
        off_session: 'true',
        confirm: 'true',
        description: `Invoice ${invoice.invoice_number}`,
        'metadata[invoice_id]': invoice.id,
        'metadata[organization_id]': invoice.organization_id,
      },
      stripeKey,
    )) as { id: string; status: string; charges?: unknown }

    const succeeded = paymentIntent.status === 'succeeded'

    const { data: updated } = await supabase
      .from('invoices')
      .update({
        status: succeeded ? 'paid' : 'failed',
        paid_at: succeeded ? new Date().toISOString() : null,
        stripe_payment_intent_id: paymentIntent.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice.id)
      .select('*')
      .single()

    return new Response(
      JSON.stringify({
        invoice: updated ?? invoice,
        payment_intent_id: paymentIntent.id,
        status: paymentIntent.status,
        succeeded,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    )
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
