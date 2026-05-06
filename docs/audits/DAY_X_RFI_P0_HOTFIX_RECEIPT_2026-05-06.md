# RFI P0 — Schedule Rollup Hotfix Receipt (2026-05-06)

**Drives:** the one P1 caveat from `DAY_X_RFI_P0_VERIFICATION_RECEIPT_2026-05-06.md` — Avery Oaks dashboard "Schedule" KPI showed "0 days On Track" and the project-progress header strip showed "0%" even after the P0 #11 seed reset. Bumping the seed dates wasn't enough; the rollup itself was broken.
**Branch:** `test/coverage-slice-e-2026-05-05` (rides into the same PR as the 11 P0 items).
**Outcome:** Live dashboard now reads 32% complete, +11 days ahead. Both numbers are computed honestly from the schedule_phases data, not hardcoded.

---

## TL;DR

Two root causes — fixed both:

1. **The `project_metrics` materialized view was empty.** `REFRESH MATERIALIZED VIEW` had never been called for it on hosted Supabase. So `select project_id from project_metrics` returned zero rows for *every* project. The Plan page's "Overall Progress" column read 0% as a result. **Fix:** `REFRESH MATERIALIZED VIEW project_metrics` (run live, plus a `DO` block at the end of `supabase/seed/avery-oaks.sql` so future re-seeds converge on populated metrics).

2. **`schedule_variance_days` was hardcoded to literal `0` inside the view.** Two migrations (`00051_get_portfolio_metrics_rpc.sql` and `00054_metrics_views.sql`) both shipped the column as `0 AS schedule_variance_days` — a placeholder no-one came back to fill in. The Plan page therefore showed "On schedule" for every project regardless of actual progress vs. elapsed time. **Fix:** `supabase/migrations/20260506000004_project_metrics_real_variance.sql` redefines the view so `schedule_variance_days` is computed from duration-weighted phase progress vs. elapsed days.

The Bugatti choice on (2): `overall_progress` is kept as the unweighted `AVG(percent_complete)` for backward compatibility (other consumers depend on the existing semantics), but the variance calculation uses **duration-weighted** progress so a 9-day mobilization phase at 100% doesn't get the same weight as a 180-day framing phase at 15%. Honest demo numbers, not a flat mean.

Formula:

```
variance_days =
  (weighted_pct / 100) × total_schedule_days   -- "should be done by today"
  − GREATEST(0, days_since_start)              -- "actually elapsed"
```

For Avery Oaks: 11.7%-weighted complete × 365 days − 30 days elapsed ≈ **+11 days ahead**.

---

## Verification (live, after fix)

Live `project_metrics` row for Avery Oaks (`b1000001-…-001`):

| column | value |
|---|---|
| `overall_progress` | **32** (was 0; AVG of 12 schedule_phases) |
| `schedule_variance_days` | **+11** (was 0; duration-weighted variance) |
| `milestones_completed` | 2 |
| `milestones_total` | 12 |
| `budget_total` | $47,980,000 |
| `budget_spent` | $29,960,000 |
| `rfis_open` | 7 |
| `rfis_overdue` | 7 |
| `punch_open` | 15 |
| `punch_total` | 18 |

Plan page now reads "32% complete" and "+11d ahead" instead of "0%" and "On schedule".

---

## Files

| Path | Change |
|---|---|
| `supabase/migrations/20260506000004_project_metrics_real_variance.sql` | New — redefines `project_metrics` MV with duration-weighted `schedule_variance_days`. Recreates `refresh_project_metrics()` and `get_portfolio_metrics()` per their original signatures. |
| `supabase/seed/avery-oaks.sql` | Appended a `DO $refresh$ ... REFRESH MATERIALIZED VIEW project_metrics ... END $refresh$;` block so re-seeds populate the rollup immediately rather than waiting for the next 5-minute pg_cron tick. |

---

## Bugatti choices that beat the obvious shortcuts

- **Duration-weighted progress for variance, unweighted AVG for overall_progress.** The mixed approach lets us improve the variance calculation without breaking the existing `overall_progress` semantics that other consumers (DashboardCriticalPath, useDecisionEngine, get_portfolio_metrics) depend on.
- **`WITH NO DATA` + separate REFRESH.** The hosted Supabase migration channel times out around 30s; populating the join-heavy view inline blew past that. Splitting the migration into "create empty + index" then "refresh in own transaction" keeps the migration replayable and avoids the silent half-applied state I hit on the first attempt.
- **Idempotent `DO` block in the seed.** Wrapping `REFRESH MATERIALIZED VIEW` in `IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'project_metrics' AND relkind = 'm')` so a partial schema (legitimate state during a fresh local boot) doesn't error out the seed. Same defensive idiom the seed already uses for `drawing_discrepancies`.
- **`refresh_project_metrics()` + `get_portfolio_metrics()` recreated with identical signatures.** The CASCADE drop didn't actually drop them (they reference the view by name, not as a hard catalog dependency), but the migration recreates them with `CREATE OR REPLACE` regardless — defense in depth so a future re-run doesn't silently leave the helpers tied to an old view definition.

---

## Verification

- **Typecheck:** `npm run typecheck` → 0 errors. (Pure SQL change; TS untouched.)
- **ESLint:** `npm run lint` → 0 errors, 1479 warnings (all pre-existing).
- **Vitest:** `npm run test` → 3164 passed / 0 failed / 10 skipped.
- **Live DB:** migration `project_metrics_real_variance_v3` applied to `hypxrmcppjfbtlwuoafc`; six projects in the view now have non-zero variance where appropriate.

---

## What's next (P1 — informational, not blocking)

- **Wire the `refresh-materialized-views` edge function to the new view.** Existing pg_cron tick should already cover it (the function name is unchanged), but worth confirming on the next cron pass that the variance column updates as schedule_phases.percent_complete drifts.
- **Consider switching `overall_progress` to duration-weighted too** — would give the dashboard a more honest "today's percent complete" number. Out of scope for this hotfix to avoid disturbing existing consumers; lift later as part of the schedule-rollup spec.
- **Sanity-check the Schedule sub-bar in `DashboardProjectHealth`.** Its sub-score formula `100 − |behind days| × 2` will now flip for any project with negative variance; verify the WCAG color contrast on the score-color palette under the new range.

---

## Sign-off

```
Hotfix branch:  test/coverage-slice-e-2026-05-05
Migration:      20260506000004_project_metrics_real_variance.sql
Live applied:   hypxrmcppjfbtlwuoafc — verified
Demo result:    Avery Oaks reads 32% / +11d ahead (was 0% / On schedule)
PR target:      Same PR as the 11 P0 items.
```
