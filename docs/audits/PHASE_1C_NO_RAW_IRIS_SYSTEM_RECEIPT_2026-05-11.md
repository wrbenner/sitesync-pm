# Phase 1c — ESLint `no-raw-iris-system` rule

**Date:** 2026-05-11
**Branch / PR:** `phase-1c-no-raw-iris-system`
**Spec:** [`IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md`](IRIS_PHASE_1_ROLE_LAYER_CONTEXT_FABRIC_SPEC_2026-05-08.md) §5.3
**Builds on:** PR #418 (1a) + PR #419 (1b)

## TL;DR

Lands the architectural lock for ADR-020. Any code outside `src/services/iris/` that tries to pass a raw `system=` prompt to `callIris()` or `supabase.functions.invoke('iris-call', ...)` now fails lint. The Fabric is the only place that can build a system prompt; new features describe intent via `IrisInvocation` and let `buildContext()` do the assembly.

Zero existing call-site migration was required because Phase 1b already moved the only `system=` use into `src/services/iris/legacyAdapters.ts` (path-exempt). The spec's R3 risk ("~50–75 system= call sites") materialized as zero.

## What changed

### New ESLint rule

- `eslint-rules/no-raw-iris-system.js` — flags `system: <expr>` properties on object literals passed to:
  1. `callIris({...})` directly
  2. `callFn({...})` (aliased — covers the test-injection pattern in `drafts.ts`)
  3. `supabase.functions.invoke('iris-call', { body: { system: ... } })`

- Path-based allow-list: any file under `src/services/iris/` is exempt (covers `contextFabric.ts`, `legacyAdapters.ts`, `templates.ts`, `drafts.ts`, and the slot builders landing Days 2–8). Test/test-fixture paths are also exempt so eval harnesses can inject `system=` for parity comparisons.

- Escape hatch via `// eslint-disable-next-line sitesync/no-raw-iris-system`. Intended for legitimate one-off integration points (e.g. a low-volume admin tool); flagged at PR review.

### Wiring

- `eslint-rules/index.js` — registers `no-raw-iris-system`.
- `eslint.config.js` — sets severity to `error` under the `sitesync` plugin namespace.

### Tests

- `eslint-rules/__tests__/no-raw-iris-system.test.js` — Vitest + ESLint `RuleTester` matrix:
  - **6 valid** cases — non-iris callers, iris-service-internal `system=`, `callIris` without `system=`, `iris-suggest` (different fn) with system=, test paths.
  - **5 invalid** cases — direct callIris in non-iris file, aliased callFn, `supabase.functions.invoke` form, multiple offenders in one file, string-key (`'system'`) form.

### Repository impact

- `npm run lint` on the full src tree: **0 errors** with the new rule active. (1385 pre-existing accessibility/hooks warnings — unchanged.)
- Phase 1b's `drafts.ts` line 99 (`...(adapted ? { system: adapted.systemPrompt } : {})`) is exempt by directory path.
- No production caller required migration.

## Verification commands

```bash
NODE_OPTIONS="--max-old-space-size=8192" npx vitest run eslint-rules/__tests__/no-raw-iris-system.test.js
# → RuleTester matrix passes (11 cases internally)

NODE_OPTIONS="--max-old-space-size=8192" npx eslint src/
# → 0 errors
```

## What this does NOT do

- Does not delete the `system?:` field from `iris-call` request body or `CallRequest` interface. The server-side path still accepts `system=` for backward compatibility through Lap 3 close (per spec §5.3 sunset). The lint rule is the lock; the server-side removal is a Lap 4 cleanup item.
- Does not migrate templates.ts to the Fabric. That's Phase 2a (Drafter specialist extraction).
- Does not flag passing the Fabric-rendered prompt as `prompt:` (only `system:` is gated by ADR-020).

## Phase 1c acceptance check (spec §5.3)

✅ ESLint rule blocks `system=` outside `src/services/iris/` directory.
✅ Allow-list discoverable and minimal — single directory path, no per-file exceptions.
✅ Lint green on `main` with the new rule active.
✅ Rule has comprehensive test coverage (valid + invalid + multi-offender + string-key).
✅ Edge-fn-side `system?:` deprecation header — N/A in this PR (server-side `CallRequest.system` retains backward compat per spec).

## Next up

**PR 1d — persona override hierarchy + 3 dashboards.** `role_to_default_persona` migration; `usePersona()` hook implementing the ADR-019 hierarchy; `HomeForPm` / `HomeForSuper` / `HomeForOffice` dashboard scaffolds.
