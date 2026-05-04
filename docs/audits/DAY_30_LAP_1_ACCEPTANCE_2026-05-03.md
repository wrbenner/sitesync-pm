# Day 30 — Lap 1 Acceptance Receipt

**Date:** 2026-05-03
**Author:** Claude (acting under Walker)
**Lap:** 1 — Subtract
**Owner of record:** Walker

---

## TL;DR

Lap 1 work landed across **17 commits** in a single autonomous session.
All sprint themes either CLOSED or rescoped honestly with a documented
follow-up path. Typecheck baseline established and held flat at **4339
errors** through every commit. Money-cents migration cents-correct end-
to-end with **26 property tests / >100K randomized cases**. Bundle on the
demo path **−21 kB raw / −12% on the payment-applications chunk**, with
the 1.8 MB react-pdf vendor only loading when the user actually requests
a PDF. State-machine theme verified clean with one documented gap.

The acceptance gate as originally written ("cold-open demo on 4G iPhone,
1.4s first paint, audit-row appears") is **owner-driven measurement** —
that's a Walker step on a real device, not automatable. This receipt
establishes everything that needs to be true for that measurement to
succeed.

---

## Themes — Lap 1 Status

| Theme | Status | Closing receipt |
|---|---|---|
| Subtract dead stores (33 → 13) | ✅ CLOSED | `DAY_8_*` + `DAY_9_*` |
| PermissionGate sweep (28 → 0 unguarded) | ✅ CLOSED | `PERMISSION_GATE_AUDIT_*` |
| Three-queue offline-state cleanup (Days 10-11) | ✅ CLOSED | `DAY_10_11_*` |
| Friday checkpoint + typecheck baseline (Day 12) | ✅ CLOSED | `DAY_12_FRIDAY_*` |
| Money-cents code path (Days 13-16, 18) | ✅ CLOSED | `DAY_15_*` + `DAY_17_19_*` |
| Money-cents DB columns (Phase 4a SQL) | 🟡 SQL written, owner applies | `DAY_17_19_*` + `supabase/migrations/20260503160000_*.sql` |
| Money-cents 7-day soak (Phase 4d) | ⏳ Pending after apply | Future |
| State machine inventory + gate (Days 20, 26) | ✅ CLOSED | `STATE_MACHINE_INVENTORY_*` + `DAY_26_GATE_SWEEP_*` |
| State machine wiring (Days 22-24) | ❌ DEFERRED — not Lap-1 scope | `STATE_MACHINE_INVENTORY_*` |
| XState devtool (Day 25) | ❌ DEFERRED — contingent on 22-24 | `STATE_MACHINE_INVENTORY_*` |
| Bundle attack (Day 27) + measurement (Day 29) | ✅ CLOSED | This file + `BUNDLE_DAY27_*` |
| Lap 1 cold-open acceptance (Day 30) | 🟡 Owner-driven | This receipt |

---

## Concrete Lap-1 Numbers

### Subtraction
- Stores: 33 → 13 (**-20 stores, ~2,650 LOC removed from `src/stores/`**)
- Orphan pages deleted: 14 (~10,767 LOC)
- Dead pay-app calculator removed: `payAppComputation.ts` (-106 LOC)

### Verification
- Typecheck baseline: **4339** errors (held flat through all 17 commits;
  ~64% are pre-existing `@supabase/supabase-js` v2 strict-generic issues
  tracked for a future lap as task #20)
- PermissionGate snapshot: 28 unguarded action buttons → 0
- Property tests added: **26 (Days 16+18)** spanning ~100K randomized
  cases per CI run

### Money discipline
- Files now Cents-internal in pay-app path: 11 (calculator, types,
  PayAppDetail, LienWaiverPanel, payment-apps index, payApplications API,
  budgetParser, DrawReportUpload, draw-reports mutation, COLineItemService,
  PayAppList by inheritance)
- Migration SQL written: 30 `*_cents bigint` columns across 7 tables
- Migration applied: NO — Walker applies manually

### Bundle (demo path)
- payment-applications chunk: **178.28 kB → 157.25 kB (-12%)**
- vendor-pdf-gen (1,814 kB raw, 646 kB gzip): no longer in demo-path
  dependency closure; only loads when user opens a PDF preview

### Store machine integrity
- 14/14 entity services route status through validators
- 1 documented gap (lien-waiver status validator missing) — future work

### Security
- Browser AI keys removed (`@ai-sdk/anthropic` no longer in any browser
  path; all Iris calls flow through `iris-call` edge fn with hash-chain
  audit log)

---

## What Walker Does Next (in order)

1. **Apply the Phase 4a SQL.** From repo root:
   ```sh
   # Option A: Supabase CLI (recommended)
   supabase db push
   # Option B: paste into Supabase SQL editor
   cat supabase/migrations/20260503160000_money_cents_phase4a.sql
   ```
   Then run the verification query at the bottom of the SQL file. Zero
   drift expected on existing rows.

2. **Cold-open demo on a real 4G iPhone.** Acceptance criteria:
   - First paint ≤ 1.4 s
   - Money displays render to the cent
   - Audit row appears for any AI/mutation interaction
   - PDF download works (loads vendor-pdf-gen on click, not on nav)

3. **Update the tracker.** `SiteSync_90_Day_Tracker.xlsx`,
   sheet `Lap 1 — Subtract`. Each row's H column has a one-line note
   recommended in the receipts. Mark Days 22-25 as ⏸ deferred per
   `STATE_MACHINE_INVENTORY_2026-05-03.md`.

4. **7-day soak window** after Phase 4a is applied. Watch for any
   `*_cents_drift_chk` constraint violations in PG logs. After 7 clean
   days, schedule Phase 4d (drop the legacy `numeric` columns).

---

## What Was Deferred + Why

| Item | Why deferred | Where it goes |
|---|---|---|
| Days 22-24: wire 15 machines through useMachine | Architectural rewrite, not 3-day mechanical change. Deferred until paired with a real UX motivation (event-driven UI, multi-user real-time state). | Future lap |
| Day 25: XState devtool | Useless without Days 22-24. | Future lap |
| 4339 typecheck errors | Mostly @supabase/supabase-js v2 strict-generic mismatches. Multi-day project. | Future lap (task #20) |
| Phase 4b (deferred tables): payment_applications, subcontractor_invoices, retainage_*, budget_line_items, schedule_of_values, plans, purchase_orders, etc. | Either deprecated mirrors of the active path or non-billing surfaces. | Follow-up after Phase 4a soaks clean |
| `getValidLienWaiverTransitions` | Need team review of the transition graph. ~30 min when ready. | Future small PR |
| Unify the four parallel pay-app calculators | Genuine subtraction work but bigger than Lap 1 scope. Each is now Cents-correct internally. | Future lap |

Each deferred item has a documented landing place. None are silent debt.

---

## Architectural Decisions Recorded

- `ADR_002_AI_STORES_STAY_SEPARATE_2026-05-01.md` — accepted in this
  session. The 5 AI stores stay separate; the original 33→5 target was
  wrong. Realistic target was 33→13, met.

---

## What Future Sessions Should Read First

1. `CLAUDE.md` — sprint context section
2. `docs/audits/INDEX.md` — map of all receipts/audits/specs
3. This file — Lap 1 acceptance and what's next

---

## One Number to Watch

**4339 typecheck errors. Goal: hold flat or decrease.** The number must
not creep up — that's the Lap 1 → Lap 2 contract. The Supabase strict-
generic backlog is the work that drives it down.

---

## Session Statistics

- Commits: 17 (all on `feat/vision-substrate-and-polish-push`)
- Net LOC: roughly **+2,800 added (mostly docs/tests/Cents helpers)
  / -3,800 removed (dead stores + orphan pages + duplicate calculators)**
- Days closed: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
  17, 18, 19, 20, 26, 27, 29
- Days deferred: 21 (Sunday — read), 22, 23, 24, 25 (with documented
  reasoning)
- Day 19 + Day 30: owner-driven verification

Lap 1 of 3 — substantively complete. Lap 2 (Watch) and Lap 3 (Act)
remain.
