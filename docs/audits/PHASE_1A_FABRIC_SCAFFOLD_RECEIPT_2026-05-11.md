# Phase 1a — Context Fabric scaffold receipt

**Date:** 2026-05-11
**Branch / PR:** `phase-1a-fabric-scaffold`
**Spec:** [`IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md`](IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md) §§3, 4, 5.1, 9
**ADRs ratified inline:** ADR-019 (persona model), ADR-020 (Context Fabric as single retrieval entrypoint)

## TL;DR

Lands the Phase 1 Day 1 scaffold per spec: 5-persona registry seeded in the DB, `IrisContext` typed shape, deterministic `renderContext()` renderer, and a feature flag (`iris_use_fabric`) that defaults **off** so production traffic continues through the legacy `system=` path until Phase 1b cuts over RFI / submittal / daily-log surfaces. Zero behavior change in production.

48 new tests green; typecheck zero; lint zero.

## What changed

### Migrations (2)

- `supabase/migrations/20260702010000_iris_personas.sql` — `iris_personas` table + 5 seeded system-default personas (pm, superintendent, foreman, owner_rep, office), each with `base_prompt_fragment` + `tool_allow_list` + `auto_action_threshold` + `default_tone` per spec §3.2.
- `supabase/migrations/20260702010001_iris_user_personas.sql` — per-user persona binding table for Phase 1d resolver hierarchy (workflow > project > org > system).

Both migrations RLS-enabled. Reads: any authenticated user can see system defaults + their own org's rows. Writes: org admins/owners only.

**Rollback:** drop in reverse order (`iris_user_personas` then `iris_personas`); FKs handle the cascade.

### TypeScript surface

- `src/services/iris/types/context.ts` — `IrisContext` shape (5 slots + meta) with discriminated unions for every enum. Token ceilings (`SLOT_TOKEN_CEILINGS`) and total budget (`TOTAL_FABRIC_TOKEN_BUDGET = 2950`) exported as constants.
- `src/services/iris/types/invocation.ts` — `IrisInvocation` input shape.
- `src/services/iris/personas.ts` — static `PERSONAS` registry mirroring the DB seed for in-process renderer access. `ROLE_TO_DEFAULT_PERSONA` + `personaForRole()` for the spec §5.4 fallback.
- `src/services/iris/contextFabric.ts` — `buildContext(invocation, overrides?)` returning `{ context, resolved_persona }`. Phase 1a returns null slots when no overrides are supplied (per spec Day 1 "empty slot builders return null"); tests use `overrides` to inject fixture data. `resolvePersonaForInvocation()` implements the ADR-019 hierarchy slice that's deterministic in-process (workflow override → caller override → who.persona → role map → 'pm').
- `src/services/iris/renderContext.ts` — pure deterministic renderer. Composes persona preamble + WHO/WHAT/WHEN/WHERE/WHY blocks in spec fixed order. Drops null slots. Truncates global prompt at `TOTAL_FABRIC_TOKEN_BUDGET` with a `trim_log` entry when an oversized prompt would emit (spec §10 case 10).
- `src/lib/featureFlags.ts` — new `irisUseFabric` flag (default off). Env: `VITE_FLAG_IRIS_USE_FABRIC=true`.

### Tests

- `src/services/iris/__tests__/contextFabric.test.ts` — 48 tests covering:
  - `buildContext` shape + meta + Phase 1a-null-slot behavior + override injection.
  - `resolvePersonaForInvocation` — all 5 levels of the ADR-019 hierarchy.
  - `renderContext` — empty fabric (persona preamble only), no `null` string leaks.
  - **30-call matrix** (5 personas × 6 entity kinds) — every (persona × entity) pair builds and renders a deterministic prompt that includes all 5 slot headers.
  - Token budget — every fixture call stays under the 2950-token total budget; per-slot estimator stays within 2× ceiling sanity bound; an artificially oversized prompt is truncated + logged.
  - PERSONAS registry parity with seed migration — 5 personas, owner_rep is never-auto (1.0), foreman threshold is 0.9.

## Verification commands

```bash
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit -p tsconfig.app.json
# → exit 0

NODE_OPTIONS="--max-old-space-size=8192" npx vitest run src/services/iris/__tests__/contextFabric.test.ts
# → 48/48 pass

NODE_OPTIONS="--max-old-space-size=8192" npx eslint src/services/iris/ src/lib/featureFlags.ts
# → 0 errors
```

## What this does NOT do (deferred to later sub-phases)

- **DB-bound slot resolvers (Days 2–8 per spec).** Phase 1a slot builders return null; tests inject fixture data. Phase 1b wires the real per-slot queries.
- **iris-call edge function integration.** The `use_fabric` request flag and the Fabric-side call path land in Phase 1b. Phase 1a's renderer is pure-frontend; nothing in `supabase/functions/iris-call/` changes.
- **Token estimator precision.** Phase 1a uses a 4-char-per-token approximation; Day 9 of the spec swaps in tiktoken if telemetry shows drift > 10%.
- **Persona-eval goldens.** Phase 1e adds the 50-fixture × 5-persona divergence eval.
- **Lint rule `no-raw-iris-system`.** Phase 1c (Days 15–22 per spec).
- **Persona dashboards.** Phase 1d (Days 23–28).

## Phase 1a acceptance check (spec §5.1)

✅ Fabric builds for all 5 personas without errors — 30-call matrix passes.
✅ Snapshot tests for each persona × representative entity — 30 tests pass.
✅ Token budget never exceeds ceiling on the 30 fixture calls — assertion in test suite.
✅ Migrations apply cleanly + cascade safely on rollback — both migrations idempotent (`IF NOT EXISTS`) with documented `DROP` paths.
✅ Production behavior unchanged — feature flag default off; no existing call site touched.

## Why this is small on purpose

Phase 1a is the SHAPE PR. Per the day-by-day breakdown in the spec, Days 2–8 each add one slot resolver in its own PR. Landing the full Fabric in a single mega-PR would break the atomic-PR discipline that lets the next 30 days roll cleanly. The next PR (Phase 1b) is the first cutover and is where the rubber meets the road.

## Next up

**PR 1b — RFI + submittal + daily-log Fabric cutover.** Wire the `iris-call` edge function to accept `use_fabric: boolean`, flip the 3 highest-volume Iris surfaces to call `buildContext()` instead of the inline prompt builders, flip `iris_use_fabric=true` on the soft-pilot org for 7 days, watch acceptance rate.
