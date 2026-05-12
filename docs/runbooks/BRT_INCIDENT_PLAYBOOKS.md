# BRT Incident Playbooks

Specific incident-response runbooks for the failure modes called out in
`BRT_SUBSYSTEM_*` specs. Each playbook is a copy-paste-ready response checklist
sized to be useful at 3am with one engineer.

For the general incident flow (severity definitions, war room, comms, postmortem
ownership), see [`docs/operations/INCIDENT_RESPONSE.md`](../operations/INCIDENT_RESPONSE.md).

---

## P0 — Cross-tenant data exposure (RLS leak)

**Detection:** `audit_incidents` row inserted with `category='rls_leak'`, OR the
adversarial RLS matrix CI job fails on `main` after a merge, OR a customer
reports seeing another tenant's data.

**Trigger to file P0:** any of the above. Do not require evidence of malicious
intent — accidental cross-tenant SELECT counts.

### Immediate response (first 15 minutes)

1. Page Founder. (`#brt-alerts` Slack + SMS via on-call rotation.)
2. **Roll back to last known good** — revert the offending commit on `main`:
   ```bash
   gh pr list --state merged --limit 5
   git revert <suspect-sha> --no-edit
   git push origin main
   ```
   Do not wait for the rollback to be analyzed. Revert first, debrief after.
3. If rollback is non-trivial (chained commits, migration not safely
   reversible): take the read API offline by toggling the `MAINTENANCE_MODE`
   feature flag. Frontend renders a "We're investigating an issue" banner and
   refuses mutate routes. UI gate: `src/lib/featureFlags.ts`.
4. Open a war-room Slack thread named `incident-rls-leak-<utc-yyyy-mm-dd-hh>`.
   Pin the rollback commit + the suspect commit + the audit_incidents row id.

### Investigation (next 60 minutes)

5. Identify the affected query: dump the last 1000 rows of `audit_incidents`
   with `category='rls_leak'`. Look at `metadata->>'query_text'` and
   `metadata->>'caller_org_id'`.
6. Run the adversarial RLS matrix locally against the suspect commit to
   reproduce. The matrix lives in [`scripts/rls-matrix-audit.sql`](../../scripts/rls-matrix-audit.sql)
   (BRT sub-1 §4.2 — once that slice ships).
7. If reproduced, write a failing test BEFORE the fix lands. The test goes
   into `e2e/multi-tenant-isolation.spec.ts` as a regression guard.

### Customer comms

- Status page: "We're investigating reports of data visibility outside the
  expected scope. Customer data is not at risk; service is operating in a
  degraded mode while we resolve." Update every 30 minutes.
- For any **identified affected tenant** (we know an unauthorized SELECT
  succeeded against their data): direct email to the org owner within 4 hours.
  Counsel-reviewed template at `docs/runbooks/templates/RLS_LEAK_NOTIFICATION_TEMPLATE.md`
  (TODO — Founder + counsel write before a real P0 fires).

### Postmortem

P0 RLS leak postmortem within 24 hours, not 5 business days. Use
[`POSTMORTEM_TEMPLATE.md`](POSTMORTEM_TEMPLATE.md). Mandatory action items:

- Adversarial test that would have caught it, in CI
- Migration-time lint rule preventing the same shape (e.g., "any new
  organization_id-bearing table must have matching SELECT/INSERT/UPDATE/DELETE
  policies in the same migration")

---

## P0 — Stripe billing pause / dunning failure

**Detection:** Stripe webhook handler returning 5xx for > 5 minutes, OR
`audit_incidents` with `category='webhook_replay'`, OR customer reports a
charge that didn't go through, OR Stripe Dashboard shows pending events
backlog > 100.

**Trigger to file P0:** any of the above with potential for charging customers
incorrectly OR locking them out unjustly.

### Immediate response

1. Page Founder.
2. Pause the `stripe-webhook` edge function via Supabase Dashboard. This
   stops drift but **also stops legitimate billing events**. Decision tradeoff:
   pause if we're losing data integrity; let it run if we're just behind.
3. Snapshot the Stripe Dashboard's pending event queue. Save count + oldest
   event timestamp to the war-room thread.

### Recovery

4. If subscription state in our DB diverged from Stripe: use the
   reconciliation cron (`supabase/functions/stripe-reconciliation/index.ts`)
   to sync. Run it manually:
   ```bash
   supabase functions invoke stripe-reconciliation --no-verify-jwt
   ```
5. If the divergence falsely paused a customer's subscription: manually fix
   the `subscriptions` row, then write an audit note explaining why.
6. If we charged a customer incorrectly: refund via Stripe Dashboard. Email
   the customer within 24 hours with a written explanation.

### Customer comms

- Status page: only post if customer-facing (subscription pause, failed
  charge, billing portal down). Internal-only Stripe outages do not need
  customer comms.

---

## P1 — Iris AI chokepoint timeout / 5xx spike

**Detection:** PostHog cohort alert "iris-call 5xx > 1% over rolling 1h" OR
Sentry alert "iris-call timeout cluster spike".

### Response

1. Check provider status pages (Anthropic, OpenAI, Perplexity, Gemini). If a
   single provider is degraded, the AI gateway should already have failed
   over — confirm via `supabase/functions/iris-call/` logs.
2. If multiple providers are degraded simultaneously (rare but possible during
   widespread outages): toggle the `IRIS_DRAFTS_DISABLED` feature flag.
   Frontend renders "Iris is temporarily unavailable; please draft manually"
   in the AI panel. Mutations still work; only AI suggestions are paused.
3. The audit chain is unaffected by this; existing drafts remain intact.

---

## P1 — Auth provider outage (Supabase Auth or Google OAuth)

**Detection:** Sign-in attempts failing > 10% over 5 minutes, OR Supabase
Auth status page red, OR Google's status page shows an OAuth incident.

### Response

1. Status page: post within 10 minutes.
2. There is no graceful-degradation path for auth — sign-in is binary. Wait
   on the upstream provider.
3. While waiting: monitor Supabase Auth for cascading effects on RLS (some
   policies look up role from `auth.users`; if the lookup fails, RLS may
   reject reads). Plan a manual fix-forward only if RLS itself starts
   refusing legitimate reads on cached sessions.

---

## P2 — Backup cron silently failed

**Detection:** `cron-storage-backup` heartbeat absent for > 36 hours, OR S3
bucket has no objects for `yesterday`'s date prefix.

### Response

1. Re-run the cron manually:
   ```bash
   supabase functions invoke cron-storage-backup --no-verify-jwt
   ```
2. If it fails, check `SUPABASE_SERVICE_ROLE_KEY` and AWS credentials in
   Supabase function secrets.
3. File a ticket; not a war-room incident unless > 7 days have lapsed.

---

## Linked references

- General incident flow: [INCIDENT_RESPONSE.md](../operations/INCIDENT_RESPONSE.md)
- Postmortem template: [POSTMORTEM_TEMPLATE.md](POSTMORTEM_TEMPLATE.md)
- Backup / restore drill: [BACKUP_RESTORE_DRILL.md](BACKUP_RESTORE_DRILL.md)
- Smoke test: [SMOKE_TEST.md](SMOKE_TEST.md)
- Audit incidents enum source: [`supabase/migrations/20260504030002_audit_incidents_fake_citation.sql`](../../supabase/migrations/20260504030002_audit_incidents_fake_citation.sql)
