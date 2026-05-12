# Updating payment method

Settings → Billing → **Manage payment method** opens the Stripe Customer Portal, where you can:

- Add a new card or bank account
- Set the default payment method
- Remove old cards
- Download invoices and receipts

We never see or store your full card number — it lives at Stripe.

## ACH (US)

ACH bank-debit is supported and avoids the 2.9% card fee. Verification takes 1–2 business days.

## Failed payments

If a charge fails, we email you immediately and retry per Stripe's smart retry schedule (day 1, 3, 7). After 7 days of failure, the workspace enters read-only mode until you update the method. We never quietly suspend.
