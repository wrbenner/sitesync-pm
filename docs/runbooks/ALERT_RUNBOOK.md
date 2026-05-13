# Alert Runbook

Owner: Walker. Audience: SiteSync ops on-call (today: Walker).

One section per alert that fires. Each section covers: what fires it, where to look, triage steps, when to escalate, and rollback criteria. All alerts ping Slack channels per the BRT Phase 1 Sub-6 observability spec.

For customer-facing support issues see `SUPPORT_RUNBOOK.md`. For incident command see `INCIDENT_RESPONSE.md`.

---

## `cron-error-rate-alert`

**Channel:** Slack #ops (hourly)
**Trigger:** 5xx error rate on edge functions or cron jobs > 1% over the last hour.
**Source of truth:** Sentry → "Edge Function 5xx" issue stream + Supabase Function Logs.

### Triage steps

1. Click through the Slack alert to the Sentry issue. Read the top 3 stack frames.
2. Identify the function: is it a scheduled cron (`sla-escalation-ladder`, `daily-log-auto-draft`) or a synchronous edge function (`start-impersonation`, `stripe-webhook`)?
3. Check Supabase Function Logs for the same window — filter by `level=error`. Sentry sees what's caught; Supabase sees raw runtime failures.
4. Check the Vercel dashboard for the SPA — a 5xx storm on edge fns often coincides with a frontend deployment that started sending malformed payloads.
5. Identify whether the failures are:
   - **New** (started in last hour) → likely caused by recent deploy.
   - **Sustained** (running > 4 hours) → likely external dependency (Stripe, Mapbox, OpenAI) or Supabase regional issue.
   - **Intermittent** (bursty) → likely rate limit or transient.

### When to roll back

Roll back the most recent deploy if **all** of:
- Error rate > 5% sustained > 15 min.
- New failure mode (not seen prior to last deploy).
- No clear fix-forward path within 30 min.

Roll back via `vercel rollback` (see `PRODUCTION_DEPLOY.md` § Rollback). Communicate in Slack #incidents simultaneously.

---

## `cron-conversion-alert`

**Channel:** Slack #growth (daily, runs at 9am Pacific)
**Trigger:** Signup-to-activation conversion drops by > 20% week-over-week.
**Source of truth:** PostHog funnel `signup_started → signup_completed → first_rfi_created`.

### Triage steps

1. Open the PostHog funnel link in the Slack message.
2. Identify which step dropped:
   - `signup_started → signup_email_submitted` drop → frontend signup bug or Turnstile failing.
   - `signup_email_submitted → signup_email_verified` drop → email delivery (Resend) issue. Check Resend dashboard for bounce rate spike.
   - `signup_email_verified → signup_org_provisioned` drop → backend provisioning bug. Check Supabase logs for `org-provisioning` function errors.
   - `signup_completed → first_rfi_created` drop → onboarding wizard friction. Check `onboarding_step_skipped` rates per step.
3. Check signup attribution in PostHog → Dashboards → "Signup Sources" to rule out marketing-traffic drop (a campaign ending will look like a conversion alert).
4. If genuine product friction, file in Linear tagged `activation` and prioritize.

### When to escalate

If the conversion drop coincides with a deploy and `signup_started` events are still firing normally, escalate to incident response — this is a regression. Roll back if no fix in 1 hour.

---

## `rls-policy-drift`

**Channel:** Slack #security (nightly, runs at 2am Pacific)
**Trigger:** The nightly RLS invariant test suite detects any policy change from the baseline.
**Source of truth:** `npm run test:rls-invariants` in GitHub Actions nightly workflow.

**This is the I1 ship-stopper.** A drift detection means the live database RLS state diverges from what the test suite proves is leak-free. Until proven safe, assume data may be cross-org accessible.

### Triage steps

1. Open the failing GitHub Actions run. Read the diff: which policy on which table changed?
2. Compare against the baseline in `db/baselines/rls-baseline.sql` (committed; this is the proof artifact).
3. Cross-check the migration log: `npx supabase migration list --linked`. Was a migration applied that touched RLS?
4. If a migration changed policy intentionally:
   - Verify the new policy passes the adversarial test suite: `npm run test:rls-adversarial`.
   - If green, update the baseline: `npm run test:rls-baseline:update`. Commit with a `[rls-baseline]` tag in the message.
   - If red, the migration introduced a leak. Revert immediately. See [data-breach disclosure](#data-breach-disclosure-thresholds).
5. If no recent migration but the policy changed, **someone or something changed RLS out-of-band** (e.g., a Supabase dashboard edit). This is a P0. Page Walker. Treat as compromise until proven otherwise.

### When to involve outside counsel

If any of:
- A row was returned to the wrong org during the drift window (test for this by querying audit logs filtered to cross-org SELECT events).
- The drift cannot be explained by a known migration or commit.
- More than 24 hours elapsed between the drift introduction and detection.

Engage data-breach counsel. See [thresholds](#data-breach-disclosure-thresholds) below.

---

## `audit_incidents` P0 trigger

**Channel:** Slack #incidents (real-time page, also fires PagerDuty)
**Trigger:** One of three audit incident classes:
- `rls_leak` — A SELECT query returned rows from an org other than the caller's. Detected by audit-trail anomaly scanner.
- `chain_break` — The hash-chained audit log has a broken link (entry N+1 does not reference hash of entry N).
- `key_leak` — A request log contains a secret key (Stripe key, JWT, API key) in headers or body, detected by post-hoc scrubber audit.

### Immediate response procedure

This is a P0. Treat per `INCIDENT_RESPONSE.md`. Sketch:

1. **Within 5 minutes:** Acknowledge the page. Open Slack #incidents thread.
2. **Within 15 minutes:** Identify scope. Which org(s)? Which rows? How long was the exposure window? Use the audit trail to enumerate.
3. **Within 30 minutes:** Stop the bleeding. Disable the offending code path (feature flag), revoke leaked keys, or rotate. Do not delete the audit evidence.
4. **Within 1 hour:** Customer notification draft. See [thresholds](#data-breach-disclosure-thresholds) for what counts as notifiable.
5. **Within 24 hours:** Post-mortem draft. Use `BRT_POSTMORTEM_TEMPLATE.md`.

For `chain_break` specifically: the hash chain is forensically critical. **Do not delete or rewrite** broken entries. Document the break, append a remediation entry, and continue the chain forward from there.

---

## Data-breach disclosure thresholds

US state laws and GDPR set the floor. SiteSync's policy is stricter: when in doubt, disclose.

### US state laws

48 of 50 states have data-breach notification laws (exceptions: Alabama and South Dakota — both with limited statutes). Triggers vary but generally include unauthorized access to:
- Name + SSN
- Name + driver's license / state ID
- Name + financial account + access credential
- Name + medical info or health insurance ID

SiteSync collects: name, email, phone, org/license info, and project content. We do not collect SSN, driver's license, or medical info. Most US state breach laws **do not** trigger on email-only exposure, but **California (CCPA/CPRA)**, **New York (SHIELD)**, and **Massachusetts (201 CMR 17)** are stricter. Assume notification required if more than 500 California residents are affected.

Timeline: most US states require notification "in the most expedient time possible and without unreasonable delay." Some specify a max (e.g., Florida: 30 days; Colorado: 30 days). Default to **72 hours** to be safe.

### GDPR (Article 33)

EU residents trigger GDPR. Notification timeline: **72 hours from awareness** to the relevant supervisory authority. Customer (data subject) notification required "without undue delay" if high risk.

### Disclosure decision matrix

| Scope | Action |
| --- | --- |
| RLS leak: 1 row exposed, same trust boundary, < 1 hour, no evidence accessed | Internal incident report. No customer disclosure. |
| RLS leak: any row crossed org boundary, accessed or not | Notify affected org(s) within 72 hours. |
| Key leak: API key visible in logs, no evidence of external access | Rotate. Internal report. |
| Key leak: key used by unauthorized party | Notify affected org(s) within 72 hours. Engage counsel. |
| Chain break: detected, scope < 100 entries | Internal report + audit-trail annotation. |
| Chain break: > 100 entries OR coincides with suspicious activity | Notify affected org(s). Engage counsel. May qualify as material under SOC 2 controls. |

**When in doubt, page Walker and engage counsel.** Under-disclosure has worse consequences than over-disclosure.
