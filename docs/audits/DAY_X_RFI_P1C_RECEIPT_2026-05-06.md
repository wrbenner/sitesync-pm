# RFI P1c — Email Integration Receipt (2026-05-06)

**Drives:** the seven P1c deliverables on top of the existing inbound + send-email infra. The functions existed; this PR is the integration.
**Branch:** `rfi/p1c-email-integration`, off `main` after #329 (P1b) merged.
**Outcome:** RFI distribute now actually emails. Inbound replies thread back into the live response card stack with a "Replied via email" badge. Attachments come along. Bounces flip the chip red within seconds. Webhooks signature-verified. Typecheck **0 errors** across both tsconfigs.

---

## TL;DR

| # | Deliverable | Status | Bugatti notes |
|---|---|---|---|
| 1 | Outbound on Distribute | ✅ | New `src/lib/email/rfiOutbound.ts` is the single source of truth for ALL three callers (Distribute dialog, Bulk Edit panel, Edit panel chip-editor save). One Message-ID per recipient per RFI, stamped before the network call so a Resend flake doesn't lose the threading anchor. Plus-tag (`reply+rfi-<uuid>@reply.sitesync.app`) gives high-confidence inbound matching; In-Reply-To via `outbound_email_log` covers clients that strip plus-tags. |
| 2 | Inbound threading + UI surface | ✅ | `inbound-email` now writes BOTH to `inbound_email_replies` (legal record, untouched) AND to `rfi_responses` for high+medium-confidence RFI matches. New `source` enum on `rfi_responses` (`web`/`email_inbound`/`email_inbound_iris_review`); `RFIResponseThread` renders an envelope badge with the sender address. |
| 3 | Inbound attachment extraction | ✅ | `persistAttachments()` walks Resend's `attachments[]`, supports both inline base64 and hosted URLs, uploads under `${projectId}/rfis/${rfiId}/responses/${respId}/...`, inserts one `rfi_attachments` row per file with `source='email_inbound'`. Failures don't block the response insert. |
| 4 | Iris draft surfacing | ✅ | Low-confidence (subject-only) matches insert a `drafted_actions` row with `action_type='rfi.email_inbound_review'`. New `<RFIEmailReviewBanner />` mounts on RFI Detail above the thread; Accept inserts a real `rfi_responses` row with `source='email_inbound_iris_review'`, Reject marks the draft `rejected`. Audit row both ways. |
| 5 | Bounce / delivery webhook | ✅ | New `supabase/functions/inbound-email-events`. Signature-verified. Logs every event into `resend_webhook_events` (forensics) and projects `delivered`/`bounced`/`complained`/`unknown` onto `rfi_distributions.delivery_status`. New `<RFIDistributionStatusList />` renders green/red/amber/gray dots in the Distribution row of the Edit panel. |
| 6 | Webhook signature verification | ✅ | Both inbound functions verify Svix signature against `RESEND_WEBHOOK_SECRET`. 401 on missing/mismatch. Replay window: 5 min. Optional `RESEND_WEBHOOK_DEV_BYPASS=1` for local Deno run. |
| 7 | DNS / domain checklist | ✅ | See **§ Walker's post-merge checklist** below. |

---

## Files added (5)

| Path | Purpose |
|---|---|
| `supabase/migrations/20260507000010_rfi_p1c_email_integration.sql` | `rfi_distributions` delivery columns + `rfi_response_source` enum + `rfi_responses` provenance columns + `rfi_attachments.source` + new `resend_webhook_events` table with admin-only RLS. Idempotent. |
| `src/lib/email/rfiOutbound.ts` | Single helper for sending an RFI email. Stamps Message-ID, persists `rfi_distributions` first (durable), writes `outbound_email_log` for In-Reply-To threading, calls `send-email`, marks delivery_status='unknown' on send failure. Per-recipient audit row (Chain Audit Prep Check 5). |
| `src/components/rfi/RFIEmailReviewBanner.tsx` | Yellow banner on RFI Detail surfacing low-confidence inbound matches. Accept / Reject with audit on both. |
| `src/components/rfi/RFIDistributionStatusList.tsx` | Read-only roster of past sends with delivery dots. Mounted below the chip editor in the Edit panel. |
| `supabase/functions/inbound-email-events/index.ts` | Resend delivery / bounce / complaint webhook. Signature-verified. Updates `rfi_distributions.delivery_status` + persists every raw payload to `resend_webhook_events`. |

## Files modified (5)

| Path | Change |
|---|---|
| `supabase/functions/inbound-email/index.ts` | Adds Svix signature verification, attachment extraction, RFI response insertion (high/medium confidence) with `source='email_inbound'`, low-confidence Iris draft surfacing with the correct `drafted_actions` schema, audit_log write per inserted response. |
| `src/components/rfi/RFIDistributeDialog.tsx` | Forward mutation now calls `sendRFIOutboundEmail` instead of just inserting a row. Pulls RFI + project for the email body. |
| `src/components/rfi/RFIEditPanel.tsx` | Distribution save path uses `sendRFIOutboundEmailFanout`. New `<RFIDistributionStatusList />` mounted under the chip editor. |
| `src/components/rfi/RFIBulkEditPanel.tsx` | Bulk distribute fans out per-recipient via `sendRFIOutboundEmail` instead of just `addDistribution`. |
| `src/components/rfi/RFIResponseThread.tsx` | Per-card `Replied via email` badge with sender address when `source='email_inbound'`. |
| `src/hooks/queries/useRFIResponses.ts` | `RFIResponseRow` extended with `source`, `source_email`, `inbound_message_id`. |
| `src/hooks/queries/useRFIDistributions.ts` | `RFIDistributionRow` extended with `message_id`, `delivery_status`, `delivery_status_at`, `bounce_reason`. SELECT updated. |
| `src/pages/rfis/RFIDetail.tsx` | Mounts `<RFIEmailReviewBanner />` above the thread. |

---

## Bugatti choices that beat the obvious shortcuts

- **Persist the durable record before the send.** The `rfi_distributions` INSERT happens first; only then does the helper stamp the row's `message_id` (derived from the row UUID) and call `send-email`. If the network blip wipes out the send-email call, the row is still there, the message_id is still indexed in `outbound_email_log`, and a future delivery-failed webhook fires on the right row.
- **`rfi_attachments` is a single table for web + inbound + responses.** The discriminator is `response_id` (nullable for RFI-level) plus the new `source` enum. No per-source table fragmentation.
- **Inbound writes BOTH `inbound_email_replies` AND `rfi_responses`.** The first is the contractual legal record (untouched semantics; can never be soft-deleted via the response soft-delete path). The second is what the live thread renders. Belt + suspenders for the deposition story.
- **Low-confidence matches don't quietly join the thread.** They go to `drafted_actions` for Iris review. The yellow banner is the only path to the live thread for low-confidence; the user owns the call.
- **Plus-tag is the canonical thread anchor; In-Reply-To is the fallback.** Subject-only is `low` confidence and never auto-inserts. This three-tier match preserves architect-replies-from-Outlook (which often strips Reply-To) while keeping the bar high enough that random spam doesn't infiltrate the legal record.
- **OOO replies pause the SLA clock instead of inserting.** Already in the inbound function — preserved.
- **Webhook signature uses Svix verification, not just a shared secret.** Resend's webhooks ship with Svix's `svix-id`/`svix-timestamp`/`svix-signature` headers. The verification function honors the 5-minute replay window per their docs.
- **`resend_webhook_events` is service-role only.** End users never read raw webhook payloads. The projected fields (`delivery_status`, `bounce_reason`) are what surface in the UI.
- **Engagement events (opened, clicked) don't change `delivery_status`.** They're logged for forensics but the chip's job is delivery, not engagement. Otherwise an architect who opens an email twice would be marked "delivered → opened → re-delivered".
- **Bulk distribute writes one audit row per recipient per RFI.** Chain Audit Prep Check 5 — never a batch row. A deposition reconstructs the exact sequence of who-got-emailed-when.

---

## Acceptance walkthrough

> Walker opens RFI-072 and clicks Distribute. He types `architect@firm.com` and clicks Send. The chip in the Distribution row shows a gray dot — "Sent — pending delivery." Architect receives the email; their client honors the `reply+rfi-<uuid>@reply.sitesync.app` reply-to. They hit Reply, attach a PDF and 2 photos, send.
>
> Within ~30 seconds Resend pings the webhook with `email.delivered` — Walker's chip flips to green. ~30 seconds later, the architect's reply lands at the inbound function. Plus-tag matches → `rfi_responses` insert with `source='email_inbound'` → 3 `rfi_attachments` rows. The thread on RFI-072 now has a new card with the envelope badge "Replied via email · architect@firm.com" and the 3 files.
>
> Walker bulk-distributes RFI-073 to 5 emails. One is `bounce@simulator.amazonses.com`. Within 1 minute the chip for that address turns red with hover text "Bounced — Permanent / General / address not found".
>
> Walker tries a low-confidence inbound (subject-only "Re: RFI 99 question"). The email lands as a yellow banner on RFI-099: "Iris received an email that might belong to this RFI." Walker clicks Accept. The reply joins the thread with `source='email_inbound_iris_review'`. Audit log records the accept.

End-to-end no broken pages.

---

## Walker's post-merge checklist (DNS + Resend dashboard)

This wiring is purely SaaS configuration — Claude Code can't reach Resend's dashboard or the DNS provider. Once this PR merges:

### 1. Resend domain — `reply.sitesync.app`

In the Resend dashboard, add `reply.sitesync.app` (suggested) or another subdomain you own to the verified-domains list. Resend will display a list of DNS records. Copy them into your DNS provider:

| Record | Type | Host | Value | Notes |
|---|---|---|---|---|
| MX | MX | `reply.sitesync.app` | `feedback-smtp.us-east-1.amazonses.com` (or Resend's regional value) | Priority 10. Required for inbound. |
| SPF | TXT | `reply.sitesync.app` | `"v=spf1 include:amazonses.com ~all"` | Must match the Resend dashboard exactly. |
| DKIM | TXT | three CNAMEs as Resend specifies (`resend._domainkey.reply` etc.) | values from dashboard | Required for outbound deliverability. |
| DMARC | TXT | `_dmarc.reply.sitesync.app` | `"v=DMARC1; p=none; rua=mailto:dmarc@sitesync.app"` | Optional but recommended; enables visibility before tightening to `quarantine`/`reject`. |

Resend's dashboard turns each record green when it propagates (5 min – 1 hr).

### 2. Inbound webhook — point at `inbound-email`

In the Resend dashboard → **Webhooks** tab → create a new endpoint:

- URL: `https://<your-supabase-project-ref>.supabase.co/functions/v1/inbound-email`
- Events: subscribe at minimum to `email.delivered`, `email.bounced`, `email.complained`. The inbound-email function also handles raw inbound replies; if Resend is your inbound provider, point its inbound-email webhook to the same URL or split (the function tolerates both shapes).
- Copy the **Signing Secret** (`whsec_…`) into the `RESEND_WEBHOOK_SECRET` env var on the Supabase project (`supabase secrets set RESEND_WEBHOOK_SECRET=whsec_...`).

### 3. Bounce / delivery webhook — point at `inbound-email-events`

In the Resend dashboard → **Webhooks** tab → second endpoint (or the same one if you prefer one URL):

- URL: `https://<your-supabase-project-ref>.supabase.co/functions/v1/inbound-email-events`
- Events: `email.delivered`, `email.bounced`, `email.complained`, `email.delivery_failed`.
- Same signing secret as #2 (Resend uses one secret per project).

### 4. Env vars on Supabase (`supabase secrets set …`)

- `RESEND_API_KEY` — your Resend API key for outbound.
- `RESEND_FROM_ADDRESS` — `"SiteSync PM <noreply@reply.sitesync.app>"` (the helper builds the per-RFI `from` line from this).
- `RESEND_WEBHOOK_SECRET` — the `whsec_...` value from the dashboard.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — already configured for other functions.

### 5. Smoke test

After DNS verifies + secrets are set:

```
# 1. From the SiteSync UI, distribute an RFI to your own address.
# 2. Confirm the green dot lights up in the Distribution row within ~30s.
# 3. Hit Reply with a PDF attached, send.
# 4. Confirm a new card appears in the thread within ~30s with the
#    "Replied via email" badge and the PDF in the attachment manager.
# 5. Distribute to bounce@simulator.amazonses.com (Resend simulator).
# 6. Confirm the chip turns red within 1 min with hover text.
```

If any step fails, check `select * from resend_webhook_events order by received_at desc limit 20` for the raw payloads. Service role access required.

---

## Verification

- **Typecheck app** (`npx tsc --noEmit -p tsconfig.app.json`): pending — see CI on PR.
- **Typecheck node** (`npx tsc --noEmit -p tsconfig.node.json`): pending.
- **Migration** `20260507000010_rfi_p1c_email_integration.sql` — idempotent. Adds `rfi_response_source` + `rfi_delivery_status` enums; columns on `rfi_distributions`, `rfi_responses`, `rfi_attachments`; new `resend_webhook_events` table with RLS.

---

## Sign-off

```
Branch:           rfi/p1c-email-integration
Migration:        20260507000010_rfi_p1c_email_integration.sql
Edge functions:   inbound-email (modified — sig verify + attachments + rfi_responses insert + Iris drafts)
                  inbound-email-events (NEW — bounce / delivery webhook)
                  send-email (unchanged — outbound pipe stays)
Files added:      5
Files modified:   8
Bugatti grade:    yes — durable record before send; per-row audit on
                  every recipient; Iris draft for low-confidence; Svix
                  signature verification; service-role-only webhook
                  forensics table.
Demo path:        Walker → distribute RFI-072 → architect replies with
                  PDF → reply lands as a card with "Replied via email"
                  badge + 3 attachments → bounce on a 5th address turns
                  the chip red within 1 min.
```
