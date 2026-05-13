# Support Runbook

Owner: Walker. Audience: SiteSync support staff (today: Walker; future: a small team).

This runbook covers customer support triage for inbound chat, email, and in-app reports. For ops alerts (cron failures, RLS drift, audit incidents) see `ALERT_RUNBOOK.md`. For incidents involving outage, data loss, or breach see `INCIDENT_RESPONSE.md`.

## Triage flow for incoming Crisp chats

1. **Acknowledge within SLA window.** See [SLA targets](#sla-targets) below.
2. **Classify the conversation** into one of four buckets:
   - **Question** — User wants to know how to do something. Point to help docs.
   - **Bug** — Something is broken. Reproduce, log to Linear, communicate ETA.
   - **Billing** — Payment, plan, cancellation. Handle via Stripe portal + Settings → Billing.
   - **Incident** — Data missing, security concern, outage. Escalate per `INCIDENT_RESPONSE.md`.
3. **Look up the customer** in Settings → Admin → Customer Lookup (org_id, email, or domain).
4. **Read recent activity** before responding. The customer's Audit Pack shows the last 50 events on their org — most "I can't find my RFI" questions resolve here without needing to impersonate.
5. **Respond.** Use the help docs as the canonical source. Link rather than retype.
6. **Close or escalate.** Set the Crisp conversation to `resolved` only after the customer confirms.

## When to impersonate

Customer impersonation is a sensitive operation. The `start-impersonation` edge function logs the session to the hash-chained audit trail and **automatically emails the customer** within 60 seconds notifying them that a SiteSync staff member is impersonating their account.

### When to impersonate

- Customer explicitly requested it: "Can you look at my account?"
- Bug reproduction requires their exact data state and you cannot reproduce locally.
- Audit pack export malfunctioning and you need to verify the fix in their org.

### When NOT to impersonate

- Curiosity or general account review — use Customer Lookup instead.
- Billing questions — handle via Stripe + Settings.
- Performance investigations — use telemetry + logs, not impersonation.

### Impersonation procedure

1. Get explicit customer consent in writing (Crisp transcript counts).
2. Settings → Admin → Customers → [Customer] → **Start Impersonation Session**.
3. Provide a reason (logged to audit trail). Minimum 20 characters, no boilerplate.
4. The session is time-boxed to 60 minutes. Renew if needed (also logged).
5. **The customer-notification contract:** Within 60 seconds the customer's org owner receives an email titled "A SiteSync staff member is reviewing your account." It includes the support staff's name, reason, and a "Revoke now" button. This is non-bypassable. Never disable.
6. End the session as soon as your task is complete: **End Impersonation Session**.
7. Document what you did in the original Crisp conversation so the customer has a written record.

## Common issues and fixes

### Signup blocked

**Symptoms:** "Can't create my account" — error after submitting signup form.

**Common causes:**
- Email already exists in another org. Resolution: ask them to use a different email or log in to the existing account.
- Turnstile (Cloudflare) challenge failed. Resolution: have them retry on a different network, often resolves immediately.
- Domain is on the disposable-email blocklist. Resolution: they need to use a corporate email. If legit, add their domain to the allowlist via Settings → Admin → Email Allowlist.

### Missing org

**Symptoms:** "I logged in and don't see my project" or "My org disappeared."

**Common causes:**
- They have multiple orgs and the active org switcher is on the wrong one. Resolution: Top-right org switcher → select correct org.
- They were removed from the org by another admin. Resolution: check the audit trail under Settings → Admin → Customer Lookup → Audit. If accidental, re-invite. If intentional, refer them to the admin who removed them.
- Org soft-deleted from cancellation. Resolution: see [Billing and cancellation](../../src/content/help/billing-and-cancellation.mdx) — 90-day soft-delete window applies, can be restored.

### Billing portal won't open

**Symptoms:** "Settings → Billing → Manage Subscription" returns an error or blank page.

**Common causes:**
- Customer's Stripe customer record is missing or the Stripe customer ID isn't synced. Resolution: Admin → Customer Lookup → Stripe → **Re-sync Stripe Customer**.
- Browser ad-blocker is blocking Stripe domain. Resolution: ask them to retry in incognito or disable blocker for `*.stripe.com`.
- Their session token expired mid-flow. Resolution: log out and back in.

### RFI numbering off

**Symptoms:** "My RFI just got numbered RFI-047 but the last one was RFI-012."

**Common causes:**
- A bulk-import or restore-from-backup advanced the counter. Resolution: Admin → Customer Lookup → Project → **Reset RFI Counter** to the desired value. Logged to audit trail.
- A failed RFI creation still consumed a number from the sequence. Resolution: explain the gap is intentional (the consumed number is "voided" — never reused — for auditability), no action needed.

## Escalation path

| Issue type | Escalate to | Channel |
| --- | --- | --- |
| Suspected data loss | Walker immediately | Slack DM + phone |
| Security incident (breach, unauthorized access) | Walker immediately + log P0 in Linear | Slack #incidents + page |
| RLS leak suspected | Walker immediately, then follow `ALERT_RUNBOOK.md` § rls-policy-drift | Slack #incidents |
| Customer threatening legal action | Walker | Slack DM |
| Press inquiry referencing a customer | Walker only — do not respond | Slack DM |
| Stripe webhook backlog | See `ALERT_RUNBOOK.md` § cron-error-rate-alert | Slack #ops |

## SLA targets

| Plan | First response | Resolution target |
| --- | --- | --- |
| Trial | < 24 h business hours | Best effort |
| Paid ($400/mo or $4,080/yr) | < 4 h business hours | < 2 business days for non-bug; per-incident for bugs |
| Enterprise (custom contract) | Per contract | Per contract |

Business hours: Monday–Friday 8am–6pm Pacific. Walker may respond outside hours but it's not contractual.

## Post-resolution

- Set Crisp conversation to `resolved`.
- If the issue uncovered a pattern (third customer hitting the same bug, repeated confusion about the same flow), log a follow-up issue in Linear tagged `support-pattern` and decide whether to fix docs or fix product.
- If impersonation was used, the audit entry should already be on the org's audit trail. Verify it appears.
