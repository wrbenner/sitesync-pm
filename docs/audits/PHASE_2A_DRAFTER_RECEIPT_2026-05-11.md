# Phase 2a — Drafter specialist + ADR-018 boundary base

**Date:** 2026-05-11
**Branch / PR:** `phase-2a-drafter`
**Spec:** [`IRIS_PHASE_2_SPECIALIST_SUBAGENTS_SPEC_2026-05-08.md`](IRIS_PHASE_2_SPECIALIST_SUBAGENTS_SPEC_2026-05-08.md)
**ADR:** [`ADR_018_SPECIALIST_BOUNDARY_CONTRACT_2026-05-08.md`](ADR_018_SPECIALIST_BOUNDARY_CONTRACT_2026-05-08.md)
**Builds on:** Phase 1 (#418/#419/#420/#421/#422)

## TL;DR

Opens **Phase 2** with the shared specialist boundary contract (ADR-018 `SpecialistDecl` type) and the first specialist — `Drafter` — fully declared and gate-tested. Phase 2a is the contract-surface PR; the LLM-side cutover from `templates.ts` to specialist-driven dispatch lands in Phase 2e.

15 new tests green; typecheck zero; existing 135+ iris tests still pass.

## What changed

### Contract base

`src/services/iris/specialists/types.ts` (new) — the shared `SpecialistDecl` type, generic over each specialist's input shape:

```ts
SpecialistDecl<TInput> {
  name, version,
  deterministicCheck,           // ADR-018: runs first, never LLM-evaluated
  llmScope,                     // 'narrative_only' | 'synthesis' | 'generative' | 'none'
  modelTier,                    // 'haiku' | 'sonnet' | 'opus'
  promptVersion,
  writeScope[],                 // empty = read-only; writes flow through executors
  latencyBudgetMs { p50, p95 },
  auditFields[],                // appended to iris_actions per invocation
  toolAllowList[],              // closed list — bump version + ADR to extend
}
```

`BASE_AUDIT_FIELDS` — the 9 fields every specialist must declare. `assertAuditFieldsComplete()` runs at module-load time to fail loudly when a specialist's `auditFields` drifts from the base.

### Drafter specialist

`src/services/iris/specialists/drafter.ts` (new) —
- **`drafterDeterministicCheck(input, ctx)`** — ADR-018 gate. Returns `{ ok, blockers?, warnings? }`. Blockers: `item.id`, `item.title`, `project_context.projectId`. Warnings: missing recipient name. Draft-type-specific blockers: `owner_update` requires `reportingPeriodDays > 0`.
- **`DRAFTER_DECL`** — full `SpecialistDecl<DrafterInput>`:
  - `llmScope: 'generative'`, `modelTier: 'sonnet'`, `latencyBudgetMs: { p50: 3000, p95: 6000 }`.
  - `writeScope: []` — Drafter is read-only; the executor commits.
  - `auditFields`: BASE + `draft_type` + `persona` + `truncated`.
  - `toolAllowList`: 9 `cite_*` tools (8 citation kinds + `cite_photo_observation`).
- **`drafterShouldRun(input, ctx)`** — public entry point the router will call from Phase 2e.

### Tests

`src/services/iris/specialists/__tests__/drafter.test.ts` (15 tests):
- 5 contract-conformance tests (name, scope, version, writeScope empty, latency budget sanity, tool-list shape).
- 10 deterministic-check decision tests covering each draft type's gates + multi-blocker reporting.

### Spec card

`docs/audits/IRIS_SPEC_DRAFTER_2026-05-11.md` — tier-1 Iris Spec per the `/iris-spec` template (entrypoint, persona, specialist, fabric inputs, citation kinds, voice rules, auto-execute risk, telemetry, acceptance).

## Verification commands

```bash
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit -p tsconfig.app.json
# → exit 0

NODE_OPTIONS="--max-old-space-size=8192" npx vitest run src/services/iris/specialists/
# → 15/15 pass
```

## What this does NOT do

- **50-fixture goldens.** Walker authors during Phase 2 Days 31–37 per spec §7.
- **Templates.ts extraction.** Phase 2a leaves `templates.ts` in place as the LLM-prompt source. Phase 2e (or a follow-up) wires the Drafter to call its own prompt templates directly and removes the templates.ts indirection.
- **Voice linter coupling.** Drafter inherits the existing iris-call voice linter post-process; no specialist-specific voice rules in Phase 2a.
- **CI lint enforcement of the contract.** ADR-018 §"Rules" lists 7 CI-enforced rules. Phase 2a ships the contract types; the `scripts/audit-specialists.mjs` lint is a Phase 2 close-out task once all 4 specialists land.

## Phase 2a acceptance check

✅ `SpecialistDecl` base shipped + Drafter conforms.
✅ Deterministic gate covers all 6 draft types' minimum required fields.
✅ Read-only `writeScope` (executor pattern preserved).
✅ Iris spec card filed.
⏳ 50-fixture goldens — Walker-authored, Days 31–37.

## Next up

**PR 2b — Money specialist + CO pricing.** `src/services/iris/specialists/money.ts` with `llmScope: 'narrative_only'` (LLM never invents numbers). Deterministic-check coverage 100% per ADR-018 row; routes all dollar math through `src/types/money.ts`.
