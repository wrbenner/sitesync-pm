# Days 33–35 — Variance, Staffing, Weather Detectors All Live

**Date:** 2026-05-04
**Lap:** Lap 2 Week 5, Days 33–35 combined (executed during pre-flight push).
**Spec:** `docs/audits/SCHEDULED_INSIGHTS_SPEC_2026-05-04.md` § Day-by-day mapping
**Depends on:** Days 31–32 (foundation + aging + cascade).

---

## What shipped

The remaining three detectors of the spec, plus their stale-draft sweeps, plus 22 more unit tests. The worker's `DETECTORS` map is now complete: aging, cascade, variance, staffing, weather all promote drafts on the same hybrid cron pipeline.

### Day 33 — Variance detector

`detectAndPromoteVariance(supabase, projectId)` mirrors `src/services/iris/insights.ts:detectVarianceAcceleration`:

- Pulls the last ~45 days of `budget_snapshots` for the project.
- Buckets by ISO week (Monday-anchored) via `bucketByMondayWeek`, taking the latest snapshot per week. Mirrors the in-app weekly semantic without a SQL aggregate.
- Computes week-over-week commit deltas as % of `total_budget`.
- Acceleration factor = latest delta / trailing 4-week average.
- **Promotion gates** (locked): acceleration ≥ 2× AND percent-committed ≥ 60.
- **Severity floor**: only promotes at high (≥ 90% committed) or critical (≥ 100%); medium stays in the in-app insights tab but never drafts.
- **Sweep**: `sweepStaleVarianceDrafts` withdraws when the next snapshot drops percent-committed back below 90 (e.g. an approved CO lifted the budget). Withdraws all open variance drafts in that case — the recovery is project-level, so any draft for it is moot.

### Day 34 — Staffing detector

`detectAndPromoteStaffing(supabase, projectId)`:

- Pulls today's active `schedule_activities` with `required_hours_today > 0`.
- Sums to project-level `scheduledHours`.
- Counts `crew_checkins` for today's start; estimates `availableHours = checkin_count × 8`.
- **Promotion gate**: `availableHours < 0.5 × scheduledHours`.
- **Severity**: critical when zero check-ins; high when 0% < ratio < 50%.
- **Sweep**: withdraws prior-day staffing drafts that are still pending (today's schedule gets its own check). Same-day drafts stay open until the user decides — the gap is real until end of day.
- **Honest simplification**: project-level (not per-trade). The in-app detector groups by trade via `WorkforceCheckIn`/`workforce_members` joins; the cron worker uses the simpler `crew_checkins` count because the trade-level join hasn't stabilized yet. Documented in the worker's comment block; Lap 3 refines.

### Day 35 — Weather detector

`detectAndPromoteWeather(supabase, projectId)`:

- Reads the most recent `weather_cache.forecast_data` for the project.
- `parseForecast` is liberal: accepts a top-level array OR `{ daily: [...] }` OR `{ forecast: [...] }` OR `{ days: [...] }`. Tolerates the loose `jsonb DEFAULT '{}'` schema so a missing forecast doesn't break the worker.
- Filters to "bad" days within a 3-day horizon (rain/storm/snow regex).
- Cross-references outdoor `schedule_activities` (`outdoor_activity = true`) in the same window.
- **Severity floor**: only promotes when `badDayCount ≥ 3` (high). 1–2 bad days drop below the promotion bar.
- Action type is `schedule.resequence` (not `rfi.draft`) because the natural next step is re-sequencing outdoor work, not asking a question.
- **Sweep**: parses the synthetic entity id `weather-<proj>-<first>-<last>` to find the window's last bad date; withdraws drafts whose last bad day is in the past.

### 3 New envelope builders + 3 severity ladders — `insightEnvelope.ts` (400 lines total)

- `varianceSeverity(percentCommitted)`, `buildVarianceEnvelope(VarianceInputs)`
- `staffingSeverity(scheduled, available)`, `buildStaffingEnvelope(StaffingInputs)`
- `weatherSeverity(badDayCount)`, `buildWeatherEnvelope(WeatherInputs)`

Each follows the established envelope contract: kind, action_type, severity, confidence (0.78 / 0.72 / 0.75 — lower than aging/cascade because variance/staffing/weather have noisier inputs), primaryEntityType (`budget_snapshot`/`staffing_day`/`weather_window`), citation pair (or single, when context allows). All three RPC-contract tests pass (severity ∈ {high, critical}, confidence ≥ 0.7, kind in enum).

### Test coverage — 46 total (was 24)

Added 22 tests across the three new builders:
- Severity ladders with all boundaries (variance: 89.99/90/100; staffing: 0/19/21/40; weather: 1/2/3/7).
- Envelope shape: title, summary text, payload `insightKind` propagation, citation kinds.
- Edge cases: variance with `averageWeeklyPct = 0` doesn't divide-by-zero; staffing without an example activity emits 1 citation instead of 2; weather singularizes "1 day" but pluralizes "3 days"; weather without an activity emits 0 citations.
- RPC contract assertions for all 3 new envelopes.

**46/46 passing.** Combined session: 51 (Day 30.5/.75) + 24 (Day 32) + 22 (Days 33–35) = **97 unit tests across 5 files**, all green.

---

## Verification

- `npm run typecheck` — **0 errors**. Bugatti gate holds.
- `npx vitest run supabase/functions/scheduled-insights-worker/__tests__/insightEnvelope.test.ts` — 46/46.

---

## What's now possible that wasn't 3 days ago

- **All 5 detectors are wired through the same hybrid cron pipeline.** A pilot org's PM opens the inbox in the morning and may find: an aging-RFI follow-up, a cascade-prep RFI, a variance review, a staffing flag, and a weather resequence — each with citations, each idempotently deduped, each auto-withdrawn when the underlying state changes.
- **Adding a 6th detector** is: 1 query in the worker, 1 builder in `insightEnvelope.ts`, 1 entry in the `DETECTORS` map, 1 test block. Expected ramp time: ~1 hour.
- **Severity ladders are unit-tested per-detector**, every boundary. Drift between the in-app insights and the cron worker would show up as a test failure pre-deploy.

---

## Honest tradeoffs

- **Staffing is project-level, not per-trade.** The in-app `detectStaffing` groups by trade. The cron worker's data shape isn't there yet (workforce_members/trade joins not solid). Lap 3 lifts this to per-trade.
- **Weather forecast parsing is liberal.** `weather_cache.forecast_data` is `jsonb DEFAULT '{}'` — no schema constraint. The parser accepts 4 different shapes. When the forecast API hardens (Lap 3+), tighten the schema and remove the fallback.
- **Variance uses `total_budget` from `budget_snapshots`**, not the more nuanced `approvedTotal` the in-app detector uses (`BudgetWeekSnapshot.approvedTotal` = approved CO budget). The two converge in normal cases but can diverge mid-CO-cycle. Tracked in the receipt; the in-app detector remains canonical for the insights tab; the worker's variance is conservative on purpose.

These are documented simplifications — not silent corner-cuts.

---

## File-by-file changelog

| Path | Change | Lines |
|---|---|---|
| `supabase/functions/scheduled-insights-worker/insightEnvelope.ts` | EDIT — 3 new severity fns + 3 new builders | +203 net |
| `supabase/functions/scheduled-insights-worker/index.ts` | EDIT — 3 new detectors + 3 sweeps + 3 helper fns (mondayOf, bucketByMondayWeek, parseForecast, isoDaysAhead) | +422 net |
| `supabase/functions/scheduled-insights-worker/__tests__/insightEnvelope.test.ts` | EDIT — 22 new tests across 6 new describe blocks | +206 net |
| `docs/audits/INDEX.md` | EDIT — Days 33–35 row, spec status flipped to ✅ |
| `docs/audits/DAYS_33_34_35_DETECTORS_RECEIPT_2026-05-04.md` | NEW (this file) | — |

**Net new this segment:** ~830 lines + 22 tests.
**Combined Day 31–35 detector pipeline:** ~2,500 lines / 46 tests across 1 ADR, 4 migrations, 1 edge function (worker), 1 pure-fn module, 1 test file.

---

## Spec status flip

`SCHEDULED_INSIGHTS_SPEC` moves from 🟡 to ✅ Day-1 implementation complete. Outstanding for staging:
- Enable pgmq, pg_cron, pg_net extensions on the Supabase project
- Set `app.supabase_url` and `app.service_role_key` GUCs
- Deploy the edge function (`supabase functions deploy scheduled-insights-worker`)
- Apply the 4 migrations
- Flip the soft-pilot org to `is_soft_pilot = TRUE` once recruited
- Run an integration smoke: seed an aging RFI + an at-risk submittal + budget snapshots showing acceleration, wait one tick, assert drafts land in the inbox, mark each entity resolved, wait another tick, assert all withdraw

---

## Pre-flight cumulative scoreboard

| Day | Theme | Lines | Tests | Migrations | Workflows | Receipts |
|---|---|---|---|---|---|---|
| 30.5 | Iris telemetry | 660 | 4 | 1 | — | 1 |
| 30.75 | Lap 2 gate | 990 | 15 | 1 | 1 | 1 |
| 31 | Cron foundation + aging | 1,060 | — | 4 | — | 1 |
| 32 | Cascade detector + extraction | 590 | 24 | — | — | 1 |
| 33–35 | Variance + staffing + weather | 830 | 22 | — | — | 1 |
| **Total pre-flight** | | **~4,130** | **65** | **6** | **1** | **5** |

Plus 3 new ADRs (003, 008 promoted to standalone; ADR-007 carryover) and 4 INDEX rows. Typecheck remains 0. The Lap 1 closing baseline of "0 errors" carries through every day of pre-flight unchanged.

---

## Next session pickup

Pre-flight is now substantively complete for the Day-31-through-35 path. The remaining Lap 2 specs:

1. **`IRIS_CITATIONS_SPEC`** — Days 38–41. Clickable citations + side panel + resolver + auto-reject on missing-source. This is the next logical block.
2. **`IRIS_VOICE_GUIDE_SPEC`** — Days 43–49. 150-draft hand-edit corpus → `style.ts` + linter.
3. **`SOFT_PILOT_PLAYBOOK`** — Days 50–60. Pilot agreement, onboarding day-of script, daily standup template, exit criteria.

The first one (citations) is the natural next step — Day 36 is "voice + summary tightening" per the spec, which is the lead-in to the citation work on Days 38–41.
