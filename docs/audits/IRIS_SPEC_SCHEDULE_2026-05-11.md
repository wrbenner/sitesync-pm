# Iris Spec — Schedule specialist

**Date filed:** 2026-05-11
**Status:** Draft (Phase 2c contract surface shipped)
**Owner:** Walker

## Entrypoint

`src/services/iris/specialists/schedule.ts` — `SCHEDULE_DECL`. CPM math lives in `src/services/iris/cpm.ts` as pure functions on a typed activity graph.

## Persona

Superintendent (primary), PM (secondary).

## Specialist (ADR-018)

| Field | Value |
|---|---|
| `name` | `'schedule'` |
| `version` | `0.1.0` |
| `llmScope` | `'synthesis'` — LLM combines deterministic CPM + weather + crew |
| `modelTier` | `'sonnet'` |
| `latencyBudgetMs` | `{ p50: 3000, p95: 5000 }` |
| `writeScope` | `[]` — read-only; `schedule_lookahead_publish_executor` ratifies |
| `toolAllowList` | `weather_query` + 4 `cite_*` tools |

## Deterministic gates

- `activities` non-empty.
- `today_offset_days >= 0`.
- `window_days` in `[1, 14]`.
- Every activity has finite non-negative `duration_days` + array `predecessors`.
- Graph is a DAG (CPM precondition).
- Warnings: window > 7d without weather forecast; bad date format on weather entries.

## CPM math (`cpm.ts`)

- `runCpm(activities)` — forward + backward pass, returns ES/EF/LS/LF/float + critical path.
- `synthesizeLookahead(cpm, today_offset_days, window_days)` — 14-day slice.
- **Perf:** 500-activity graph completes in < 200ms (test asserted).
- Topological sort via Kahn's algorithm; throws on cycles.

## Weather-detector reuse

The Schedule specialist consults `SCHEDULE_WEATHER_STALENESS_MAX_HOURS` but does NOT re-implement the staleness check — the Lap 2 weather-detector (Day 35 receipt) is the source of truth. This avoids the spec's "don't re-implement weather" risk.

## Citation kinds

`cite_schedule_phase`, `cite_drawing_coordinate`, `cite_rfi_reference`, `cite_daily_log_excerpt`. The synthesis output must cite the schedule artifact it's recommending against.

## Voice rules

Synthesis output gets the standard voice linter. Super-persona overrides apply (jobsite vernacular, terse, no greeting).

## Auto-execute risk

**None directly.** Schedule emits a recommendation; the `schedule_lookahead_publish_executor` (Phase 2e) ratifies, gated by PermissionGate and the super's confirmation.

## Telemetry

`iris_actions` row fields: BASE + `lookahead_window_days` + `activity_count` + `critical_path_count` + `weather_signals_used`.

## Acceptance (Phase 2c)

- ✅ Contract surface conforms to ADR-018.
- ✅ Deterministic-check coverage: empty, bad offset, bad window, bad duration, cycle, warnings.
- ✅ CPM perf < 200ms on 500-activity graph (test asserted).
- ✅ 20 tests on `schedule.test.ts` pass.
- ⏳ 50 goldens — Walker-authored Phase 2 Days 44–49.
