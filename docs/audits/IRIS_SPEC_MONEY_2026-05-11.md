# Iris Spec — Money specialist

**Date filed:** 2026-05-11
**Status:** Draft (Phase 2b contract surface shipped; LLM-side cutover Phase 2e)
**Owner:** Walker
**Skill:** `/iris-spec` template Phase 2 entry.

## Entrypoint

`src/services/iris/specialists/money.ts` — `MONEY_DECL`. Phase 2e router calls `moneyShouldRun(input, ctx)` before any dispatch. Deterministic CO math lives in `src/services/iris/co-pricing.ts` (pure functions on `Cents`).

## Persona

Office and PM (the dollar-touching personas). Other personas don't invoke the Money specialist.

## Specialist (per ADR-018)

| Field | Value |
|---|---|
| `name` | `'money'` |
| `version` | `0.1.0` |
| `llmScope` | `'narrative_only'` — model never invents numbers |
| `modelTier` | `'haiku'` |
| `promptVersion` | `'phase-2b.0'` |
| `writeScope` | `[]` — read-only; `co_pricing_attach_executor` ratifies |
| `latencyBudgetMs` | `{ p50: 2000, p95: 4000 }` |
| `toolAllowList` | `verify_money_math`, `cite_change_order`, `cite_budget_line` |

## Deterministic check coverage (100%)

`moneyDeterministicCheck()` blocks on:
- Missing `co_id`.
- Empty / malformed `line_items` array.
- Non-integer `unit_cost` on any line (Sprint Invariant #2).
- `quantity <= 0`.
- `markup_rate` outside `[0, 5]`.
- `overhead_rate`, `bond_rate`, `insurance_rate`, `sub_fee_rate`, `gc_fee_rate` outside `[0, 1]`.
- `claimed_total_cents` not an integer.

Emits a WARNING (not a blocker) when `claimed_total_cents` is supplied and disagrees with the deterministic calculation — the specialist surfaces the mismatch in the narrative.

## CO pricing math

`priceChangeOrder()` is fully tested (6 test cases) covering:
- Line subtotal with markup pre-aggregation.
- Compound percentages: overhead → bond → insurance → sub_fee → gc_fee (applied in order).
- `reconcileTotal()` returns `{ matches, diff }`.

All math through `src/types/money.ts` (`addCents`, `multiplyCents`, `applyRateCents`, `subtractCents`). No raw `+ * /` on dollar values.

## Context Fabric inputs (per ADR-020)

Money does not consult the Fabric in Phase 2b; the pricing inputs come directly from caller-resolved DB rows (CO line items, sub T&M tickets). Phase 3 (Knowledge Absorption) may layer in contract-document references via the Code specialist.

## Citation kinds

`cite_change_order` (links to the CO record) and `cite_budget_line` (links to the cost-code line affected). The Money specialist's narrative MUST cite at least one of these per emit.

## Voice rules (per ADR-005)

`narrative_only` LLM scope means the voice linter post-process applies normally. Money-specific voice rules:
- Never restate a dollar value the LLM didn't receive as input.
- Always cite the source document for any dollar figure.
- Defer math reconciliation to the deterministic check; the LLM reports the result, never recomputes.

## Auto-execute risk

**None in Phase 2b.** Money is read-only — it produces a narrative. The `co_pricing_attach_executor` (Phase 2e or follow-up) handles the DB write with PermissionGate.

## Telemetry

`iris_actions` row fields (BASE + Money-specific):
- BASE: 9 fields
- `co_id`
- `claimed_total_cents`
- `calculated_total_cents`
- `reconciliation_matches`

## Acceptance (Phase 2b)

- ✅ Contract surface conforms to ADR-018.
- ✅ 100% deterministic-check coverage on all 8 gate conditions.
- ✅ CO pricing math fully tested (6 deterministic test cases).
- ✅ 19 tests on `money.test.ts` pass.
- ⏳ 50-fixture goldens — Walker-authored Phase 2 Days 38–43.
- ⏳ Cutover to specialist-driven LLM dispatch — Phase 2e.
