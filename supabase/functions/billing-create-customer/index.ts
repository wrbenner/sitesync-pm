// ── billing-create-customer Edge Function ────────────────
// Phase 6: Creates a Stripe customer for an organization and
// persists the mapping in billing_customers. Adapted from
// sitesyncai-backend-main/src/billing/billing.service.ts ::
// createStripeCustomer().


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
  const out: string[] = []
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null) continue
    out.push(`${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
  }
  return out.join('&')
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
      organization_id: string
      email: string
      name?: string
      tier?: 'starter' | 'professional' | 'enterprise'
    }>(req)

    requireUuid('organization_id', body.organization_id)
    if (!body.email || !body.email.includes('@')) {
      throw new HttpError(400, 'email is required and must be valid', 'validation_error')
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')
    if (!stripeKey) {
      throw new HttpError(500, 'STRIPE_SECRET_KEY not configured', 'config_error')
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })

    // Check membership
    const { data: membership, error: memberError } = await supabase
      .from('organization_members')
      .select('user_id, role')
      .eq('organization_id', body.organization_id)
      .eq('user_id', user.id)
      .single()
    if (memberError || !membership) {
      throw new HttpError(403, 'Not a member of this organization', 'forbidden')
    }

    const { data: existing } = await supabase
      .from('billing_customers')
      .select('id, stripe_customer_id, tier')
      .eq('organization_id', body.organization_id)
      .maybeSingle()

    if (existing?.stripe_customer_id) {
      return new Response(
        JSON.stringify({
          customer_id: existing.stripe_customer_id,
          existing: true,
          tier: existing.tier,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
      )
    }

    const stripeCustomer = (await stripeRequest(
      '/customers',
      'POST',
      {
        email: body.email,
        name: body.name,
        'metadata[organization_id]': body.organization_id,
        'metadata[created_by]': user.id,
      },
      stripeKey,
    )) as { id: string }

    const tier = body.tier ?? 'starter'
    const tierLimits = {
      starter: { max_projects: 5, max_files_per_project: 100, max_pages_per_file: 500 },
      professional: { max_projects: 25, max_files_per_project: 500, max_pages_per_file: 1000 },
      enterprise: { max_projects: 1000, max_files_per_project: 5000, max_pages_per_file: 5000 },
    }[tier]

    const { data: inserted, error: insertError } = await supabase
      .from('billing_customers')
      .insert({
        organization_id: body.organization_id,
        stripe_customer_id: stripeCustomer.id,
        tier,
        ...tierLimits,
      })
      .select('*')
      .single()

    if (insertError) {
      throw new HttpError(500, `Insert billing_customers failed: ${insertError.message}`)
    }

    return new Response(
      JSON.stringify({ customer_id: stripeCustomer.id, billing_customer: inserted }),
      { status: 201, headers: { 'Content-Type': 'application/json', ...corsHeaders } },
    )
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
