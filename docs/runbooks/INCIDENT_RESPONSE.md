# Incident Response Runbook

Owner: Walker. Audience: SiteSync incident responders (today: Walker — staffed-by-1 reality).

This runbook defines the severity ladder, roles during an incident, communication channels, and specific playbooks for the four highest-likelihood incident classes. For alert-specific triage see `ALERT_RUNBOOK.md`. For customer support see `SUPPORT_RUNBOOK.md`.

## Severity ladder

| Severity | Definition | Examples |
| --- | --- | --- |
| **P0 — Ship-stopper** | Production is down or data integrity is compromised. Action required immediately, regardless of time of day. | RLS leak detected. Hash-chain break. Full site outage. Auth completely broken. Stripe charging customers incorrectly. |
| **P1 — Major degradation** | Significant functionality impaired for multiple customers. Action required within business hours. | A core page (RFIs, Drawings, Daily Logs) is broken for all users. SLA escalation cron not firing. Email delivery failing org-wide. |
| **P2 — Minor bug** | A specific feature is broken or degraded for some users. Action required within 2 business days. | Single RFI's audit entry shows wrong timestamp. Photo upload fails for files > 50 MB. CSV export missing a column. |

Promote a P1 to P0 if it spreads to multiple subsystems or if customer trust is at stake. Demote only after the immediate threat is contained.

## Roles during an incident

In a staffed organization, three roles separate. At SiteSync today, **all three are Walker.** This is documented so we know what to delegate first when we hire.

- **Incident Commander (IC).** Owns the response. Decides priority of actions. Calls escalations. Today: Walker.
- **Comms Lead.** Manages customer notification, internal updates, status page. Today: Walker.
- **Engineering Lead.** Drives the technical fix. Today: Walker.

**Staffed-by-1 protocol:** When Walker is the only responder, prioritize in this order: (1) stop the bleeding, (2) preserve evidence, (3) communicate to affected customers, (4) write post-mortem. Resist the urge to debug root cause before stopping the bleeding.

## Communication channels

| Channel | Purpose | Audience |
| --- | --- | --- |
| Slack #incidents | Live incident coordination | Internal |
| Slack #ops | Routine alerts, deploy notes | Internal |
| Crisp banner | Customer-facing status during major incidents | All customers |
| Status page (`status.sitesync.app`) | Public uptime + incident log | All customers + prospects |
| Direct email | Per-org notification for breaches, RLS leaks, billing errors | Affected org owners + admins |

Crisp banner is the fastest way to reach all logged-in users. It renders at the top of every page within 60s of activation. Use for P0/P1.

## Post-incident

Every P0 and P1 requires a written post-mortem within 5 business days. We use `BRT_POSTMORTEM_TEMPLATE.md` (in the BRT spec set) as the canonical template — do not duplicate it here. Required sections:

- Summary (1 paragraph)
- Timeline (UTC, every meaningful event)
- Root cause
- Resolution
- Customer impact (which orgs, what they saw, what we told them)
- Action items (with owners and due dates)
- Lessons learned

P0 post-mortems are shared with affected customers on request. P1 are internal unless we choose to publish.

## Specific playbooks

The full catalog of incident playbooks lives in `BRT_INCIDENT_PLAYBOOKS.md` (BRT spec set, source of truth). The four below are inline for the highest-likelihood scenarios.

### (a) RLS leak detected

**Trigger:** `audit_incidents` Slack page with class `rls_leak`, or manual report from customer or staff.

1. **Stop the bleeding (within 15 min):**
   - Identify the offending code path. If a recent migration, follow `PRODUCTION_DEPLOY.md` § Migration Rollback.
   - If a recent edge function change, revert via `git revert` + redeploy.
   - If unknown source, temporarily disable the suspicious endpoint via feature flag.
2. **Preserve evidence (within 30 min):**
   - Snapshot the audit trail for the exposure window: `SELECT * FROM audit_log WHERE created_at BETWEEN <start> AND <end>` exported to JSON. Store in `incidents/<date>/rls_leak/`.
   - Enumerate affected orgs via the audit query: `SELECT DISTINCT org_id FROM audit_log WHERE event_type = 'cross_org_select_detected' AND created_at BETWEEN <start> AND <end>`.
3. **Communicate (within 1 hour):**
   - Slack #incidents update with scope.
   - Crisp banner if customer-facing impact.
   - If notification threshold met (see `ALERT_RUNBOOK.md` § Data-breach disclosure thresholds), draft per-org email and send within 72 hours.
4. **Fix forward:**
   - Add a regression test to `npm run test:rls-adversarial` that exercises the leaked path.
   - Update the RLS baseline (`db/baselines/rls-baseline.sql`) only after the fix passes adversarial tests.
5. **Post-mortem.**

### (b) Stripe webhook delivery failed

**Trigger:** Stripe dashboard webhook delivery failure rate alert, or customer reports payment-state mismatch.

1. Check Stripe dashboard → Developers → Webhooks → SiteSync endpoint. Read the failure reason (signature mismatch? 5xx from us? timeout?).
2. Replay failed events from the Stripe dashboard once the issue is fixed. Stripe retains 30 days of replayable events.
3. For state reconciliation: `Settings → Admin → Stripe → Reconcile Subscriptions` runs a sweep that compares our `subscriptions` table against Stripe's source of truth and surfaces deltas.
4. **Common causes:**
   - Webhook secret rotated but not updated in env. Fix: update Supabase secret, redeploy webhook handler.
   - Our endpoint returned 5xx during an outage. Replay failed events.
   - Stripe schema changed (rare; they version their events). Update handler.
5. If customer was charged but state didn't update: manually correct via Settings → Admin → Subscription Override + log to audit trail.

### (c) Supabase outage

**Trigger:** Supabase status page reports incident, OR our app starts returning 5xx with `connection refused` or `timeout` on Supabase calls.

1. Confirm via `status.supabase.com`. If a regional incident, note our region (us-east-1 default).
2. Post Crisp banner: "We're experiencing degraded service due to upstream provider issues. We're monitoring closely."
3. Update status page.
4. **Do not attempt failover.** SiteSync is single-region by design at this stage. A failover would be a multi-day project we have not yet done.
5. Stripe webhook retries are idempotent — they'll catch up after recovery.
6. After recovery: run reconciliation sweeps for any cron jobs that may have missed firing windows (SLA escalation, daily log auto-draft). These are documented in each function's `__catchup__` mode.

### (d) Vercel deployment broken

**Trigger:** Smoke tests fail post-deploy, or customer reports the app won't load.

1. Immediately roll back via Vercel dashboard → Deployments → Promote previous green deploy to production. See `PRODUCTION_DEPLOY.md` § Rollback.
2. Verify smoke tests pass against the rolled-back version.
3. Post Slack #ops with: rolled-back from `<bad-sha>` to `<good-sha>`, reason, ETA on fix.
4. Investigate the broken deploy in a feature branch. Do not retry the deploy until the issue is identified.
5. Update the post-deploy smoke script if the failure mode wasn't caught — every incident is a chance to harden the smoke pass.

## Source of truth references

- Severity ladder + roles: this file.
- Alert-specific triage: `ALERT_RUNBOOK.md`.
- Deploy + rollback mechanics: `PRODUCTION_DEPLOY.md`.
- Customer support flows: `SUPPORT_RUNBOOK.md`.
- Post-mortem template: `BRT_POSTMORTEM_TEMPLATE.md`.
- Full playbook catalog: `BRT_INCIDENT_PLAYBOOKS.md`.
