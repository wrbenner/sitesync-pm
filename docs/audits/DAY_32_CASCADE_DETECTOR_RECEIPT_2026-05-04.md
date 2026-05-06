# Day 32 — Cascade Detector + Pure-Function Test Coverage

**Date:** 2026-05-04
**Lap:** Lap 2 Week 5, Day 32 (executed during pre-flight push).
**Spec:** `docs/audits/SCHEDULED_INSIGHTS_SPEC_2026-05-04.md` § Day 32 row
**Depends on:** Day 31 receipt (foundation + aging detector live).

---

## What shipped

### 1 Pure-function module — `supabase/functions/scheduled-insights-worker/insightEnvelope.ts` (197 lines)

Plain TypeScript (no Deno globals) so it loads identically under Vitest (Node) and Deno (the worker). Single source of truth for:

- **`InsightEnvelope` type** — the exact shape `promote_insight_to_draft` RPC validates.
- **Severity ladders** — `agingSeverity(slipDays)` and `cascadeSeverity(isCriticalPath, daysToBaseline)`.
- **Slip inference** — `inferSlipDays(overdue, float, explicitImpact?)` and `inferCascadeSlip(status, float)`. Bias-correct: explicit-impact wins, fallback to overdue minus float, floored at zero.
- **Envelope builders** — `buildAgingEnvelope(inputs)` and `buildCascadeEnvelope(inputs)`. Each produces a fully-formed envelope with kind, action_type, severity, confidence, primaryEntityType, primaryEntityId, payload (incl. `insightKind` for the withdrawal sweep), and 2-tuple citations.

Worker imports from this module via `./insightEnvelope.ts` — Deno honors the relative `.ts` import; Vitest honors the matching path with the bundler-style resolver. The same code runs both ways.

### 2 Cascade detector — `supabase/functions/scheduled-insights-worker/index.ts` (+170 lines)

`detectAndPromoteCascades(supabase, projectId)`:

- Queries submittals with status ∈ {rejected, revise_resubmit, revise_and_resubmit, at_risk, overdue} for the project.
- Joins linked schedule activities (id, baseline_end, end_date, is_critical_path, float_days).
- For each at-risk submittal whose activity hits its baseline within 21 days (and not in the past):
  - Computes inferred slip via `inferCascadeSlip` (rejected = 10d base, others = 5d base; reduced by float).
  - Promotion floor: critical-path OR `daysToBaseline ≤ 7`. Off-critical and further-out drops below the high-severity bar.
  - Builds the envelope via `buildCascadeEnvelope` and calls `promote_insight_to_draft`.

`sweepStaleCascadeDrafts(supabase, projectId)`:

- For every pending cascade draft, queries the underlying submittal's current status.
- Withdraws via `withdraw_stale_draft` if the submittal moved out of the at-risk band.
- Defensive: leaves drafts alone when status is unknown (transient query failure). Withdraw only on confirmed transitions per ADR-007.

`callPromote(supabase, insight, projectId)` — small shim that centralizes RPC error logging so each detector stays focused on the data shape, not the boilerplate. Aging detector refactored to use it too.

### 3 Aging detector simplified

The Day 31 inline envelope construction (~50 lines) collapses to:
```ts
const insight = buildAgingEnvelope({ rfiId, rfiNumber, rfiTitle, overdueDays, activityId, activityName, slipDays })
if (await callPromote(supabase, insight, projectId)) promoted++
```
Behavior unchanged; lines saved go to the cascade implementation.

### 4 24 Vitest tests — `supabase/functions/scheduled-insights-worker/__tests__/insightEnvelope.test.ts` (222 lines, 24 tests)

- **Severity ladders**: every boundary (slip = 4/5/9/10; daysToBaseline = 0/7/8/21; on/off critical path).
- **Slip inference**: explicit-impact wins; falls back to overdue-minus-float; floors at zero; treats 0 as "no value, infer."
- **Aging envelope**: shape, severity propagation to `payload.priority`, citation count + kind ordering.
- **Cascade envelope**: critical-path → critical, off-critical/near-baseline → high, off-critical/far → medium; verb selection ("was rejected" vs "is at risk"); critical-path suffix in description; citation kinds (spec_reference + schedule_phase); confidence (0.8, lower than aging's 0.85).
- **RPC contract assertions**: every promotable envelope satisfies the runtime constraints (kind ∈ enum, severity ∈ {high, critical}, confidence ≥ 0.7, primaryEntityId is uuid-shaped, actionType non-empty).

**24/24 passing**. Combined session: 27 (Day 30.5/.75) + 24 (Day 32) = **51 unit tests across 4 files**, all green.

---

## Verification

- `npm run typecheck` — **0 errors** on both tsconfigs. Bugatti gate holds.
- `npx vitest run supabase/functions/scheduled-insights-worker/__tests__/insightEnvelope.test.ts` — 24/24.

---

## Why "extract pure module" is the right Bugatti call here

The temptation was to inline cascade like aging was inlined. Doing it would have meant **two copies** of the severity ladder by Day 35 (one in `src/services/iris/insights.ts` for the in-app insights tab, one in the worker for the cron pipeline) — and a third when an analytics dashboard reads the data. Three copies of "≥ 10 days = critical" is the start of bugatti-grade tech debt.

The pure module is the seam: every detector that promotes to a draft uses the same envelope builder. The next-detector ramp time drops to "write the data query + call `buildXEnvelope`." The RPC's CHECK constraints are the runtime safety net; the unit tests are the pre-deploy proof.

---

## File-by-file changelog

| Path | Change | Lines |
|---|---|---|
| `supabase/functions/scheduled-insights-worker/insightEnvelope.ts` | NEW (pure, testable) | 197 |
| `supabase/functions/scheduled-insights-worker/index.ts` | EDIT — cascade detector + sweep + envelope-builder import; aging refactor to use builder; `callPromote` shim | +170 net |
| `supabase/functions/scheduled-insights-worker/__tests__/insightEnvelope.test.ts` | NEW (24 tests) | 222 |
| `docs/audits/INDEX.md` | EDIT — Day 32 row | +1 |
| `docs/audits/DAY_32_CASCADE_DETECTOR_RECEIPT_2026-05-04.md` | NEW (this file) | — |

**Net new:** ~590 lines + 24 tests. **Combined Day 31+32 detector pipeline:** 1,650 lines / 24 tests.

---

## What's now possible that wasn't yesterday

- **Cascade drafts arrive overnight too.** Once an org is `is_soft_pilot`, the worker promotes both aging RFIs AND at-risk submittals on critical paths.
- **Adding the next detector is 1 query + 1 `buildXEnvelope` call.** Days 33–35 (variance, staffing, weather) follow the same shape.
- **Severity logic is unit-tested.** Boundary regressions are caught pre-deploy. The RPC's CHECK constraints are belt-and-suspenders.

---

## Next-day pickup

Day 33: variance detector. Inputs are `budgetWeekly` snapshots — 5 weeks of committed/approved totals. The detector flags acceleration: latest week's variance vs. the trailing 4-week mean exceeding a threshold. Severity keyed on the magnitude of acceleration. Single-detector spec: query budget snapshots → compute z-score-style outlier → build envelope via a new `buildVarianceEnvelope`.

Day 34: staffing detector. Required-hours-today vs. crew-size mismatch.

Day 35: weather detector. Outdoor activity scheduled into a precip forecast. Last because the forecast API is its own dependency and adds a failure mode we don't want compounding earlier.

Then: integration test on staging — enable extensions, flip a project to `is_soft_pilot`, seed an aging RFI + an at-risk submittal, wait one tick, assert two drafts land in the inbox, mark the entities resolved, wait another tick, assert both drafts withdraw.
