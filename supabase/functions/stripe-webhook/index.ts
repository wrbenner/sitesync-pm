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
    const data = event.data?.object ?? {}

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
