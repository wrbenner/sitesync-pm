# Phase 2d - Code specialist + KB stub

Date: 2026-05-11. Branch: phase-2d-code. Builds on 2a/2b/2c (#423/#424/#425).

## TL;DR

Fourth Phase 2 specialist. llmScope synthesis; cite-or-reject enforced. 30-clause representative corpus shipped as fixture; 5K-clause SME target. pgvector retrieval lands Phase 3. 19 new tests; typecheck zero.

## Changes

- src/services/iris/kb-stub.ts: retrieveClauses (Jaccard + section-id boost), citeOrReject pipeline.
- tests/fixtures/code-kb/clauses.json: 30 clauses across IBC 2024, NEC 2023, ASHRAE 90.1/62.1/189.1.
- src/services/iris/specialists/code.ts: codeDeterministicCheck gates question/corpus/k/jurisdiction; CODE_DECL with synthesis scope + sonnet tier + read-only writeScope + cite_* tools.
- src/services/iris/specialists/__tests__/code.test.ts: 19 tests (3 contract, 8 gate, 5 retrieval, 2 pipeline, 1 perf).
- docs/audits/IRIS_SPEC_CODE_2026-05-11.md: tier-1 Iris Spec card.

## Acceptance

- CODE_DECL conforms to ADR-018.
- Deterministic gate coverage on every spec condition.
- Retrieval ranking + section-id boost + cite-or-reject paths tested.
- Perf: 1000-iteration sweep under 5s budget.
- Pending: 5K-clause corpus (SME), pgvector retrieval (Phase 3).

## Verification

NODE_OPTIONS=... npx tsc --noEmit -p tsconfig.app.json   - exit 0
npx vitest run src/services/iris/specialists/             - 73 pass (Drafter 15 + Money 19 + Schedule 20 + Code 19)

## Next up

PR 2e: router + 3 hardened executors + phase-2-acceptance.yml. Router consumes IrisContext, routes on persona + entity_type + invocation_intent. executor_runs migration for shadow-mode logging.
