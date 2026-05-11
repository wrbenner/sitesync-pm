# Phase 2c — Schedule specialist + CPM module

**Date:** 2026-05-11
**Branch / PR:** `phase-2c-schedule`
**Spec:** [`IRIS_PHASE_2_SPECIALIST_SUBAGENTS_SPEC_2026-05-08.md`](IRIS_PHASE_2_SPECIALIST_SUBAGENTS_SPEC_2026-05-08.md) (Schedule §)
**Builds on:** Phase 2a (#423) + 2b (#424)

## TL;DR

Third Phase 2 specialist. `llmScope: 'synthesis'` — the LLM combines deterministic CPM facts + weather + crew availability into a draft recommendation. Pure CPM walk in `src/services/iris/cpm.ts` operates on a typed `CpmActivity[]` graph independent of the existing `src/lib/criticalPath.ts` (which is bound to `SchedulePhase`). **Perf target met:** 500-activity graph completes in < 200ms (asserted in test). Weather-detector reuse confirmed — the specialist consults the Lap 2 detector rather than re-implementing.

20 new tests; typecheck zero.

## What changed

### CPM module

`src/services/iris/cpm.ts` (new) —
- **`runCpm(activities)`** — forward + backward pass using Kahn's topological sort. Returns `{ activities: per-activity ES/EF/LS/LF/float/is_critical, project_duration_days, critical_path }`. Throws on cycles.
- **`synthesizeLookahead(cpm, today_offset_days, window_days=14)`** — emits the 14-day lookahead slice sorted by ES with `days_until_start` relative to today.
- Pure functions. No DB.

### Schedule specialist

`src/services/iris/specialists/schedule.ts` (new) —
- **`scheduleDeterministicCheck()`** — blocks on empty activities, bad `today_offset_days`, bad `window_days`, non-finite `duration_days`, missing `predecessors`, cycles. Warnings on `window > 7d` without weather forecast + bad date formats.
- **`SCHEDULE_DECL`** — `llmScope: 'synthesis'`, sonnet tier, `latencyBudgetMs: { p50: 3000, p95: 5000 }`, `writeScope: []` (read-only), audit BASE + `lookahead_window_days` + `activity_count` + `critical_path_count` + `weather_signals_used`, tools = `weather_query` + 4 `cite_*` kinds.
- **`computeScheduleFacts()`** — public entry running the CPM pass for the LLM dispatch path.
- **`scheduleShouldRun()`** — router entry point.
- **`SCHEDULE_WEATHER_STALENESS_MAX_HOURS = 1`** — declared but not re-implemented; the Lap 2 weather-detector (Day 35) owns the staleness check.

### Tests

`src/services/iris/specialists/__tests__/schedule.test.ts` (20 tests):
- 3 contract-conformance.
- 9 deterministic-check decisions (positive + each negative gate + 2 warning cases).
- 4 CPM math tests (diamond graph, empty, cycle, single chain).
- **1 perf test** — 500-activity sparse graph CPM walk < 200ms.
- 2 lookahead synthesis tests.
- 1 `computeScheduleFacts` smoke.

### Spec card

`docs/audits/IRIS_SPEC_SCHEDULE_2026-05-11.md` — tier-1 Iris Spec.

## Verification

```bash
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit -p tsconfig.app.json
# → exit 0

NODE_OPTIONS="--max-old-space-size=8192" npx vitest run src/services/iris/specialists/
# → Drafter (15) + Money (19) + Schedule (20) = 54/54 pass
```

## Phase 2c acceptance check

✅ `SCHEDULE_DECL` conforms to ADR-018.
✅ Deterministic-check coverage on every gate listed in the spec.
✅ CPM walk < 200ms on 500-activity sparse graph (test-asserted).
✅ Weather-detector reuse — staleness constant exported but not re-implemented.
✅ Iris spec card filed.
⏳ 50 goldens — Walker-authored Phase 2 Days 44–49.

## Next up

**PR 2d — Code specialist + KB stub.** `src/services/iris/specialists/code.ts` (`llmScope: 'synthesis'`); KB stub at `src/services/iris/kb-stub.ts` with vector + keyword retrieval over a 5K-clause-target corpus (Phase 2d scaffolds ~100 clauses; SME author the rest).
