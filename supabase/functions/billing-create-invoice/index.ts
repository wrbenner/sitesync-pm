// ── billing-create-invoice Edge Function ─────────────────
// Phase 6: Creates an invoice with line items. Adapted from
// sitesyncai-backend-main/src/billing/billing.service.ts ::
// createInvoice() with tier limit awareness (maxProjects,
// maxFilesPerProject). Amounts are integer cents.


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

interface LineItem {
  description: string
  quantity: number
  unit_amount_cents: number
}

function generateInvoiceNumber(): string {
  const now = new Date()
  const yyyy = now.getFullYear()
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase()
  return `INV-${yyyy}${mm}-${rand}`
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
      line_items: LineItem[]
      due_at?: string
    }>(req)

    requireUuid('organization_id', body.organization_id)

    if (!Array.isArray(body.line_items) || body.line_items.length === 0) {
      throw new HttpError(400, 'line_items must be a non-empty array', 'validation_error')
    }

    let totalCents = 0
    for (const li of body.line_items) {
      if (
        !li ||
        typeof li.description !== 'string' ||
        !Number.isInteger(li.quantity) ||
        li.quantity <= 0 ||
        !Number.isInteger(li.unit_amount_cents) ||
        li.unit_amount_cents < 0
      ) {
        throw new HttpError(
          400,
          'Each line item needs description (string), quantity (positive int), unit_amount_cents (non-negative int).',
          'validation_error',
        )
      }
      totalCents += li.quantity * li.unit_amount_cents
    }
    if (totalCents === 0) {
      throw new HttpError(400, 'Invoice total must be greater than zero', 'validation_error')
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false },
    })

    // Membership check
    const { data: membership, error: memberError } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', body.organization_id)
      .eq('user_id', user.id)
      .single()
    if (memberError || !membership) {
      throw new HttpError(403, 'Not a member of this organization', 'forbidden')
    }

    // Tier limit awareness: ensure billing customer exists.
    const { data: billingCustomer, error: billingError } = await supabase
      .from('billing_customers')
      .select('id, tier, max_projects, max_files_per_project')
      .eq('organization_id', body.organization_id)
      .single()
    if (billingError || !billingCustomer) {
      throw new HttpError(
        404,
        'Billing customer not found. Call billing-create-customer first.',
        'not_found',
      )
    }

    const invoiceNumber = generateInvoiceNumber()
    const { data: inserted, error: insertError } = await supabase
      .from('invoices')
      .insert({
        organization_id: body.organization_id,
        invoice_number: invoiceNumber,
        amount_cents: totalCents,
        status: 'pending',
        due_at: body.due_at ?? null,
        line_items: body.line_items,
      })
      .select('*')
      .single()

    if (insertError) {
      throw new HttpError(500, `Insert invoices failed: ${insertError.message}`)
    }

    return new Response(JSON.stringify({ invoice: inserted, tier: billingCustomer.tier }), {
      status: 201,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    })
  } catch (err) {
    return errorResponse(err, corsHeaders)
  }
})
