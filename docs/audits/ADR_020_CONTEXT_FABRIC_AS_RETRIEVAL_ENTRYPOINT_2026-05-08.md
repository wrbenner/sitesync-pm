# ADR-020 — Context Fabric as Single Retrieval Entrypoint

**Date:** 2026-05-08
**Status:** Accepted (in advance of Phase 1 open)
**Decider:** Walker
**Related:** `IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md`, `IRIS_PHASE_3_KNOWLEDGE_ABSORPTION_SPEC_2026-05-08.md`, `ADR_019_PERSONA_MODEL_2026-05-08.md`

---

## Decision

**All IRIS calls assemble their context through `src/services/iris/contextFabric.ts`.** Caller-supplied `system=` prompts are deprecated. By Phase 1d, an ESLint rule (`no-raw-iris-system`) blocks any new `system:` parameter passed to an `iris(...)` invocation outside the Fabric.

The Context Fabric is the **single entrypoint** for assembling the WHO/WHAT/WHEN/WHERE/WHY context that every IRIS call uses. Specialists, executors, and per-page generators read context from the Fabric output; they do not assemble their own.

---

## Why a single entrypoint

Today's state (pre-Phase-1):

- Each IRIS surface (RFI, submittal, daily log) constructs its own `system=` string inline.
- Persona is hardcoded ("Iris, junior PM assistant").
- WHEN/WHERE/WHY are not assembled at all.
- No central place to add weather, schedule, recent actions, persona-specific tone.

This produces three problems:

1. **Drift.** Five surfaces, five subtly different system prompts. RFI surface eventually gets weather; submittal surface doesn't. Inconsistent IRIS behavior across the product.
2. **Persona impossible.** Persona is a property assembled at the prompt level. With prompts inline at callers, persona requires touching every caller. Not feasible at Phase 1's pace.
3. **Telemetry impossible.** Token budgets, slot counts, cache hit rate — none observable when context is assembled implicitly.

The Fabric collapses all three: one place to add a new context slot (weather, recent actions, KB retrieval), one place to apply persona, one place to instrument.

---

## What the Fabric is

```typescript
// src/services/iris/contextFabric.ts

export interface IrisInvocation {
  user_id: string;
  project_id: string;
  entity?: { type: EntityType; id: string };
  page?: PageId;
  intent?: string;
  workflow?: WorkflowId;
}

export interface IrisContext {
  who: WhoSlot;     // user, persona, role, name, recent_actions, permissions
  what: WhatSlot;   // entity_type, entity_id, entity_state, related_entities, current_page
  when: WhenSlot;   // project_phase, days_to_substantial_completion, schedule_status, last_session_at
  where: WhereSlot; // project_id, area_id, gps_hint, weather_now, weather_5d_forecast
  why: WhySlot;     // invocation_intent, page_intent, recent_query_history, pinned_context

  // Meta
  fabric_version: string;
  total_tokens: number;
  slot_token_counts: Record<SlotName, number>;
  cache_hit: boolean;
  build_latency_ms: number;
}

export async function buildContext(inv: IrisInvocation): Promise<IrisContext> { /* … */ }
```

Token budget: 2,950 tokens distributed across slots (per Phase 1 spec). Trim oldest when over.

Caching: per-invocation context cached for 30s; per-slot caches keyed (`weather`: 5min; `recent_actions`: 60s).

Latency budget: P95 ≤ 150ms. Fabric is on the hot path of every IRIS call — must be cheap.

Phase 1 ships fully deterministic fields. No LLM-derived fields in the Fabric until Phase 2 (router can suggest "what" and "why" slot enrichments via a Haiku-class call).

---

## Why deprecate caller-supplied system=

| Option | What happens | Pros | Cons |
|---|---|---|---|
| Allow both | Callers can pass `system=` OR use Fabric | Flexible | Drift across surfaces returns. The Fabric becomes optional infra. The persona thesis collapses. |
| **Deprecate via lint** ✅ | Phase 1d ships an ESLint rule blocking new `system=` outside Fabric. Existing callers migrated to Fabric in Phase 1b/c. | Single source of truth. Persona enforced. Telemetry universal. | One-time migration cost (~20 surfaces). |
| Hard remove the parameter | Breaking API change to the `iris()` wrapper | Cleanest | Disruptive; requires migration before Phase 1 acceptance. |

The lint approach lets existing callers migrate at their own pace through Phase 1c, with a hard cutover at Phase 1d (acceptance gate is "≥80% of IRIS calls go through Fabric").

---

## What goes through the Fabric, what doesn't

**Through the Fabric:**
- All IRIS specialist invocations (Drafter, Money, Schedule, Code, Field, Historian)
- All per-page insight generators (Phase 4)
- All scheduled-insights worker prompts
- All voice flow prompts (Field agent, Phase 5)

**NOT through the Fabric:**
- Embedding calls (no system prompt; just text)
- Whisper transcription (audio in, text out)
- Vision LLM caption (image in, caption out — uses dedicated caption prompt, not IRIS surface)
- Internal agent-to-agent calls within a specialist (specialist's internal prompts are its own concern, governed by ADR-018)

---

## Failure modes

- **Fabric build fails (DB outage, missing slot data).** Fabric returns degraded context with `cache_hit=false, build_latency_ms=999`, sets a `degraded_slots[]` field for observability, and IRIS still runs (with a banner if degraded). Better partial context than no IRIS.
- **Caller still passes `system=` after lint cutover.** Lint blocks at PR time. Runtime guard in `iris()` wrapper logs warning + emits `iris_invocations.system_override_attempted=true` for the audit chain.
- **Token overflow.** Fabric trims slots in priority order: pinned_context > who > what > when > where > why > recent_actions. Trim recorded in `slot_trim_events`.

---

## Test plan

- Unit: each slot builder isolated, with fixture inputs.
- Integration: full Fabric build on real fixture project; assert no missing slots, no token overflow, latency <150ms P95.
- 50 RLS test cases: each persona sees only their permitted slot content.
- Regression: 50 goldens for the 5 RFI/submittal/daily-log surfaces; before/after Fabric output equivalence (where input is unchanged).
- Lint test: synthetic violation that `no-raw-iris-system` rule catches.

---

## Telemetry

`iris_invocations`:
- `fabric_version` — semver bump on contract change
- `slot_token_counts` (jsonb) — per-slot tokens
- `total_tokens`
- `cache_hit` — boolean
- `degraded_slots[]` — slots that failed to build
- `system_override_attempted` — boolean (catches lint bypasses)
- `build_latency_ms`

Dashboards: per-call Fabric latency P50/P95, per-slot trim rate, cache hit rate, degraded-slot rate.

---

## Consequences

**Positive:** persona model becomes implementable. Telemetry universal across IRIS surfaces. New context slots (weather, KB retrieval at Phase 3, area_id at Phase 5) added in one place. Audit chain has a single context provenance trail. Engineer #2 can ship a new specialist without re-deriving context assembly.

**Negative:** one-time migration cost (~20 surfaces over Phase 1b/c). Fabric latency budget is tight (150ms P95) — requires cheap slot builders + aggressive caching. Caller-side debugging slightly less direct (must inspect Fabric output instead of inline prompt).

**Reversibility:** low. Once Fabric is the entrypoint, callers depend on it. Reversing means re-decentralizing prompts — strictly worse, would never happen.

---

## Status timeline

- **2026-05-08** — Accepted, pre-Phase-1 open.
- **Phase 1a (~Jul 2026)** — Fabric scaffold, opt-in via flag.
- **Phase 1b–c (~Aug 2026)** — RFI/submittal/daily-log surfaces converted.
- **Phase 1d (~Sep 2026)** — `no-raw-iris-system` lint enforced; deprecation complete.
- **Phase 3 (~Oct 2026)** — KB retrieval becomes a Fabric slot.
- **Phase 5 (~Jan 2027)** — area_id + spatial slots added.
- **Quarterly review** for slot bloat / token budget tuning.
