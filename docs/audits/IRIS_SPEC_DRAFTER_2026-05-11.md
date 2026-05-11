# Iris Spec — Drafter specialist

**Date filed:** 2026-05-11
**Status:** Draft (Phase 2a contract surface shipped; LLM-side cutover Phase 2e)
**Owner:** Walker
**Skill:** filed manually; corresponds to `/iris-spec` template Phase 2 entry.

## Entrypoint

`src/services/iris/specialists/drafter.ts` — `DRAFTER_DECL` (ADR-018 conformant). The Phase 2e router calls `drafterShouldRun(input, ctx)` to gate the dispatch.

## Persona

Resolved by the Phase 1d `usePersona()` hook or, for server-side calls, the `resolve_persona(user, project)` RPC. The Drafter accepts any of the 5 personas; the system prompt is built per-persona by the Phase 1a Fabric.

## Specialist (per ADR-018)

| Field | Value |
|---|---|
| `name` | `'drafter'` |
| `version` | `0.1.0` |
| `llmScope` | `'generative'` |
| `modelTier` | `'sonnet'` |
| `promptVersion` | `'phase-2a.0'` |
| `writeScope` | `[]` — drafter is read-only |
| `latencyBudgetMs` | `{ p50: 3000, p95: 6000 }` |
| `toolAllowList` | 9 `cite_*` tools (8 citation kinds + photo observation) |

## Context Fabric inputs (per ADR-020)

The Drafter does not call `buildContext()` directly. It receives the
`IrisContext` already assembled by the router (Phase 2e) or, in the Phase 1b
legacy path, by the `adaptStreamItemToFabric()` adapter. The Drafter
consults the context only inside `deterministicCheck` (not LLM-side).

## Citation kinds (per IRIS_CITATIONS_SPEC)

All 8 citation kinds available via `toolAllowList`. Phase 2a does not require
the Drafter to emit citations — the citation expansion phase (Days 38–41 of
Lap 2) already routes citation rendering through the side panel.

## Voice rules (per ADR-005)

Voice linter runs post-process on the drafter's output via the existing
`iris-call` voice linter post-process step (Day 39/45 follow-on receipt).
Drafter-specific voice rules ratchet with `promptVersion` bumps.

## Auto-execute risk

**None in Phase 2a.** Drafter is read-only — it produces a `drafted_action`
shape; the executor (Phase 2e `drafted-action-executor` or the legacy
`draftAction` path) commits the row. Auto-execute eligibility is the
executor's contract, not the Drafter's.

## Telemetry

Emitted to `iris_actions` row on every invocation (Phase 2e wires the writer):
- `BASE_AUDIT_FIELDS` (9 fields)
- `draft_type` — one of the 6 `IrisDraftType` values
- `persona` — resolved PersonaSlug
- `truncated` — whether the rendered system prompt hit the 2950-token ceiling

## Acceptance (Phase 2a)

- ✅ Contract surface conforms to ADR-018 (`DRAFTER_DECL` valid).
- ✅ Deterministic gate covers item.id / item.title / projectId / draft-type-specific blockers.
- ✅ 15 tests on `drafter.test.ts` pass.
- ⏳ 50-fixture goldens — Walker authors during Phase 2 Days 31–37.
- ⏳ Cutover from `templates.ts` to specialist-driven LLM dispatch — Phase 2e.
