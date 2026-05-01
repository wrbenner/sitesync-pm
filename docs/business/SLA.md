# Service Level Agreement (SLA)

> The targets in this document are **commitments-in-design**, not contractual unless your organization has signed an executed enterprise agreement. The Pro tier offers best-effort service; the Enterprise tier carries the contractual SLA below.

## Availability targets

| Tier | Monthly availability target |
| --- | --- |
| Pro | 99.9% (best-effort) |
| Enterprise | 99.95% (contractual when signed) |

99.95% allows ~22 minutes of unavailability per month; 99.9% allows ~43 minutes.

## Recovery targets

Per the disaster-recovery runbook at [docs/DR_RUNBOOK.md](../DR_RUNBOOK.md):

| Metric | Pro tier | Enterprise tier |
| --- | --- | --- |
| RTO (recovery time objective) | 4 hours full-region restore | 1 hour for full-region failover (with the extended-residency add-on) |
| RPO (recovery point objective) | 24 hours for full-region disaster; 5 minutes within the PITR window | 1 hour for full-region disaster; 5 minutes within the PITR window |
| PITR window | 7 days (Pro) | 28 days (Team tier); extensible to 90 days as a paid add-on |

Source of truth for these targets: [docs/DR_RUNBOOK.md](../DR_RUNBOOK.md), grounded in Supabase platform commitments.

## Support response targets

| Severity | Pro | Enterprise |
| --- | --- | --- |
| Sev 1 (production down, multiple users blocked) | Best-effort within business hours | 1 hour, 24/7/365 |
| Sev 2 (significant degradation, workaround available) | 24 hours business-day response | 4 hours, business hours |
| Sev 3 (single-feature fault, low impact) | 72 hours | 24 hours |

Severity classification rules are in [docs/operations/INCIDENT_RESPONSE.md](../operations/INCIDENT_RESPONSE.md).

## What's measured against the SLA

- The deployed web app and mobile app
- The Supabase Postgres + Storage primary
- The deployed edge functions listed in [supabase/functions](../../supabase/functions) — see [supabase/functions/EDGE_FUNCTIONS_GUIDE.md](../../supabase/functions/EDGE_FUNCTIONS_GUIDE.md) and [supabase/functions/QUICK_REFERENCE.md](../../supabase/functions/QUICK_REFERENCE.md) for the inventory

## What's excluded

- Third-party identity providers (your IdP for SSO is your responsibility)
- Customer-side networks
- Issues caused by customer-side misconfiguration (e.g., a custom role that revokes core permissions for the requesting user)
- Scheduled maintenance windows announced 7 days in advance
- Force-majeure events (cloud-provider region outages where the customer has not paid for cross-region failover)

## Status communication

In the event of degraded service or an incident, ops follows the runbook in [operations/INCIDENT_RESPONSE.md](../operations/INCIDENT_RESPONSE.md). The on-call rotation is documented in [operations/ONCALL.md](../operations/ONCALL.md).

## Credits

For Enterprise customers, a missed availability target results in a service credit per the executed master service agreement. There is no automatic credit pipeline; credits are computed on request.

## Audit log accessibility

The hash-chained audit log per [docs/HASH_CHAIN_INVARIANTS.md](../HASH_CHAIN_INVARIANTS.md) is available 24/7 to organization admins through the audit posture page at [src/pages/admin/audit-posture/index.tsx](../../src/pages/admin/audit-posture/index.tsx). Log query latency is not under SLA, but typical response is under 30 seconds for a one-month window.

## Data export

Customer S3 export ([supabase/functions/customer-s3-export/index.ts](../../supabase/functions/customer-s3-export/index.ts)) writes to a customer-controlled bucket. Export latency is not under SLA but is typically completed within 4 hours for a single project's-worth of data.

## Status of formal SLA contracts

Per the constraint that this product has not yet certified a SOC 2 audit (see [compliance/SOC2_EVIDENCE_PACK.md](../compliance/SOC2_EVIDENCE_PACK.md)), Enterprise SLA targets are committed in the executed contract. Until you have an executed contract, treat the targets above as design intent — not as enforceable promises.
