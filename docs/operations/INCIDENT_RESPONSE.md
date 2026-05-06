# Incident Response

This is the runbook for incidents — production faults, data integrity events, security events. It defines severity classifications, response timelines, and the per-class runbooks.

## Severity classification

| Severity | Definition | Response time (Enterprise) | Response time (Pro) |
| --- | --- | --- | --- |
| Sev 1 | Production down for multiple users; OR data integrity event; OR security breach with active exploit | 1 hour, 24/7/365 | Best-effort within business hours |
| Sev 2 | Significant feature degradation; workaround available | 4 hours, business hours | 24 hours business-day |
| Sev 3 | Single-feature fault, low impact | 24 hours | 72 hours |

Source: [business/SLA.md](../business/SLA.md).

## The first 15 minutes

For any Sev 1:

1. **Acknowledge** the alert in PagerDuty.
2. **Open a war-room channel** in Slack (`#incident-<short-name>`).
3. **Assign roles**:
   - Incident commander (drives the response)
   - Communicator (posts status updates to customers)
   - Investigator (does the technical work)
4. **Confirm scope**: how many users, how many orgs, which features.
5. **Begin a timeline**: every observation, hypothesis, and action gets timestamped.

## Per-class runbooks

### Production-down (frontend or edge functions)

1. Check the latest deploy. If the regression coincides with a deploy: revert.
2. Check Sentry for the error pattern. If a single exception is dominant, isolate the file.
3. Check edge-function logs in Supabase. Look for sudden 5xx spikes.
4. If a specific edge function is the culprit: roll back via `supabase functions deploy <name>` from a known-good commit.
5. Communicate status every 30 minutes until resolved.

### Database integrity

1. Confirm the integrity event by running the audit-chain verifier per [HASH_CHAIN_INVARIANTS.md](../HASH_CHAIN_INVARIANTS.md). The verifier is [src/lib/audit/hashChainVerifier.ts](../../src/lib/audit/hashChainVerifier.ts) and the SQL function is in [supabase/migrations/20260426000001_audit_log_hash_chain.sql](../../supabase/migrations/20260426000001_audit_log_hash_chain.sql).
2. If the chain is broken at a specific row: identify whether this was a restore artifact (expected) or a tamper (not expected).
3. For tamper: page the security lead immediately. Do NOT continue making changes; preserve the chain for forensics.
4. For corruption: see [DR.md](DR.md) for PITR procedure.

### Security event

1. Page the security lead immediately.
2. Rotate any credential that may have been exposed.
3. If a customer data egress is suspected: check [src/lib/audit/sealedExport.ts](../../src/lib/audit/sealedExport.ts) and [supabase/functions/sealed-entity-export/index.ts](../../supabase/functions/sealed-entity-export/index.ts) logs for any export activity in the suspect window.
4. RLS audit: every table's policy is enumerated in `supabase/migrations`; spot-check the most-relevant policies (e.g., [supabase/migrations/00043_complete_rls_enforcement.sql](../../supabase/migrations/00043_complete_rls_enforcement.sql), [supabase/migrations/00050_projects_org_membership_rls.sql](../../supabase/migrations/00050_projects_org_membership_rls.sql)).
5. Notify affected customers per their contractual breach-notification window.

### Customer reports "I see another org's data"

This is a Sev 1 RLS event. Treat as a potential security breach:

1. Capture the exact symptom (screenshot, URL, timestamp, user ID).
2. Confirm the user's project memberships via the `project_members` join.
3. Audit the relevant table's RLS policy. The canonical project-scope policy is in [supabase/migrations/00050_projects_org_membership_rls.sql](../../supabase/migrations/00050_projects_org_membership_rls.sql).
4. If the policy is correct, look at the service-layer code in [src/api/middleware/projectScope.ts](../../src/api/middleware/projectScope.ts) and the relevant service in [src/services](../../src/services).
5. If the user's UI shows data they should not have but the DB does NOT actually return it: it's a UI bug (still serious). Check `<PermissionGate>` usage. Per [HONEST_STATE.md](../../HONEST_STATE.md), PermissionGate is not yet uniformly applied.

### Pay-app submitted with audit gate bypassed

1. Confirm the gate bypass: query `payapp_audit_overrides` for the row corresponding to the pay app.
2. If the override is missing entirely, the edge function at [supabase/functions/payapp-audit/index.ts](../../supabase/functions/payapp-audit/index.ts) was bypassed — this is a data integrity event; treat as Sev 1.
3. If the override is present but the reason text is unprofessional or auto-generated, this is a process issue, not a system fault. Page the compliance officer.

### Iris produced a side effect without an approval

1. Cross-reference the audit log row with the `drafted_actions` table per [supabase/migrations/20260427000010_drafted_actions.sql](../../supabase/migrations/20260427000010_drafted_actions.sql).
2. If a drafted_action row exists with `executed_at` but no preceding `approved_at`: this is a Sev 1.
3. The approval gate is [src/components/iris/IrisApprovalGate.tsx](../../src/components/iris/IrisApprovalGate.tsx). Inspect the call site for a missing approval check.

## Customer communication

Customers care about three things, in order:

1. *Are you aware?* — acknowledge within minutes.
2. *Is my data safe?* — confirm or commit to a timeline.
3. *When will it be fixed?* — give a worst-case estimate; update every 30 minutes.

The status page (or its equivalent) is the canonical surface; Slack DMs to specific customer points-of-contact are appropriate for Enterprise customers.

## Postmortem

Every Sev 1 gets a postmortem within 5 business days. The template is the team's standard postmortem doc; it must include:

- Timeline of events
- Root cause
- Detection time vs response time vs resolution time
- Customer-facing impact (counts of affected users / orgs / projects)
- Action items, each with an owner and a due date

Action items go onto the engineering backlog and are tracked to completion.

## Sev 2 / Sev 3 handling

Same shape as Sev 1, with longer timelines. War room is optional; a Slack thread is sufficient. Postmortem is optional unless the issue is recurring.

## Tabletop exercises

The team runs a tabletop exercise quarterly. The most recent is recorded in the on-call log. Customers' CISOs may request a co-tabletop per [DR_RUNBOOK.md](../DR_RUNBOOK.md).
