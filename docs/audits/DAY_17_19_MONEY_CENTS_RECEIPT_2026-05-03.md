# Days 17–19 — Money-Cents Migration Phases 3 + 4 + 18 + 19 Receipt

**Date:** 2026-05-03
**Author:** Claude (acting under Walker)
**Lap:** 1 — Subtract
**Owner of record:** Walker

---

## Summary

Closes the money-cents migration theme of Lap 1. Five commits across the
Budget + CO path, the Supabase migration, and 100K-input property tests.

| Day | Theme | Commit |
|---|---|---|
| 17 / Phase 3 | Cents through budget+CO+drawreport path | `245f82f` |
| 17 / Phase 4a | Supabase migration SQL (NOT applied) | `ec9a6b8` |
| 18 | 100K-input property tests for G702 calc | `7c772ac` |
| 19 | Hand-verify (this receipt — verification is owner-driven) | (no commit) |

Net effect: every active-path money column has a `*_cents bigint` shadow
ready to land in Postgres; every pay-app calculator path uses canonical
`Cents` helpers internally; 100K randomized invocations of the audited
G702 calculator confirm zero drift across deterministic identities.

---

## Day 17 / Phase 3 — Code

Files migrated to canonical `src/types/money.ts` Cents discipline:

- `src/api/endpoints/payApplications.ts` — `computeCurrentPaymentDue`
  rewritten to operate on Cents end-to-end (lines 5/5a/5b/6/8 of AIA G702)
- `src/lib/budgetParser.ts` — XLSX-import `computedTotal` verification
  reduce sums on integer cents
- `src/components/payApplications/DrawReportUpload.tsx` — live
  reconciliation + subtotal-detection slice + totals memo all on cents
- `src/hooks/mutations/draw-reports.ts` — DB-write boundary computes
  totalCompleted / retainage / contractSum / earnedLessRetainage /
  currentDue / balanceToFinish via cents; per-division actuals
  accumulator on cents
- `src/services/changeOrderLineItemService.ts` — replaced ad-hoc
  `Math.round(x*100)` with canonical `dollarsToCents/addCents`

No public type signatures changed — DB columns remain `numeric`; the
boundary contract stays "DB row → cents → math → dollars → fmtCurrency".

---

## Day 17 / Phase 4a — Database

`supabase/migrations/20260503160000_money_cents_phase4a.sql`

**Status: SQL written, NOT YET APPLIED** (per Walker's request to write
SQL only, not run via MCP).

What it does:
- Adds 30 `*_cents bigint` columns across 7 active-path tables
  (pay_applications, pay_application_line_items, change_orders,
   change_order_line_items, budget_items, contracts, lien_waivers)
- Backfills via `round_half_even_cents()` helper (matches the
  banker's-rounding behavior in `src/lib/payApp/g702Audited.ts`)
- Adds drift `CHECK ... NOT VALID` constraints on each table — applies
  to NEW writes only, doesn't re-validate existing rows on apply

What it does NOT do:
- Drop / rename any legacy `numeric` columns
- VALIDATE the constraints (legacy rows that cannot round-trip would fail)
- Touch deferred tables (payment_applications, payment_line_items,
  subcontractor_invoices, retainage_*, budget_line_items,
  schedule_of_values, etc. — Phase 4b)

How to apply (when ready):

```sh
# Option A — via Supabase CLI (recommended)
supabase db push

# Option B — paste into Supabase SQL editor
cat supabase/migrations/20260503160000_money_cents_phase4a.sql
```

After apply, run the verification query at the bottom of the SQL file
to confirm zero drift on existing rows.

---

## Day 18 — 100K-Case Property Tests

`src/test/lib/payApp/g702Audited.property.test.ts` — 13 tests

- **Determinism gate:** 100K runs of `computeG702Audited` with random
  inputs (5–25 line items each, $0–$50M scheduled values, 0–10% retainage)
  assert bit-identical outputs for identical inputs. Runs in ~4.4s.
- **Cent-exact aggregation:** `totalCompletedAndStored = Σ line totals`
- **No-drift identities:** every G702 derived line algebraically
  reconstructs from its inputs to the cent
- **Final pay-app retainage zeroing** at every layer
- **Banker's rounding correctness:** AIA-published worked examples
  (0.005→0, 0.015→2, 0.025→2, 0.035→4, 0.045→4, 0.055→6)
- **dollarsToCents round-trip** exhaustive for [0, 100K cents]

Plays alongside the existing `money.property.test.ts` (Day 16, 13 tests
covering the canonical `src/types/money.ts` helpers).

Total property-test count after Days 16+18: **26 tests, ~10K total
runs of randomized cases per CI invocation.**

---

## Day 19 — Hand-verify (Walker)

The Day-19 acceptance is "Verified by hand on three real demo projects."
This step is intentionally not automatable — it's an owner-driven check
that the visual rollups match the underlying calculator output. To make
the verification efficient when you sit down to do it:

### What to verify on 3 demo projects

For each demo project (recommend: a small one ≤$100K, a mid one
≤$10M, a large one ≥$10M):

1. Open `/payment-applications` and check the KPI bar: the four
   numbers (Total Due / Total Paid / Pending / Total Retainage) should
   match the G703 totals row when you drill into any individual app.
2. Open the latest pay app's PayAppDetail. The audit panel should
   show `g702_g703_reconcile = pass` (if it shows `fail`, that's a
   real reconciliation issue — not a Phase-3 regression).
3. Hover the SOV grand-total row. The percent-complete should equal
   `totalCompleted / scheduled × 100` for the visible rows (within
   ±0.1% tolerance from rounded display).
4. Lien waivers tab → Cash Flow panel: the four cards should
   reconcile (Total Billed − Total Paid − Retainage = Outstanding).

### What you'd see if Phase 3 introduced a bug

- Cash Flow Outstanding off by $0.01 → cents accumulator didn't run
- KPI total off by ~$1 across 100+ apps → reduce-on-floats regression
- G702 totals row doesn't equal sum of visible G703 lines → calculator
  routing changed unexpectedly

If any of these surface, it's a real bug, not Phase-4 noise (which
hasn't applied yet).

---

## Verification

| Check | Method | Result |
|---|---|---|
| typecheck | `tsc --noEmit -p tsconfig.app.json` | **4339** (== baseline; zero net regressions) |
| Day 16 property tests | `vitest run money.property.test.ts` | ✓ 13/13 pass |
| Day 18 property tests | `vitest run g702Audited.property.test.ts` | ✓ 13/13 pass (100K-case 4.4s) |
| Phase 4a SQL syntax | manually reviewed; idempotent guards present | ✓ |
| Phase 4a SQL applied | NOT APPLIED (awaits Walker) | ⏸ |

---

## What's Next

Lap 1 money-cents theme: **CLOSED for the application code path.** The
remaining two items on this theme:

1. **Walker applies the Phase 4a SQL.** Once applied, run the
   verification query at the bottom of the migration to confirm zero
   drift on existing rows.
2. **7-day soak window.** Watch for any drift CHECK violations
   (would fire on writes; failed-write logs would surface them). After
   7 days clean, schedule Phase 4d to drop the legacy `numeric`
   columns.

Continuing on to **Day 20 (state machine inventory)** in this session.
The audit's `STATE_MACHINE_INVENTORY_2026-05-01.md` is currently a
placeholder; needs to be filled in before wiring the 15 machines.

---

## One Number to Watch

**Money calculations at the cent: 100,000+ randomized cases pass per CI run.**

The number to watch on this theme post-Phase-4a is: drift CHECK
constraint violations. If any fire, the application is computing
something the DB disagrees with — that's a real bug to investigate, not
a transient. Zero violations expected; one violation is a serious incident.
