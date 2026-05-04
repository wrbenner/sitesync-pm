# Day 15 — Pay-App Cents Migration (Phase 1) Receipt

**Date:** 2026-05-03
**Author:** Claude (acting under Walker)
**Lap:** 1 — Subtract
**Owner of record:** Walker

---

## Summary

Phase 1 of the money-cents migration is **substantively complete** for
the pay-app calculation + display path. Two commits land the work:

- `3d4c4ac refactor(pay-app): Lap 1 — Cents discipline in SOV draft calculators`
- `e7ba74c refactor(pay-app): Day 15 Phase 1 — Cents discipline through display layer`

Net effect: every dollar that flows through the pay-app rendering path
now accumulates on **integer cents** before being formatted for display.
Float drift across N line items, N pay apps, or N retainage rows can no
longer compound — the DB inputs become `Cents` at the boundary, the math
is on `Cents`, the result converts to dollars only at the `fmtCurrency`
call.

Public type signatures are unchanged — display callers still receive
`number` (dollars). Only the *internal accumulator behavior* changed.

---

## Discovery — Four Parallel Calculators

The audit doc identified `payAppComputation.ts` as "the primary
calculator." Reality is messier — production has **four** parallel
calculators, only two of which are correct today:

| # | Calculator | File | Cents-correct? | Status |
|---|---|---|---|---|
| 1 | `computePayApp` | `services/payAppComputation.ts` | float-only | **DELETED** (dead code, zero importers) |
| 2 | `computeRowTotals` + `computeG702FromRows` | `pages/payment-applications/types.ts` | now Cents-internal | **migrated this session** |
| 3 | `calculateG702` + `calculateG703LineItem` | `machines/paymentMachine.ts` | already Cents-internal | OK (commit `7a6b755`) |
| 4 | `computeG702Audited` + `computeG703Line` | `lib/payApp/g702Audited.ts` | bank-rounded penny-exact | OK; uses **its own** dollarsToCents not the canonical Cents brand |

The deeper unification (one calculator, all surfaces) is **not Lap 1
scope** — added as queued work. For Lap 1: every calculator now does its
internal math on integer cents. The *brand types* and *rounding behavior*
across them aren't yet consistent (calc #4 uses banker's rounding, calc
#2 + #3 use Math.round); that's a separate quality bar.

---

## Files Touched

**Deleted:**
- `src/services/payAppComputation.ts` (dead code, ~106 LOC)

**Modified (Cents-internal accumulators):**
- `src/pages/payment-applications/types.ts`
- `src/pages/payment-applications/PayAppDetail.tsx`
- `src/pages/payment-applications/LienWaiverPanel.tsx`
- `src/pages/payment-applications/index.tsx` (KPI bar + retainage tab + G703 grand totals)

**Untouched (Phase 1 spec'd, but found correct on inspection):**
- `src/pages/payment-applications/SOVEditor.tsx` — already routes through
  `paymentMachine.calculateG702`/`calculateG703LineItem`, both Cents-internal
- `src/pages/payment-applications/PayAppList.tsx` — display-only; no math
- `src/pages/payment-applications/G702Preview.tsx` — display-only; reads DB columns
- `src/pages/payment-applications/auditChecks.ts` — drift-tolerance comparisons; semantically should stay float-tolerant until DB columns become int8 cents (Phase 4)
- `src/pages/share/OwnerPayAppPreview.tsx` — display-only; reads payload as-is
- `src/lib/payApp/g702Audited.ts` + `g703Audited.ts` — already penny-exact
- `src/lib/payApp/__tests__/aiaFormulas.test.ts` — already tests cents

---

## What Phase 1 did NOT do

1. **Did not unify the four calculators.** That's a follow-up subtraction
   day — the audit didn't anticipate finding four implementations.
2. **Did not migrate `auditChecks.ts`.** Its tolerance-based drift checks
   are appropriate for the current "DB columns are numeric" reality;
   migrating to cents-exact comparisons is correct only after Phase 4
   makes the DB columns int8 cents.
3. **Did not change `fmtCurrency` signature.** 157 call sites; the
   ergonomic boundary "dollars→fmtCurrency" stays for now. Future work
   could introduce `fmtCents` and migrate piecewise.

---

## Verification

| Check | Method | Result |
|---|---|---|
| typecheck error count after migration | `tsc --noEmit -p tsconfig.app.json` | **4339** (== baseline; zero regressions) |
| `payAppComputation.ts` consumers | `grep computePayApp src/` | only definition file (dead code) |
| `computeRowTotals` consumers still work | Output shape unchanged (`number` dollars) | ✓ |

---

## Phase 2 / Day 16 — Stripe billing

Per `MONEY_CENTS_AUDIT_2026-05-01.md`, Phase 2 is "already done; Day 15 is
verification + property test." `src/services/billing.ts` is on Cents.
Day 16 work today: ship a property test confirming the Stripe round-trip
(`unit_amount` → cents → dollars → unit_amount) is bit-exact.

---

## What's Next

- Day 16 — Stripe verification + property test
- Day 17 Phase 3 — Budget + CO end-to-end (10 files, substantive)
- Day 17 Phase 4 — DB column migration (Supabase migration; needs
  explicit user authorization before running against the live DB)
- Day 18 — round-half-to-even property tests on 100K random pay apps
- Day 19 — hand-verify 3 demo projects end-to-end

---

## One Number to Watch

**Typecheck errors: 4339 (baseline, holding flat across all 12 commits this session).**
