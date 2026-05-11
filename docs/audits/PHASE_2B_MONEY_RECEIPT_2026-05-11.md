# Phase 2b — Money specialist + CO pricing

**Date:** 2026-05-11
**Branch / PR:** `phase-2b-money`
**Spec:** [`IRIS_PHASE_2_SPECIALIST_SUBAGENTS_SPEC_2026-05-08.md`](IRIS_PHASE_2_SPECIALIST_SUBAGENTS_SPEC_2026-05-08.md)
**ADR:** [`ADR_018_SPECIALIST_BOUNDARY_CONTRACT_2026-05-08.md`](ADR_018_SPECIALIST_BOUNDARY_CONTRACT_2026-05-08.md)
**Builds on:** Phase 2a (#423)

## TL;DR

Second specialist in the Phase 2 sequence. `llmScope: 'narrative_only'` — the LLM writes prose around deterministic facts, never invents numbers. Deterministic CO pricing math (line items + overhead + bond + insurance + sub-fee + gc-fee) lives in `src/services/iris/co-pricing.ts` as pure functions on `Cents` (Sprint Invariant #2). 100% deterministic-check coverage. 19 new tests; typecheck zero.

## What changed

### CO pricing math

`src/services/iris/co-pricing.ts` (new) — pure functions:
- **`priceChangeOrder(input)`** — line-item subtotal (with per-line markup), then compound percentages applied in spec order: overhead → bond → insurance → sub_fee → gc_fee.
- **`reconcileTotal(claimed, breakdown)`** — `{ matches, diff }` per the Money specialist's reconciliation flow.

All operations use `addCents` / `multiplyCents` / `applyRateCents` / `subtractCents` from `src/types/money.ts`. No raw arithmetic on dollar values.

### Money specialist

`src/services/iris/specialists/money.ts` (new) —
- **`moneyDeterministicCheck()`** — 100% coverage on the spec's gate conditions:
  - Missing `co_id`
  - Empty / malformed `line_items`
  - Non-integer `unit_cost` (Sprint Invariant #2)
  - `quantity <= 0`
  - `markup_rate` outside `[0, 5]`
  - Percentage rates outside `[0, 1]`
  - Non-integer `claimed_total_cents`
  - WARNING (not blocker) on claimed-vs-calculated mismatch
- **`MONEY_DECL`** — `llmScope: 'narrative_only'`, `modelTier: 'haiku'` (cheap+fast), `writeScope: []` (read-only — executor commits), `latencyBudgetMs: { p50: 2000, p95: 4000 }`, audit fields BASE + `co_id` + `claimed_total_cents` + `calculated_total_cents` + `reconciliation_matches`, tools = `verify_money_math` / `cite_change_order` / `cite_budget_line`.
- **`computeMoneyFacts()`** — public entry that runs the deterministic math; the LLM dispatch path consumes the breakdown directly without re-computing.
- **`moneyShouldRun()`** — router entry point (Phase 2e).

### Tests

`src/services/iris/specialists/__tests__/money.test.ts` (19 tests):
- 4 contract-conformance tests on `MONEY_DECL`.
- 9 deterministic-check tests covering every gate (positive + each negative path).
- 6 deterministic-math tests on `priceChangeOrder` + `reconcileTotal`.

### Spec card

`docs/audits/IRIS_SPEC_MONEY_2026-05-11.md` — tier-1 Iris Spec.

## Verification

```bash
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit -p tsconfig.app.json
# → exit 0

NODE_OPTIONS="--max-old-space-size=8192" npx vitest run src/services/iris/specialists/
# → Drafter (15) + Money (19) = 34/34 pass

NODE_OPTIONS="--max-old-space-size=8192" npx vitest run src/services/iris/
# → 116/116 pass (no regressions in contextFabric, legacyAdapters, drafts, etc.)
```

## Phase 2b acceptance check

✅ `MONEY_DECL` conforms to ADR-018.
✅ 100% deterministic-check gate coverage (every spec'd condition has a test).
✅ `priceChangeOrder()` math correct per the 6-test deterministic suite.
✅ All math through `src/types/money.ts` (Sprint Invariant #2 preserved).
✅ Iris spec card filed.
⏳ 50 goldens — Walker-authored Phase 2 Days 38–43.

## Next up

**PR 2c — Schedule specialist + CPM module.** `src/services/iris/specialists/schedule.ts` with `llmScope: 'synthesis'`; CPM walk + lookahead synthesis in `src/services/iris/cpm.ts`. Perf budget: < 200ms on 500-activity graph.
