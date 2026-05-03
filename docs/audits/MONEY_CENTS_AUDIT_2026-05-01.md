# Money-Cents Migration Audit

**Date:** 2026-05-01
**Status:** Complete inventory; migration spec ready for autonomous execution
**Scope:** All files in `src/` that touch construction money (pay apps, SOV,
G702/G703, change orders, budget, retainage). Stripe billing is excluded —
already on Cents.

---

## Executive Summary

**The Cents type module exists and is in production use.** The 9-file
adoption list is correct as a current state, but the migration is incomplete
in three areas: the pay application **UI computation path**, the **change
order line item aggregation**, and the **budget editor**. This audit
identifies 22 specific files that still use floating-point dollars.

### State of Cents adoption

**ON Cents** (no work needed):
1. `src/types/money.ts` — the module itself
2. `src/services/billing.ts` — Stripe subscription path
3. `src/lib/financialEngine.ts` — project rollup math
4. `src/lib/predictions.ts` — forecast math
5. `src/lib/projectAnalytics.ts` — analytics rollups
6. `src/services/reportService.ts` — PDF report generation
7. `src/machines/paymentMachine.ts` — payment state machine
8. `src/pages/Budget.tsx` — read-only display path (uses centsToDisplay)
9. `src/test/lib/money.test.ts` + `src/test/lib/financialEngine.test.ts`

**OFF Cents (migration target)** — 22 files in three groups:

---

## Group 1 — Pay Application Computation (Day 14)

This is the highest-risk group: the AIA G702/G703 calculator. Every cent
shown to subs and owners flows through this path.

| File | Pattern | Risk |
|---|---|---|
| `src/services/payAppComputation.ts` | Float math (`gross_completed * (rate/100)`) | **Critical** — primary calculator |
| `src/pages/payment-applications/types.ts` | `parseFloat(row.scheduledValue)` | High — feeds calculator |
| `src/pages/payment-applications/SOVEditor.tsx` | `parseFloat(value)`, `parseFloat(e.target.value)` | High — user input ingest |
| `src/pages/payment-applications/PayAppDetail.tsx` | Reads + displays | Medium |
| `src/pages/payment-applications/PayAppList.tsx` | Reads + displays | Medium |
| `src/pages/payment-applications/G702Preview.tsx` | Reads + displays | Medium |
| `src/pages/payment-applications/auditChecks.ts` | Validates math | Medium — must agree with calculator |
| `src/pages/payment-applications/__tests__/auditChecks.test.ts` | Validates math | Test |
| `src/pages/payment-applications/__tests__/PayAppDetail.audit.test.tsx` | Integration test | Test |
| `src/pages/share/OwnerPayAppPreview.tsx` | Owner-facing display | High — external visibility |
| `src/lib/payApp/g702Audited.ts` | Audited G702 generation | High |
| `src/lib/payApp/g703Audited.ts` | Audited G703 generation | High |
| `src/lib/payApp/__tests__/aiaFormulas.test.ts` | AIA formula tests | Test |

**Migration day:** Day 14 (per Lap 1 plan).
**Acceptance:** Round-half-to-even property tests pass on 100K random inputs (Day 18).

---

## Group 2 — Change Orders + Budget (Day 16)

| File | Pattern | Risk |
|---|---|---|
| `src/services/changeOrderService.ts` | Test uses `15000_00` literal — partial Cents | Medium |
| `src/services/changeOrderLineItemService.ts` | Float math | High |
| `src/pages/ChangeOrders.tsx` | Display layer | Medium |
| `src/hooks/mutations/change-orders.ts` | Float in mutations | High |
| `src/lib/budgetParser.ts` | parseFloat for CSV import | High — boundary |
| `src/api/endpoints/budget.ts` | Float in API | High — boundary |
| `src/api/endpoints/payApplications.ts` | Float in API | High — boundary |
| `src/components/payApplications/DrawReportUpload.tsx` | parseFloat | High — boundary |
| `src/lib/drawReportParser.ts` | parseFloat | High — boundary |
| `src/hooks/mutations/draw-reports.ts` | Float | High |

---

## Group 3 — Type Surface (Day 17)

| File | Issue |
|---|---|
| `src/types/database.ts` | Money columns typed as `number \| null` (24 columns) |
| `src/types/api.ts` | API surface uses bare `number` for money |
| `src/types/financial.ts` | Some on Cents, some not — inconsistent |
| `src/types/portfolio.ts` | Bare `number` |
| `src/types/draftedActions.ts` | Bare `number` |
| `src/types/project.ts` | Bare `number` |

---

## Database Column Migration (Day 17)

The 24 money columns in Postgres are likely `numeric(N,2)` (float-shaped).
Day 17 needs a Supabase migration to convert them to `int8` (cents).

### Money columns (migrate to int8 cents)

```
contract_sum_to_date
original_contract_sum
retainage
retainage_amount
total_earned_less_retainage
gross_completed
net_paid
this_period
previously_billed
materials_stored
balance_to_finish
current_payment_due
approved_change_orders
pending_change_orders
unit_price            (× quantity → line_total)
amount                (change orders, generic)
approved_cost
submitted_cost
actual_cost
committed_cost
forecast_cost
scheduled_value
total_completed
materials_value       (lien waivers)
labor_value           (lien waivers)
```

### NOT money (leave as float/int)

- `*_percent`, `*_pct`, `*_rate` — rates, stay as float 0..1 or 0..100
- `quantity` — counts
- `productivity_score` — metric
- `hours_meter`, `mileage` — sensor readings
- `retainage_percent` — rate, not money

### Migration SQL pattern

```sql
-- Phase 4a (Day 17): add cents columns
ALTER TABLE pay_applications
  ADD COLUMN contract_sum_to_date_cents int8,
  ADD COLUMN original_contract_sum_cents int8,
  ADD COLUMN retainage_amount_cents int8,
  ADD COLUMN total_earned_less_retainage_cents int8,
  ADD COLUMN net_paid_cents int8,
  ADD COLUMN current_payment_due_cents int8;

-- Phase 4b: backfill
UPDATE pay_applications SET
  contract_sum_to_date_cents = ROUND(contract_sum_to_date * 100)::int8,
  original_contract_sum_cents = ROUND(original_contract_sum * 100)::int8,
  retainage_amount_cents = ROUND(retainage_amount * 100)::int8,
  total_earned_less_retainage_cents = ROUND(total_earned_less_retainage * 100)::int8,
  net_paid_cents = ROUND(net_paid * 100)::int8,
  current_payment_due_cents = ROUND(current_payment_due * 100)::int8;

-- Phase 4c: drift CHECK
ALTER TABLE pay_applications
  ADD CONSTRAINT contract_sum_cents_matches
    CHECK (contract_sum_to_date_cents = ROUND(contract_sum_to_date * 100)::int8);
-- (one CHECK per column)

-- Phase 4d (after 7-day soak): drop old columns
-- ALTER TABLE pay_applications DROP COLUMN contract_sum_to_date, ...;
```

Tables to migrate: `pay_applications`, `pay_app_line_items`, `change_orders`,
`change_order_line_items`, `budget_items`, `division_budgets`, `contracts`,
`invoices`, `lien_waivers`, `subs`.

---

## The Three Migration Phases

### Phase 1 — PayApp calculator + G702/G703 (Day 14)
**Goal:** `computePayApp()` operates on Cents end-to-end.
1. Update `PayAppLineItem` interface so all numeric money fields are typed `Cents`.
2. Update `computePayApp()` to use `addCents`, `multiplyCents`, `applyRateCents` — never raw `*` or `+` on money.
3. Convert `payment-applications/types.ts` helpers to take Cents in, return Cents out. Rename `scheduledValue: string` to `scheduledValueCents: Cents` and add `parseDollarsToCents(input)` helper at input boundary.
4. Update `SOVEditor.tsx`, `G702Preview.tsx`, `PayAppDetail.tsx`, `PayAppList.tsx`, `OwnerPayAppPreview.tsx` to consume Cents and call `centsToDisplay()` for rendering.
5. Update `auditChecks.ts` + tests to assert on Cents.
6. Update `g702Audited.ts` + `g703Audited.ts` + `aiaFormulas.test.ts`.

**Acceptance:** All existing pay-app tests pass. Demo data on 3 projects renders identical totals before and after.

### Phase 2 — Stripe-billing verification (Day 15)
**Goal:** Already done; Day 15 is verification + property test.
1. Add property test that `billing.ts` Cents conversion round-trips exactly through Stripe's `unit_amount`.
2. Add tests for `paymentService.ts` if any money math exists there.

### Phase 3 — Budget + CO end-to-end (Day 16)
**Goal:** Every dollar in budget, change order, retention paths is Cents.
1. Migrate `changeOrderLineItemService.ts` to Cents.
2. Migrate `budgetParser.ts` (CSV import) to convert floats to Cents at parsing boundary.
3. Migrate `drawReportParser.ts` + `DrawReportUpload.tsx` similarly.
4. Migrate `api/endpoints/budget.ts` + `api/endpoints/payApplications.ts` to type money fields as `Cents` and convert at the supabase boundary.
5. Migrate the typed responses in `types/api.ts`, `types/portfolio.ts`, `types/draftedActions.ts`, `types/project.ts`.

### Phase 4 — Database column migration (Day 17, dual-read window)
**Goal:** DB columns become int8 cents.
1. Generate Supabase migration: add `*_cents int8` columns alongside each existing `numeric` money column.
2. Backfill via SQL above.
3. Add CHECK constraint that catches drift.
4. Update all reads to prefer `*_cents`, fall back to `ROUND(col * 100)`.
5. Generate updated `src/types/database.ts` from Supabase TypeGen.
6. After 7-day soak window: drop the old `numeric` columns, drop CHECK.

---

## Test Plan for Day 18 (Property tests)

```ts
// src/test/lib/money.property.test.ts
import { fc, test } from 'fast-check'

test('addCents is associative on integer inputs', () => {
  fc.assert(
    fc.property(
      fc.integer({min: 0, max: 1e10}),
      fc.integer({min: 0, max: 1e10}),
      fc.integer({min: 0, max: 1e10}),
      (a, b, c) => addCents(addCents(a as Cents, b as Cents), c as Cents)
                === addCents(a as Cents, addCents(b as Cents, c as Cents))
    ),
    { numRuns: 100_000 }
  )
})

test('computePayApp is bit-stable for the same inputs', () => {
  // generate 100K random pay-app scenarios
  // run computePayApp twice on each
  // assert outputs are bit-identical
})

test('Round-half-to-even is preserved in retainage calculation', () => {
  // For each retainage rate r in [0.05, 0.10, 0.15]:
  //   For each gross g where (g * r) ends in 0.5 cent:
  //     Assert retainage rounds to even
})

test('SOV totals + retainage + previous payments round-trip exactly', () => {
  // Sum of line items = contract sum (no float drift)
})
```

---

## Day-by-Day Execution Order (for the organism)

| Day | Task | Acceptance | Files |
|---|---|---|---|
| 13 | This audit (✅ complete) | Doc shipped | This file |
| 14 | Phase 1 (PayApp calculator) | All pay-app tests green; manual check on 3 demo pay apps | 13 files in Group 1 |
| 15 | Phase 2 (Stripe verification) | Property test added | `billing.ts` + tests |
| 16 | Phase 3 (Budget+CO end-to-end) | All budget+CO tests green; CSV import round-trip exact | 10 files in Group 2 |
| 17 | Phase 4 (DB column migration) | Migration applied; backfill matches; CHECK passes | Supabase migration + types regen |
| 18 | Property tests pass on 100K inputs | Property test suite green | New test file |
| 19 | Friday: integer-cent end-to-end live | Manual verification on 3 demo projects + retro | Demo data |

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Existing demo data has float-shaped values that don't round cleanly | High | Medium | Use `Math.round(col * 100)` for backfill; add CHECK constraint |
| Frontend reads break during dual-column window | Medium | High | Dual-read with prefer `*_cents` fallback to `ROUND(col*100)` |
| Off-by-one cent in retainage calc due to float→cents conversion | Medium | High | Property test with 100K random inputs (Day 18) |
| Stripe webhook calculates a different cent total than internal math | Low | Critical | Integration test comparing webhook payload to internal computation |
| Owner pay-app preview shows wrong total | Low | Critical (external) | E2E test pre-Day-19 retro |

---

## Out of Scope

- **Multi-currency.** All assumptions are USD.
- **Tax computation.** Sales tax is a separate concern.
- **Lien-waiver legal-document strings.** Templates take dollar amounts as
  display strings; they consume Cents inputs and call `centsToDisplay()`.

---

## Sources

Audit produced via:
- Money field grep: `unit_price`, `total_amount`, `line_total`, `subtotal`, `line_amount`, `contract_sum`, `net_amount`, `gross_amount`, `retainage_amount`, `stored_materials`, `earned_amount`, `payment_amount`, `approved_amount`, `invoice_amount`, `tax_amount`, `fee_amount`, `adjustment_amount`, `allocation_amount`
- Float pattern grep: `parseFloat`, `Number(`, `toFixed(2)`, `* 100`, `/ 100`
- Cents adoption grep: `from '../types/money'`, `from '../../types/money'`

Files inspected directly: `payAppComputation.ts`, `billing.ts`,
`financialEngine.ts`, `money.ts`, `database.ts` (range 7200–7800),
`SOVEditor.tsx` (lines 80–500).
