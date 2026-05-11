# Phase 1b — RFI + submittal + daily-log Fabric cutover (opt-in)

**Date:** 2026-05-11
**Branch / PR:** `phase-1b-fabric-cutover`
**Spec:** [`IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md`](IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md) §5.2
**Builds on:** PR #418 (Phase 1a Context Fabric scaffold)

## TL;DR

Wires the Context Fabric (Phase 1a) through the `iris-call` edge function and the `generateIrisDraft` entry point so the 3 highest-volume Iris surfaces (RFI follow-up, submittal review, daily log) can route through `buildContext()` instead of the legacy caller-supplied `system=` prompt. **Off by default** — `irisUseFabric` flag stays off; existing call sites behave identically until callers opt in by passing the `fabric` option. Telemetry (`audit_log.metadata.{use_fabric,fabric_version,fabric_persona}`) lets us measure `fabric_used_pct` for the Phase 1 exit gate.

28 new parity tests pass; existing 135 iris tests + 5 callIris tests still green.

## What changed

### Edge function

- `supabase/functions/iris-call/index.ts` —
  - `CallRequest` extended with `use_fabric?: boolean`, `fabric_version?: string`, `fabric_persona?: string`.
  - `writeAuditEntry` accepts and logs all three to `audit_log.metadata` so `fabric_used_pct` is queryable.

### Browser client

- `src/lib/ai/callIris.ts` —
  - `IrisCallRequest` extended with the same 3 optional fields (`useFabric`, `fabricVersion`, `fabricPersona`).
  - The request body forwards them when present; absent = legacy path.

### Fabric bridge

- `src/services/iris/legacyAdapters.ts` (new) —
  - `adaptStreamItemToFabric(item, projectContext, draftType, opts)` maps the legacy `(StreamItem, ProjectContextSnapshot, draftType)` triple into an `IrisInvocation` + slot overrides, then runs `buildContext()` + `renderContext()` and returns the persona, system prompt, and budget estimate.
  - Phase 1b slot fidelity: who/what/where/why are populated from existing client-side data; when stays null until Phase 1 Day 6. The renderer drops null slots — no "null" string leakage.
  - `DRAFT_TYPE_TO_INTENT` maps each of the 6 legacy draft types to a Fabric `InvocationIntent` (for Phase 2 router routing keys).
  - StreamItem `id` prefix → Fabric `EntityType` enum inference.

### Cutover entry point

- `src/services/iris/drafts.ts` —
  - `GenerateDraftOptions.fabric` (new) — opt-in Fabric inputs (`userId`, `userRole`, `orgId`, optional `workflowOverride` + `personaOverride`).
  - When `FLAGS.irisUseFabric && options.fabric` is truthy, the draft path calls `adaptStreamItemToFabric()` and passes the resulting system prompt + telemetry fields to `callIris()`. Otherwise the legacy path runs unchanged.
  - Backward-compatible: existing callers that don't pass `options.fabric` get zero behavior change.

### Tests

- `src/services/iris/__tests__/legacyAdapters.test.ts` (new, 28 tests):
  - **Cutover surfaces** (RFI follow-up, submittal review, daily log) each produce a non-empty Fabric system prompt.
  - **ADR-019 hierarchy** — workflow override > caller override > role default.
  - **draftType → intent mapping** — all 6 legacy types map correctly.
  - **Slot block presence** — WHO/WHAT/WHERE/WHY emit when caller data is available; WHEN omitted (null until Day 6); WHERE omitted when projectId is null.
  - **Weather propagation** — `ProjectContextSnapshot.weather` flows into WHERE slot.
  - **Invariants across all 6 draft types** — no `null` string leaks, token budget respected, deterministic (same input → same output).

## Verification commands

```bash
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit -p tsconfig.app.json
# → exit 0

NODE_OPTIONS="--max-old-space-size=8192" npx vitest run src/services/iris/ src/test/lib/callIris.test.ts
# → 140 tests pass (135 iris + 5 callIris)
```

## Production cutover (calendar-bound — separate from this PR)

Per spec §5.2, the actual feature-flag flip is a 4-step rollout:

1. **Soft-pilot org first** — set `VITE_FLAG_IRIS_USE_FABRIC=true` on the Brad/Nexus org's deploy.
2. **Watch acceptance rate** for 7 days. Goal: `acceptance_rate_pct` does NOT drop more than 3 pp vs the 7-day-prior baseline.
3. **Watch `fabric_used_pct`** — should converge to ≥ 80% on the 3 surfaces (RFI follow-up, submittal review, daily log).
4. **Flip to all orgs** if both metrics stay clean.

The flip is Walker-driven; this PR ships only the code path so the flip is a flag change, not a redeploy.

## What this does NOT do (still deferred)

- **DB-bound slot resolvers** — who.recent_actions, what.related_entities, when.* fields all still null in Phase 1b. Days 2–8 wire each slot.
- **Caller-supplied `system=` deprecation lint rule** — Phase 1c (Days 15–22 per spec).
- **Per-persona dashboards** — Phase 1d.
- **`iris_invocations` dedicated table** — spec §8.1 puts this at Day 11; for Phase 1b telemetry, we piggyback on `audit_log.metadata` (added today).
- **`tiktoken` precision** — still using 4-char estimator from Phase 1a.

## Phase 1b acceptance check (spec §5.2)

✅ Edge function accepts `use_fabric` flag and logs it to audit metadata.
✅ The 3 cutover surface entry points (RFI follow-up / submittal review / daily log) flow through `adaptStreamItemToFabric()` when both the flag and the `fabric` option are present.
✅ Parity goldens: 28 tests cover the cutover paths + invariants across all 6 draft types.
✅ Production behavior unchanged when flag is off OR `fabric` option is absent.
⏳ `fabric_used_pct ≥ 80%` — calendar-bound; ships post-flag-flip on soft-pilot org.
⏳ Acceptance rate no-regression — calendar-bound.

## Next up

**PR 1c — ESLint `no-raw-iris-system` rule.** Adds the lint rule that blocks any new code from passing a raw `system=` to `callIris()` outside the legacy adapter allow-list. Forces the long-tail migration to complete before Phase 1d's persona-dashboard work lands.
