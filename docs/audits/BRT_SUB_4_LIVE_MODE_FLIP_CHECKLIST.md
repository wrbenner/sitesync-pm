# BRT Sub-4 — Stripe Live-Mode Flip Checklist

**Owner:** Walker (Stripe dashboard owner)
**Audience:** Walker (post-receipt step before charging real cards)
**Status when read:** Phase 1 Track B complete; backend + frontend on Stripe **test mode**.

This is the 10-step procedure to graduate SiteSync from Stripe test mode to live mode. **Do not perform** any step until Walker has manually:

1. Confirmed the test-mode trial → checkout → portal → cancel loop works end-to-end on a test card
2. Reviewed the dunning + paused-account flow (5 failed-payment retries → org enters read-only)

## The 10 steps

### 1. Stripe dashboard → activate live mode

- Sign in at https://dashboard.stripe.com
- Top-left toggle: switch from **Test mode** → **Live mode**
- If account is not yet activated for live, complete the activation wizard (bank info, tax ID, statement descriptor "SITESYNC")

### 2. Create the `pro` product + 2 prices in live mode

- Products → New
  - Name: **SiteSync Pro**
  - Description: *paste from plans.pro.description*
- Add Price #1 (monthly):
  - Amount: **$400.00 USD / month**
  - Billing period: monthly
  - Tax behavior: **Automatically calculate tax** (Stripe Tax)
  - Copy the **`price_…` ID**
- Add Price #2 (annual):
  - Amount: **$4,080.00 USD / year**
  - Billing period: yearly
  - Tax behavior: **Automatically calculate tax**
  - Copy the **`price_…` ID**

### 3. Update `plans.pro` row with live price IDs

Via the Supabase dashboard SQL editor:

```sql
UPDATE plans
   SET stripe_price_monthly = '<live_price_monthly_id>',
       stripe_price_annual  = '<live_price_annual_id>'
 WHERE id = 'pro';
```

Verify:
```sql
SELECT id, stripe_price_monthly, stripe_price_annual FROM plans WHERE id = 'pro';
```

### 4. Live API keys

Stripe dashboard → Developers → API keys (Live mode):
- Copy **Secret key** (`sk_live_…`)
- Copy **Publishable key** (`pk_live_…`)

### 5. Supabase edge function env vars (production)

Supabase dashboard → Project Settings → Edge Functions → Env vars. Update **only**:

| Key | New value |
|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_…` |
| `STRIPE_PUBLISHABLE_KEY` | `pk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | *generated in step 6* |

Keep test-mode values archived in a 1Password secure note for rollback.

### 6. Webhook endpoint (live mode)

Stripe dashboard → Developers → Webhooks → Add endpoint (Live mode):
- URL: `https://hypxrmcppjfbtlwuoafc.functions.supabase.co/stripe-webhook`
- Events to send: select the **11 events** the handler already covers (see `supabase/functions/stripe-webhook/index.ts` lines 35-50 for the canonical list)
- Copy the **signing secret** (`whsec_…`) and paste it into `STRIPE_WEBHOOK_SECRET` from step 5
- Save

### 7. Customer Portal config (live mode)

Stripe dashboard → Settings → Billing → Customer Portal:
- Branding: upload SiteSync logo + set primary color `#E87722`
- Functionality:
  - Allow customers to **cancel subscriptions** (immediately or at period end — pick **at period end** so they don't lose access mid-cycle)
  - Allow customers to **update payment method**: yes
  - Allow customers to **switch plans**: yes (monthly ↔ annual only)
- Business information: confirm support email + privacy/ToS URLs
- Save

### 8. Frontend env var (Vercel)

Vercel dashboard → Project (sitesync-pm) → Settings → Environment Variables. Update **Production** only:

| Key | New value |
|---|---|
| `VITE_STRIPE_PUBLISHABLE_KEY` | `pk_live_…` |

Trigger a fresh production deploy after saving (Vercel does this automatically when env vars change, but verify).

### 9. End-to-end live-mode smoke

Sign in to https://app.sitesync.ai with a **real** test account (not your own founder account):

- [ ] Trigger start-trial-checkout → completes via real card (use a low-balance card or pre-fund a test debit card with $5)
- [ ] Open Customer Portal → see invoice → can update payment method
- [ ] Confirm `subscriptions` table has a row with `status='trialing'` AND `stripe_subscription_id` starts with `sub_…` (not `sub_test_…`)
- [ ] Cancel subscription via portal → `subscriptions.status` flips to `canceled` AND `subscriptions.access_revoked_at` is set at period end
- [ ] Wait for webhook: `stripe_processed_events` row created within 5 seconds
- [ ] **Refund the test charge** via dashboard (you don't want to keep $400 of your own money)

### 10. Announce the live cutover

- Mark this checklist file **complete** with the live cutover date
- Comment on the BRT_BETA_LAUNCH_READY_RECEIPT.md with "Stripe live-mode active as of <date>"
- Add `paymentMode: 'live'` to PostHog group properties so observability dashboards distinguish live billing events

## Rollback procedure

If anything breaks in production:

1. Supabase edge fn env: restore test-mode values from 1Password
2. Vercel env: restore `VITE_STRIPE_PUBLISHABLE_KEY` to `pk_test_…`
3. Stripe dashboard: optionally disable the live webhook endpoint to silence event delivery
4. Customers already charged: refund via Stripe dashboard manually

Test mode is fully recoverable — every action above is reversible.

## Verification SQL

After step 9, run via MCP execute_sql:

```sql
SELECT id, status, stripe_subscription_id, stripe_customer_id, current_period_end
  FROM subscriptions
 WHERE stripe_subscription_id LIKE 'sub\_%' ESCAPE '\\'
   AND stripe_subscription_id NOT LIKE 'sub_test_%'
 ORDER BY created_at DESC LIMIT 5;
```

If 0 rows after a confirmed live checkout: webhook delivery is misconfigured. Check Stripe dashboard → Webhooks → Recent deliveries.

— End of checklist —
