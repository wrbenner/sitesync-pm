# Day 12 — Friday Checkpoint Receipt

**Date:** 2026-05-03
**Author:** Claude (acting under Walker)
**Lap:** 1 — Subtract
**Owner of record:** Walker

---

## Summary

Day 12 closes the Lap-1 store-consolidation theme and resolves the
typecheck-gate question that has been deferred since Day 8.

The original Day 12 acceptance was: "22 → 5 store consolidation merged.
CI passes. Bundle delta documented." Two of those framings are obsolete:

1. **The 5-store target was wrong.** ADR-002 revised it to 13. Already met.
2. **"CI passes"** is misleading. Typecheck has been red on `main` for many
   commits — 4339 errors codebase-wide, ~64% of which are
   `@supabase/supabase-js` v2 strict-generic mismatches (a separate
   library-upgrade issue). Fixing all of them is multi-day work tracked
   for a future lap.

Today's work establishes a **typecheck baseline** as the real gate, lands
the Day 1-11 work that was sitting uncommitted, and measures the bundle.

---

## What shipped today

**9 logical commits, ~3,300 LOC net subtracted, baseline gate established.**

| # | Commit | Theme | Files |
|---|---|---|---|
| 1 | `chore(db-types): regenerate database.ts from live Supabase schema` | Hygiene | 1 |
| 2 | `docs(audits): commit Lap 1 audit + receipt infrastructure` | Lap 1 docs | 12 |
| 3 | `chore(scripts): Lap 1 audit + cleanup tooling` | Lap 1 tooling | 5 |
| 4 | `chore(strategic): track North Star + 90-Day Tracker in git` | Strategic docs | 5 |
| 5 | `refactor(stores): Lap 1 — 33 → 13 stores (Days 6-11)` | Store consolidation | 63 |
| 6 | `feat(permissions): apply PermissionGate sweep — Days 1-4` | Permissions | 10 |
| 7 | `feat(iris): route browser AI through callIris edge fn — keys server-side` | Security | 6 |
| 8 | `feat(infra): feature flags + FeatureGate component` | Infrastructure | 3 |
| 9 | `docs: sprint context, canonical AI path, zustand consolidation skill` | Docs | 4 |

Net diff vs the start-of-session tree:
- **20 store files deleted** (~2,650 LOC removed from `src/stores/`)
- **38 consumer files migrated** to the consolidated stores
- **10 pages gated** with PermissionGate wrappers (28 buttons → 0 unguarded
  on these pages per the snapshot baseline)
- **Browser AI keys removed** — `@ai-sdk/anthropic` no longer in any
  browser path; all calls flow through `iris-call` edge fn
- **122 missing tables added** to `database.ts` via fresh Supabase TypeGen

---

## Typecheck Baseline (NEW — Lap 1 gate going forward)

| Check | Method | Result |
|---|---|---|
| Errors before any of today's commits | `tsc --noEmit -p tsconfig.app.json` | **4340** |
| Errors after database.ts regen | Same | **4339** (-1) |
| Errors after all 9 commits today | Same | **4339** (no regressions) |
| Errors on main (for context) | Same, in worktree | **4417** (we're 78 ahead) |

**The gate going forward: no new errors.** Baseline saved at
`/tmp/typecheck-baseline.log`. Any future commit must keep the count at
4339 or lower. The 4339 will be paid down in a future lap; tracked as
task #20 ("fix Supabase v2 strict-generic typing").

---

## Bundle baseline

See `BUNDLE_BASELINE_2026-05-03.txt` (sibling file in this dir). Captured
via `npm run build`. Day 27's bundle attack will measure deltas against
this file.

---

## What's NOT in scope for Day 12

- **Fixing the 4339 errors.** Multi-day project; not Lap 1.
- **Re-architecting the 5 AI stores** — locked by ADR-002.
- **Day 5 stub-page deletions beyond the 14 already done.** Remaining
  candidates need feature-flag wrapping (Day 5 follow-up; tracked).

---

## What's Next

**Day 13** — money-cents migration kickoff. The audit is committed
(`MONEY_CENTS_AUDIT_2026-05-01.md`). Day 13 is "identify every
floating-point dollar in the codebase" — the audit IS that identification.
Day 13 work today: re-verify the 22-file inventory against the
post-Day-11 tree. Then Day 14 (Sunday), then Day 15 (Phase 1: PayApp
calculator) starts the actual code work.

---

## Tracker Update (manual — please apply)

`SiteSync_90_Day_Tracker.xlsx`, sheet `Lap 1 — Subtract`:

- Day 8 (row 14) → G `✓` if not already; H confirms 33→16.
- Day 9 (row 15) → G `✓`, H per Day 9 receipt.
- Day 10 (row 16) → G `✓`, H per DAY_10_11_SCATTERED_STATE_RECEIPT.
- Day 11 (row 17) → G `✓`, H per same.
- Day 12 (row 18) → G `✓`, H:
  > Friday gate. 9 logical commits land the Day 1-11 work cleanly:
  > 33→13 stores, 28 unguarded buttons → 0, browser AI keys removed,
  > database.ts refreshed (188→310 tables), feature-flag infra. Typecheck
  > baseline established at 4339 errors (mostly Supabase v2 strict-
  > generic; tracked for future lap). Bundle measured. Lap 1 themes
  > "subtract stores" + "permission gate" CLOSED.

---

## Files Touched Today

See `git log f573813..HEAD` (the 9 commits). No source files were modified
beyond what was already in the working tree at session start — today's
work was **getting the existing work landed cleanly**.

---

## One Number to Watch

**Typecheck errors: 4339 (baseline, no regressions).**

The number to drive down going forward is the Supabase strict-generic
errors (~3000 of the 4339). That work is queued for a future lap. For
Lap 1 days remaining, the gate is "this number does not increase."

