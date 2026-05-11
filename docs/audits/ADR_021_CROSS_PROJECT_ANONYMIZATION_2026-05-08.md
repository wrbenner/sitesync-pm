# ADR-021 — Cross-Project Memory Anonymization Protocol

**Date:** 2026-05-08
**Status:** Accepted (in advance of Phase 6 open)
**Decider:** Walker
**Related:** `IRIS_PHASE_6_FIRM_MEMORY_SPEC_2026-05-08.md`, `ADR_006_PILOT_DATA_ISOLATION_2026-05-04.md`, `ADR_008_TELEMETRY_RETENTION_2026-05-04.md`, `IRIS_NATIVENESS_PLAN_2026-05-08.md` §4.6

---

## Decision

Cross-project memory operates at **two distinct boundaries**, with strict rules at each:

1. **Within-tenant (firm-level) cross-project memory** — Phase 6 ships this. Patterns extracted from one tenant's closed projects feed the IrisHistorian sub-agent for that tenant's other projects. Project IDs are displayed as anonymized labels (Project A, Project B) for cognitive distance, but identifiable to the tenant on click.

2. **Cross-tenant aggregate insights** — explicitly **deferred to Phase 7+**. No cross-tenant data crosses the tenant boundary in Phase 6. Phase 7 may introduce aggregates under strict anonymization protocol, **two-engineer review**, and **legal sign-off** per query type.

The protocol below governs both boundaries. The Phase 6 spec ships boundary #1 only; boundary #2 is reserved.

---

## Within-tenant protocol (Phase 6)

### What may flow

The following data may flow from a closed project to the tenant-level `firm_memory_patterns` / `firm_memory_lessons` / `firm_memory_aggregates` tables:

| Source | Allowed in firm_memory | Notes |
|---|---|---|
| RFI categories + counts + median time-to-answer | ✅ | Aggregated; individual question text not required |
| Change order categories + cost ranges | ✅ | Cents preserved; individual CO line items not required |
| Schedule slip patterns (e.g., "MEP coordination spikes 30 days before SC") | ✅ | Aggregated milestone deltas |
| Submittal rejection rates by sub | ✅ | Sub identity preserved within tenant; cross-tenant blocked |
| Daily log statistics (counts, gaps, weather impact) | ✅ | Aggregated stats; individual narrative not required |
| Photo time-to-rough-in deltas | ✅ | Statistical signal only |
| User-authored lessons-learned | ✅ | Verbatim within tenant; never crosses tenant boundary |

### What MUST NOT flow

- **Subcontractor names from other tenants.** Sub identities are first-party PII to the tenant.
- **Owner identities** unless owner is the same entity in both projects.
- **Financial dollar values** that aren't already aggregated (no per-CO cents leaving project context).
- **Personal communications** (emails, chat, phone notes).
- **Photos with people in them** (face features) — Phase 5 ingestion respects existing ADR-006 RLS.
- **Anything tagged `sensitivity ≥ owner_only`** unless explicitly opted in by the project's PM.

### Display rules

- IrisHistorian alerts cite source projects as "Project A", "Project B". Click expands to project name (the user is in the same tenant; they have access).
- Aggregate stats display with sample size: "Median across 4 projects: 18 RFIs." Sample sizes < 3 are suppressed (statistical noise).
- "We've seen this before" framed as historical signal, not prediction. Voice linter enforces this (per ADR-005).

---

## Cross-tenant protocol (reserved for Phase 7+)

### Sequencing

Phase 6 (~Mar 2027) ships within-tenant only. Cross-tenant aggregates are **explicitly out of scope** until Phase 7 (~May 2027 or later).

The deliberate sequencing reason: Phase 6 must ship after audit-chain certification (T-195, Oct 15 2026) to lead with the moat. Cross-tenant adds a privacy surface that requires mature compliance posture — wait for SOC 2 Type II + audit-chain cert + legal review before introducing.

### What might be allowed at Phase 7 (subject to ADR-021-A, to be authored)

- **k-anonymous statistical aggregates only.** "Across 50 GCs, median time-to-answer for MEP RFIs is 5 days." k≥10 enforced.
- **Industry benchmarks** rendered as comparison: "Your firm at 3 days, industry median 5 days."
- **Pattern detection across firms** (e.g., "12 firms saw curtain-wall submittal rejections spike when X") — only with k≥10.

### What is NEVER allowed (immutable)

- Sub identities crossing tenant boundary.
- Owner identities crossing tenant boundary (unless explicit owner-side opt-in).
- Project-specific dollar values, schedules, or names.
- User-authored lessons-learned (these stay tenant-local forever).
- Any record where the source tenant could be inferred via combination of fields.

### Two-engineer review

Every new cross-tenant aggregate query type at Phase 7+ must:

1. Be defined as a typed query in `src/services/iris/historian/cross_tenant_queries.ts`.
2. Be reviewed by **two SiteSync engineers** for re-identification risk.
3. Be reviewed by **outside counsel** for the first three query types; subsequent queries fall under a documented review process counsel pre-approves.
4. Include a `re_identification_test` — a synthetic adversary attempts to identify a specific tenant from query output across ≥10 sample queries; failure rate must be 100%.
5. Be flagged in `iris_actions.cross_tenant_query=true` for audit chain.

### Customer opt-in

Cross-tenant aggregates require explicit org-level opt-in. Default is OFF for all customers. Opt-in unlocks both directions: their data feeds aggregates, and they receive aggregate insights.

---

## Mechanics (Phase 6 within-tenant)

### Pattern extraction

`project_closeout_extractor` (per Phase 6 spec) is the only writer to `firm_memory_*` tables. Idempotent via `payload_hash`. Two-engineer review on the extractor itself, not per-project.

### Anonymization at display

```typescript
// src/services/iris/historian/anonymize.ts

function displayProjectId(projectId: string, tenantId: string, viewerId: string): string {
  // Within tenant: stable label like "Project A" derived from sequence within tenant
  // Cross-tenant (Phase 7+, opt-in): hash with tenant salt, never reveal
  if (sameTenantAs(projectId, tenantId)) return projectAlias(projectId, tenantId);
  return null; // Phase 6: never expose cross-tenant project identity
}
```

### Nightly cross-project leak inspector

Job runs nightly (`scripts/audit-cross-project-leakage.mjs`):

- Sample 100 IrisHistorian outputs from the prior 24h.
- Verify no string match between output and any out-of-tenant project name, sub name, owner name, or lessons-learned text.
- Failure → block deploys + Slack alert + Walker review required to clear.
- 30 consecutive clean days = Phase 6 acceptance gate criterion.

---

## Telemetry

- `firm_memory_patterns`: count, last_observed_at, observation_count, confidence_score.
- `iris_historian_alerts`: fired_at, dismissed_at, useful_rated_at (post-hoc user rating).
- `cross_project_leak_inspector`: run_at, samples_checked, leak_detected (boolean), failed_outputs[].

Retention: per ADR-008, firm_memory retained for tenant lifetime; lessons-learned 5-year default with explicit retire date; inspector logs 24-month retention.

---

## Test plan

- 50-case anonymization suite: synthetic projects with known names; verify display always shows aliases.
- Re-identification test: 30 synthetic adversary queries against firm_memory; ≥99% failure to identify specific source project from output (within-tenant cognitive-distance test).
- Inspector regression: synthetic leak event injected; assert inspector catches it and blocks deploy.
- Cross-tenant boundary test: 30 cases attempting to query across tenants via IrisHistorian; assert all blocked at the protocol layer.

---

## Failure modes

- **Pattern extractor produces a pattern that re-identifies a project externally.** Inspector catches; pattern quarantined; root-caused.
- **User clicks "Project A" and sees a project they don't have access to.** RLS layer catches first; inspector + alert if RLS missed.
- **Anonymization mistake at display.** Voice linter catches "Project Foo" leaking; deploy blocked.
- **Cross-tenant query sneaks in pre-Phase-7.** ADR-018 specialist boundary lint blocks; CI lint asserts no `cross_tenant_*` calls in Phase 6 build.

---

## Consequences

**Positive:** moat preserved (firm-level memory works). Privacy posture defensible to enterprise customers + counsel. Audit-chain integrity maintained. Two-step boundary (within → cross-tenant) avoids privacy mistakes that kill adoption (see Glean's enterprise lessons).

**Negative:** adds CI surface + nightly inspector. Cross-tenant value deferred 2+ quarters. Engineering velocity on Phase 7 cross-tenant work bottlenecked on legal review pace — accepted; this is right.

**Reversibility:** within-tenant — non-reversible (would lose moat). Cross-tenant — fully reversible (don't ship until ADR-021-A is real).

---

## Status timeline

- **2026-05-08** — Accepted, pre-Phase-6 open.
- **Phase 6 open (~Mar 2027)** — Within-tenant protocol implemented.
- **Phase 6 close (~Apr 2027)** — Inspector clean for 30 consecutive days; acceptance gate met.
- **Phase 7 (~May 2027+)** — ADR-021-A authored for cross-tenant protocol; opt-in shipped.
- **Annual review** with outside counsel.
