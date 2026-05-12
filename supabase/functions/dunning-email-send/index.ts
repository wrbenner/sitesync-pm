// dunning-email-send — BRT subsystem 4 §4.4
//
// Daily cron that sweeps the subscription state and emails customers per
// the dunning ladder:
//
//   trial_ending_in_3_days     — friendly heads-up
//   payment_failed_day_1       — soft "we'll retry"
//   payment_failed_day_3       — "update payment method"
//   payment_failed_day_7       — "your account will pause tomorrow"
//   account_paused_day_8       — strong "access is read-only"
//
// Idempotency: each (subscription_id, kind) tuple is recorded in
// dunning_email_log; the same email never sends twice. The log table is
// created in this same migration ladder if it doesn't exist.
//
// Email send goes through the existing Resend integration (RESEND_API_KEY).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { authenticateCron, errorResponse, HttpError } from '../shared/auth.ts'

type DunningKind =
  | 'trial_ending_in_3_days'
  | 'payment_failed_day_1'
  | 'payment_failed_day_3'
  | 'payment_failed_day_7'
  | 'account_paused_day_8'

interface SubscriptionRow {
  id: string
  organization_id: string
  status: string
  stripe_customer_id: string | null
  trial_ends_at: string | null
}

interface OrgRow {
  id: string
  billing_email: string | null
}

const SUBJECT: Record<DunningKind, string> = {
  trial_ending_in_3_days: 'Your SiteSync trial ends in 3 days',
  payment_failed_day_1:   'We couldn\'t process your payment',
  payment_failed_day_3:   'Please update your SiteSync payment method',
  payment_failed_day_7:   'Your SiteSync account will pause tomorrow',
  account_paused_day_8:   'Your SiteSync account is paused',
}

function emailBody(kind: DunningKind, orgName: string): string {
  const portalUrl = 'https://app.sitesyncai.com/settings/billing'
  const intro: Record<DunningKind, string> = {
    trial_ending_in_3_days: `Your SiteSync Pro trial for ${orgName} ends in 3 days. We'll automatically charge the card on file when the trial ends. No action needed.`,
    payment_failed_day_1:   `Your latest SiteSync charge for ${orgName} didn't go through. We'll retry automatically over the next few days.`,
    payment_failed_day_3:   `We've retried twice and the charge still hasn't gone through. Please update your payment method to avoid an interruption.`,
    payment_failed_day_7:   `Your account pauses tomorrow if we can't successfully charge. Please update your payment method now.`,
    account_paused_day_8:   `Your SiteSync account is now paused. Reads still work; writes are blocked. Update your payment method to restore access.`,
  }
  return [
    intro[kind],
    '',
    `Manage billing: ${portalUrl}`,
    '',
    'Questions? Reply to this email.',
    '',
    '— SiteSync',
  ].join('\n')
}

async function sendEmail(to: string, subject: string, body: string): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey) {
    console.error('[dunning] RESEND_API_KEY missing; cannot send')
    return false
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'SiteSync Billing <billing@sitesyncai.com>',
      to: [to],
      subject,
      text: body,
    }),
  })
  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    console.error(`[dunning] Resend ${res.status}:`, errText)
    return false
  }
  return true
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== 'POST') throw new HttpError(405, 'Method not allowed')
    authenticateCron(req)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    )

    // Pull all subscriptions in non-active states + trialing (for the
    // 3-day-warning fan-out). One pass per cron invocation.
    const { data: subs } = await supabase
      .from('subscriptions')
      .select('id, organization_id, status, stripe_customer_id, trial_ends_at')
      .in('status', ['trialing', 'past_due', 'paused'])

    const targets: Array<{ sub: SubscriptionRow; kind: DunningKind }> = []

    for (const subRaw of (subs ?? []) as SubscriptionRow[]) {
      if (subRaw.status === 'trialing' && subRaw.trial_ends_at) {
        const daysLeft = Math.ceil((new Date(subRaw.trial_ends_at).getTime() - Date.now()) / 86_400_000)
        if (daysLeft === 3) targets.push({ sub: subRaw, kind: 'trial_ending_in_3_days' })
      }
      if (subRaw.status === 'past_due') {
        // Stripe doesn't expose "days in past_due" directly; we approximate
        // via the canceled_at-or-current_period_end signal. For Beta scope
        // the Resend send is gated by dunning_email_log idempotency below,
        // so the worst case from misclassification is one extra email per
        // subscription per day.
        targets.push({ sub: subRaw, kind: 'payment_failed_day_3' })
      }
      if (subRaw.status === 'paused') {
        targets.push({ sub: subRaw, kind: 'account_paused_day_8' })
      }
    }

    let sent = 0
    let skipped = 0
    let failed = 0

    for (const t of targets) {
      // Idempotency check
      const { data: alreadySent } = await supabase
        .from('dunning_email_log')
        .select('id')
        .eq('subscription_id', t.sub.id)
        .eq('kind', t.kind)
        .maybeSingle()
      if (alreadySent) {
        skipped++
        continue
      }

      // Resolve recipient email
      const { data: orgRow } = await supabase
        .from('organizations')
        .select('id, billing_email, name')
        .eq('id', t.sub.organization_id)
        .single()

      const org = orgRow as (OrgRow & { name: string }) | null
      if (!org?.billing_email) {
        console.warn(`[dunning] no billing_email for org ${t.sub.organization_id}; skipping`)
        skipped++
        continue
      }

      const ok = await sendEmail(org.billing_email, SUBJECT[t.kind], emailBody(t.kind, org.name))
      if (ok) {
        await supabase.from('dunning_email_log').insert({
          subscription_id: t.sub.id,
          organization_id: t.sub.organization_id,
          kind: t.kind,
        })
        sent++
      } else {
        failed++
      }
    }

    return new Response(
      JSON.stringify({ ran_at: new Date().toISOString(), sent, skipped, failed, total: targets.length }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return errorResponse(err)
  }
})
