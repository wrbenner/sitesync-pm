# ADR-008 — Telemetry Retention & Privacy for `drafted_actions`

**Status:** Accepted
**Date:** 2026-05-04
**Companion to:** `IRIS_TELEMETRY_SPEC_2026-05-04.md` (Phase 5), `SOFT_PILOT_PLAYBOOK_2026-05-04.md`
**Supersedes:** None

## Context

Migration `20260504010000_drafted_actions_telemetry.sql` adds 5 telemetry columns to `drafted_actions`. Three of them (`first_viewed_at`, `inbox_session_id`, `decision_method`) are user-identifying when joined with `decided_by` — they describe a specific person's review behavior on a specific day. Two (`viewed_count`, `required_edits`) are anonymizable but join to the same row.

The Lap 2 acceptance gate (Day 60) reads aggregated metrics from these columns; the soft pilot (Days 50–60) is the first time real-customer review behavior is captured. Without an explicit retention policy, the data either accretes forever (privacy risk, regulatory exposure) or evaporates (the audit chain breaks, the gate becomes unverifiable post-hoc).

The Bugatti standard says: decide once, in writing, before the first row lands.

## Decision

1. **Retention floor — 12 months from `decided_at`.** All telemetry columns plus `decided_by` are retained verbatim for 12 months after the decision. Within this window, we can reproduce gate metrics, debug any rejected-by-mistake claims, and answer pilot-phase product questions.
2. **Soft-pilot extension — 24 months for `is_soft_pilot = true` projects.** The pilot data is a once-in-a-product-lifetime corpus. Two years of retention covers a full year of post-pilot product evolution + a follow-up case study.
3. **Anonymization at expiry.** A nightly job (added in `SCHEDULED_INSIGHTS_SPEC` infrastructure) walks `drafted_actions` where `decided_at < now() - retention_window` and:
   - Sets `decided_by = NULL`
   - Sets `inbox_session_id = NULL`
   - Sets `decision_method = 'unknown'`
   - **Preserves** `first_viewed_at`, `viewed_count`, `required_edits`, `time_to_first_view_ms`, `time_to_decide_ms`, `decided_at`, `status`, `confidence`, `action_type` — these are anonymous on their own and load-bearing for longitudinal product analysis.
4. **GDPR-style erasure (right-to-be-forgotten).** A pilot user can request erasure at any time. On request, all of their telemetry rows are anonymized using the same routine as expiry. The decision facts (approve/reject, timestamps, citations) stay so the audit chain remains verifiable; the *who* goes.
5. **No telemetry leaves the production database without aggregation.** Dashboards, the case-study export, and any analytics replication consume `lap_2_gate_metrics_daily` or future aggregated views — never raw row exports. The pilot agreement reflects this.
6. **No cross-tenant joins.** RLS already enforces project-scoped reads on `drafted_actions`. The telemetry columns inherit. No "which tenants are converting fastest" cross-customer queries — those aggregate inside the org.

## Consequences

**Positive.**
- Pilot agreement copy is concrete: "12 months by default, 24 months for the pilot, anonymized after."
- Right-to-erasure is a single SQL routine, not a one-off scramble.
- Audit chain stays verifiable indefinitely (the *fact* of the decision survives anonymization).
- Aggregated metrics (`lap_2_gate_metrics_daily`) are safe to ship in case studies — they were always anonymous.

**Negative / accepted tradeoffs.**
- Per-user cohort analysis is bounded to the retention window. Acceptable: the product question "does power user X get faster over six months" lives inside that window anyway.
- The expiry job is one more cron — added scope for `SCHEDULED_INSIGHTS_SPEC`. Acceptable: low-frequency, idempotent, easy to monitor.
- Anonymization is irreversible. Acceptable: the alternative is unbounded PII retention.

## Pilot agreement — required language

The soft-pilot pilot agreement (delivered Day 50, see `SOFT_PILOT_PLAYBOOK_2026-05-04.md`) must include the following clause verbatim or in equivalent meaning:

> SiteSync collects timestamps, decision metadata, and inbox-session identifiers for each Iris draft you review. We use this to measure product fit, debug regressions, and improve the system. We retain this data for 24 months from the decision date for pilot accounts; after that, your identity is removed and the underlying decision facts are kept anonymous. Aggregated metrics may appear in case studies and product communications; individual interactions never will. You may request erasure of your personal identifiers at any time by contacting your SiteSync representative; we will honor the request within 7 business days.

## Implementation notes

- The migration in this PR adds the columns and the RPC write path. It does *not* yet add the anonymization cron — that lands with `SCHEDULED_INSIGHTS_SPEC` infrastructure (Days 31–35).
- Until the anonymization cron ships, retention is enforced manually if requested. A scheduled audit (calendar reminder for Walker, Day 31) verifies the cron lands before any pilot row reaches its 12-month mark — which it cannot, because the earliest pilot row is < 60 days old by Lap 2 close.
- The existing audit-log hash chain is unaffected. Anonymization writes a new audit entry recording the operation; the chain extends, never breaks.

## References

- `IRIS_TELEMETRY_SPEC_2026-05-04.md` § Phase 5 — original retention sketch
- `SOFT_PILOT_PLAYBOOK_2026-05-04.md` — pilot agreement workflow
- `supabase/migrations/20260426000001_audit_log_hash_chain.sql` — the audit chain anonymization extends rather than rewrites
- `supabase/migrations/20260504010000_drafted_actions_telemetry.sql` — implementation
