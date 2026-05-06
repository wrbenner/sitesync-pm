# ADR-006 — Pilot Data Isolation: Row-Level Multi-Tenancy

**Status:** Accepted
**Date:** 2026-05-04
**Companion to:** `SOFT_PILOT_PLAYBOOK_2026-05-04.md`
**Implementation:**
- `supabase/migrations/20260504020003_organizations_soft_pilot_flag.sql` — `is_soft_pilot` column
- `supabase/migrations/20260504050000_pilot_agreements.sql` — agreement table + `is_pilot_user()` helper
- `scripts/provision-pilot-org.ts` — Day 49 prep automation

## Context

The Lap 2 soft pilot puts real GC data in a multi-tenant SaaS for the first time. We have to isolate pilot data — the question is *how*. Three structural choices, and the choice cascades through every later spec.

## Options considered

| Option | Pros | Cons |
|---|---|---|
| **Separate Supabase project** | Hard wall. Pilot data physically isolated. Zero accidental cross-tenant exposure. | We maintain two of everything: migrations, edge fns, monitoring, Stripe, deploy. Drift is inevitable. The pilot becomes its own product line. |
| **Schema-per-tenant** in same DB | Cleaner than mixed tables; migrations apply once, run per schema. | Postgres `search_path` machinery is fragile under concurrent connections. Triggers don't compose cleanly across schemas. RLS is harder when policies need to reference a schema variable. |
| **Row-level + `is_soft_pilot` flag** (chosen) | One codebase. One migration set. One observability stack. RLS is already in place. Telemetry naturally aggregates without ETL. The pilot org is just an org with a flag. | Requires discipline that nothing leaks across orgs by default — which is exactly what RLS already enforces. |

## Decision

**Row-level multi-tenancy in the existing production Supabase project, with an `is_soft_pilot` boolean on `organizations` and a `pilot_agreements` row carrying the named pilot users.**

### Schema impact

- `organizations.is_soft_pilot boolean NOT NULL DEFAULT FALSE` (shipped Day 31).
- `organizations.soft_pilot_started_at`, `organizations.soft_pilot_agreement_signed_at` (shipped Day 31).
- `pilot_agreements` table (shipped today): per-pilot agreement record with `pilot_user_ids uuid[]`.
- `is_pilot_user(uuid)` SECURITY DEFINER helper: TRUE iff the user is in any active pilot agreement.

### What the flag changes operationally

| Surface | Behavior when `is_soft_pilot = TRUE` |
|---|---|
| `enqueue_insights_jobs` (heartbeat) | Fans out to this org. Other orgs are not enqueued in Lap 2. |
| `lap_2_gate_metrics_daily` | Filters to this org via the placeholder slug today, real org id post-recruit. |
| Iris voice diff logging | Always on (vs. configurable elsewhere). |
| Audit chain verification | Hourly instead of daily (per playbook § Phase 5 detection of chain breaks). |
| Telemetry retention | 24 months (vs. 12-month default). See ADR-008. |
| Pilot user check | `is_pilot_user(decided_by)` — gate counts only flip-decisions made by named pilot users, not Walker's debugging clicks. |
| Support tier | Implicit P0 — Walker is on the slab Day 1 + 24/7 during pilot window. |

### Why this works under the Bugatti standard

RLS already enforces project-membership scoping on every meaningful table. The pilot doesn't introduce a new attack surface — it introduces a new *workload* on the same surface. The flag is the discriminator, the existing RLS is the wall. Every spec that touches pilot data in this ADR's wake (telemetry, gate, scheduled-insights, citations, voice) inherits the discipline by default.

The alternative — separate project — would have meant the very thing the Bugatti standard rejects: maintaining two of everything for an unstated future need.

## Consequences

**Positive.**
- One observability surface. Walker watches one logs page.
- Adding pilot #2 = inserting a row, not deploying a project.
- Migrations apply atomically across all orgs; no drift between pilot and non-pilot.
- Telemetry aggregations work without union-of-projects ETL.

**Negative / accepted tradeoffs.**
- A bug in RLS policy on a non-pilot org could in principle leak to a pilot user — same bug we'd have without the pilot. The mitigation is the same: PermissionGate audits, Lap 1 RLS hardening, the existing CI workflow. We accept the risk because it's the *same* risk we already accept; the pilot doesn't add to it.
- The pilot data physically lives in the same row store as everything else. If a pilot org's CISO requires physical isolation as a hard requirement, we can't honor it without going to option 1 (separate project) — and that's a Lap 3+ conversation, not a Lap 2 blocker. We document this honestly in the pilot agreement.

## Data-handling commitments encoded by this ADR

For any org with `is_soft_pilot = TRUE`:

- **Telemetry retained 24 months** (vs. 12 default), per ADR-008's pilot extension clause.
- **Right to data export** at any time, delivered as CSV via Walker. Implementation: `scripts/export-pilot-data.ts` (referenced by the playbook; not yet shipped — Day 60 work).
- **Right to erasure**: removes `decided_by` references and anonymizes inbox sessions; preserves chain integrity. The ADR-008 routine.
- **No cross-tenant data exposure**: standard RLS, asserted explicitly in the pilot agreement (template-v1 § "What stays inside").
- **No quote without consent**: the pilot agreement bars any case-study quote without explicit written approval per quote.

## What this ADR explicitly does NOT decide

- The text of the pilot agreement (covered by `pilot-agreement-template-v1.md`).
- The day-of onboarding script (covered by playbook § Phase 3).
- The exit-criteria for ending the pilot early (covered by playbook § Phase 5).
- Multi-pilot orchestration (Lap 3 problem when GC #2, #3, #4 run simultaneously).
- Pilot → paid contract handoff (Lap 3 days 82–87 in the tracker).

## References

- `docs/audits/SOFT_PILOT_PLAYBOOK_2026-05-04.md` — operational playbook
- `docs/audits/pilot-agreement-template-v1.md` — agreement template-v1
- `docs/audits/ADR_008_TELEMETRY_RETENTION_2026-05-04.md` — the 24-month retention extension this ADR references
- `docs/audits/ADR_007_AUTO_WITHDRAW_POLICY_2026-05-04.md` — auto-withdraw rules during the pilot window
- `supabase/migrations/20260504020003_organizations_soft_pilot_flag.sql` — flag column
- `supabase/migrations/20260504050000_pilot_agreements.sql` — agreement table + helper
