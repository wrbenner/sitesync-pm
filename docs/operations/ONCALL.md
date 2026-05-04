# On-Call

This page describes the on-call rotation, the duties of the on-call engineer, and the handoff protocol.

## Rotation

The on-call rotation runs weekly. The schedule is maintained in PagerDuty (or the team's equivalent). The rotation should always have:

- A primary on-call (first responder)
- A backup on-call (second responder if primary doesn't ack within 15 minutes)
- An escalation lead (engineering manager or designated senior)

## What the on-call does

### During business hours

- Triage Slack #ops alerts.
- Respond to Sev 2 / Sev 3 within the timelines in [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md) and [business/SLA.md](../business/SLA.md).
- Monitor the dashboards listed in [MONITORING.md](MONITORING.md).
- Review overnight alert noise and tune thresholds.

### After hours

- Respond to PagerDuty Sev 1 incidents within the time targets in [business/SLA.md](../business/SLA.md).
- Sev 2 / Sev 3 can wait until the next business day unless they are escalating.

### Daily checks

- Audit chain verification — confirm the nightly run has zero broken rows. If broken: see [HASH_CHAIN_INVARIANTS.md](../HASH_CHAIN_INVARIANTS.md) and the verifier at [src/lib/audit/hashChainVerifier.ts](../../src/lib/audit/hashChainVerifier.ts).
- Edge function error rates — see [MONITORING.md](MONITORING.md).
- Bundle size on `main` — confirm no regression past the budget in [scripts/check-bundle-size.js](../../scripts/check-bundle-size.js).
- Cron registrations — confirm the active crons listed in [DEPLOY.md](DEPLOY.md) are still firing on schedule.

### Weekly checks

- Review the wiring backlog in [STATUS.md](../STATUS.md). Cross off items that landed during the week; surface stale items in the engineering planning meeting.
- Run the link checker against docs: `npx tsx scripts/check-doc-links.ts`. New docs must not introduce broken links.
- Confirm restore drill ran on the first Tuesday of the month — see [.github/workflows/restore-drill.yml](../../.github/workflows/restore-drill.yml) and [DR.md](DR.md).

## What the on-call does NOT do

- Approve PRs (per the project's CLAUDE.md, only humans approve).
- Push schema migrations without review.
- Touch a customer's data without an active support ticket from that customer.

## Handoff protocol

Each Monday at 09:00 local, outgoing on-call hands off to incoming with:

- A list of open incidents (status, owner, expected resolution).
- A list of any temporary mitigations (e.g., feature flags flipped).
- Any anomalies in the audit chain, perf metrics, or error rates that warrant attention.

The handoff is recorded in the team's on-call log (Notion / runbook page).

## Escalation matrix

| Situation | Escalate to |
| --- | --- |
| Database corruption suspected | Engineering lead + Supabase support |
| Audit chain break that is NOT a restore artifact | CISO + engineering lead |
| Customer reports data they did not author appears in their org | Immediate: engineering lead + security lead. RLS investigation per [src/lib/rls.ts](../../src/lib/rls.ts) and the migrations under `supabase/migrations`. |
| Pay-app submitted with the audit gate bypassed | Engineering lead + compliance officer. Check [supabase/migrations/20260429020000_payapp_audit_overrides.sql](../../supabase/migrations/20260429020000_payapp_audit_overrides.sql) for the override row. |
| Iris produced an action that committed without an approval row | Engineering lead. Confirm against [supabase/migrations/20260427000010_drafted_actions.sql](../../supabase/migrations/20260427000010_drafted_actions.sql). |

## Tools the on-call needs access to

- PagerDuty
- Sentry (frontend + edge function errors)
- Supabase dashboard (DB, edge function logs, storage)
- Production read-only DB credentials (rotated quarterly per [DR_RUNBOOK.md](../DR_RUNBOOK.md))
- Slack #ops + customer-facing Slack channels
- The deployed alert webhooks for [.github/workflows/restore-drill.yml](../../.github/workflows/restore-drill.yml)

## Where the runbook lives

Page-specific runbooks:
- DR — [DR.md](DR.md) summary; [DR_RUNBOOK.md](../DR_RUNBOOK.md) full
- Incident response — [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md)
- Monitoring — [MONITORING.md](MONITORING.md)
- Deploy — [DEPLOY.md](DEPLOY.md)
